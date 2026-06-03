# PS TimeSheet Pro — Technical Documentation

**Version:** 3.0  
**Last Updated:** June 2026  
**Repository:** https://github.com/BRI-MW-Development/pstimesheet  
**Company:** Professional Signs LLC (BRI)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Environment Setup](#4-environment-setup)
5. [Running the Application](#5-running-the-application)
6. [Module Reference](#6-module-reference)
7. [Database Schema](#7-database-schema)
8. [Security Model](#8-security-model)
9. [S3 Storage](#9-s3-storage)
10. [Email System](#10-email-system)
11. [Code Procedures & Standards](#11-code-procedures--standards)
12. [API Reference](#12-api-reference)
13. [Deployment Guide](#13-deployment-guide)
14. [Known Limitations](#14-known-limitations)

---

## 1. Project Overview

PS TimeSheet Pro is a full-stack web application for managing:
- **Production & Installation Timesheets** (labour, materials, machinery)
- **Projects Team Timesheets** (daily & weekly)
- **WO Complete** (work order completion tracking)
- **Quality Control (QC)** (inspection checklists, photos, print reports)
- **Analytics** (performance reports per module)
- **Master Data** (employees, departments, items, machinery, vehicles, projects, work orders)
- **Access Control** (users, roles, permissions)
- **Settings** (approval workflows, email notifications, shifts, document numbering)

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React 18 + Vite 5 | 18.x / 5.x |
| State Management | Zustand + TanStack Query v5 | — |
| Charts | Recharts | — |
| PDF Export | jsPDF + html2canvas | — |
| Backend | NestJS | 10.x |
| Database (Read) | SQL Server — ERP-Live (65.2.162.104) | — |
| Database (Write) | SQL Server — ERP-Dev (13.234.241.125) | — |
| File Storage | AWS S3 (ap-south-1, bucket: bluerhine-erp) | — |
| Email | SMTP / Microsoft Graph API | — |
| Auth | Session token (PSTsSessions table) | — |

---

## 3. Architecture

```
Browser
  └── React SPA (Vite, port 5173 dev / served from NestJS in prod)
        └── Zustand (auth store: token, user, permissions, dataScope)
        └── TanStack Query v5 (server state cache)

NestJS API (port 3000)
  ├── AuthGuard (all routes — validates session token)
  ├── PermissionGuard (role-based module access)
  ├── SQL_POOL → ERP-Live (read-only: employees, projects, work orders, departments)
  └── DEV_SQL_POOL → ERP-Dev (read/write: timesheets, QC, WOC, users, settings)

AWS S3
  └── bluerhine-erp / dev /
        ├── qc/{qcId}/{timestamp}-{filename}        — QC inspection photos
        ├── woc/{wocId}/{timestamp}-{filename}       — WO Complete attachments
        ├── users/{userId}/{timestamp}-{filename}    — Profile photos
        └── employees/{employeeNo}/{timestamp}-{filename} — Employee photos
```

---

## 4. Environment Setup

### Prerequisites
- Node.js v18+ (v24 tested)
- npm v9+
- Access to SQL Server (both ERP-Live and ERP-Dev)
- AWS credentials with S3 access

### Clone & Install

```bash
git clone https://github.com/BRI-MW-Development/pstimesheet.git
cd pstimesheet

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Environment Variables

Create `backend/.env`:

```env
# Live ERP DB (read-only)
DB_SERVER=65.2.162.104
DB_NAME=ERP-Live
DB_USER=eljosqladmin
DB_PASSWORD=<password>
DB_TRUST_CERT=yes
DB_PORT=1433

# Dev DB (read/write — timesheets, QC, settings)
DEV_DB_SERVER=13.234.241.125
DEV_DB_NAME=ERP-Dev
DEV_DB_USER=eljossqladmin
DEV_DB_PASSWORD=<password>
DEV_DB_TRUST_CERT=yes
DEV_DB_PORT=1433

# AWS S3
AWS_ACCESS_KEY_ID=AKIA6GBMHO6HTYFJOB6E
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=ap-south-1
S3_BUCKET=bluerhine-erp
S3_FOLDER=dev

# App
PORT=3000
FRONTEND_ORIGIN=http://172.16.22.225:5173

# Optional: additional CORS origins (comma-separated)
# EXTRA_ORIGINS=http://192.168.1.100:3000
```

---

## 5. Running the Application

### Development Mode (two terminals)

**Terminal 1 — Backend:**
```bash
cd backend
npm run start:dev
# Starts on http://localhost:3000 with hot-reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# Starts on http://localhost:5173 with HMR
```

### Production Build

```bash
# Build frontend
cd frontend && npm run build
# Output: frontend/dist/

# Build & run backend (serves frontend/dist via ServeStatic)
cd backend && npm run build
node dist/main.js
# App available at http://localhost:3000
```

### Production with PM2

```bash
cd backend
npm run build
pm2 start dist/main.js --name ps-timesheet
pm2 save
```

---

## 6. Module Reference

### Timesheets

| Type | Route | Description |
|------|-------|-------------|
| Production | `/timesheets/prod` | PROD type — labour, materials, machinery |
| Installation | `/timesheets/inst` | INST type — labour, materials, vehicles, access equipment |
| Projects Team | `/timesheets/project` | PROJ type — daily & weekly entries |
| Pending Approvals | `/timesheets/pending-approvals` | Submitted timesheets awaiting action |

**Mandatory fields (PROD & INST):** Project ID, Work Order, Department, Shift

**Status flow:** `Draft → Submitted → Approved / Rejected`
- Rejected timesheets: Edit available, no resubmit (user must create new)
- Only users with `PROD/INST/PROJ.canWrite` can approve/reject
- Approval Settings rules determine which specific approver handles each timesheet

### WO Complete

Route: `/woc`

**Validation chain (backend, in order):**
1. Required fields: Work Order, Status
2. No duplicate WO Complete for same work order
3. All timesheets for the WO must be Approved or Rejected
4. **Production departments only:** WO must have a Full QC inspection

### QC Module

Route: `/qc`

**Mandatory fields:** Work Order, Quantity, Remarks, QC Inspector (auto-filled from login)

**Date restriction:** QC date must be today only (no past or future dates)

**Image requirements:**
- Minimum 3 images required when setting status to **Passed**
- Maximum 10 images per record
- Images only (JPEG, PNG, WEBP, HEIC)
- Stored in S3: `dev/qc/{id}/{timestamp}-{filename}`

**Status flow:** `In Progress → Passed / Failed`
- Passed records cannot be downgraded
- Failed records can only be edited by approvers

**Print:** `/qc/:id/print` — opens in new tab, generates high-quality PDF via jsPDF + html2canvas

### Analytics

Route: `/reports/analytics`

Four separate tabs with dedicated charts:
- **Production** — monthly trend, status breakdown, approval rate, departments
- **Installation** — same as production for INST type
- **Quality Control** — pass rate trend, section pass rates, monthly QC
- **WO Complete** — monthly completions, cumulative chart

Requires `REPORTS.canRead` permission.

---

## 7. Database Schema

### Key Tables (ERP-Dev / DEV_SQL_POOL)

| Table | Purpose |
|-------|---------|
| `PSTsHeader` | Timesheet header records |
| `PSTsLabourLines` | Labour entries per timesheet |
| `PSTsMaterialLines` | Consumed materials |
| `PSTsEquipmentLines` | Machinery usage |
| `PSTsVehicleLines` | Vehicle usage (INST) |
| `PSTsAccessLines` | Access equipment (INST) |
| `PsQcRecord` | QC inspection records |
| `PsQcAttachment` | QC photos (s3Key + fileData for legacy) |
| `PsQcComment` | QC comments (with authorUserId) |
| `PsWoComplete` | WO completion records |
| `PsWoCompleteAttachment` | WO attachments (s3Key) |
| `PSTsUsers` | Application users (with profileImageKey) |
| `PSTsRoles` | Role definitions (roleCode, dataScope) |
| `PSTsRolePermissions` | Module permissions per role |
| `PSTsSessions` | Active login sessions |
| `PSTsLoginHistory` | Login audit trail |
| `PSApprovalSettings` | Approval routing rules |
| `PSEmailSettings` | SMTP/Graph config |
| `PSEmailNotificationRules` | When to send emails |
| `PSEmailTemplates` | Email body templates |
| `PSEmailLog` | Sent email audit log |
| `PSTsEmployeeProfile` | Employee overrides (email, category, imageS3Key) |
| `PSDepartmentProfile` | Department overrides (mainDepartment, isActive) |
| `psTsDocSequence` | Auto-incrementing doc numbers |
| `PsNotifSeen` | Notification read state |

### Auto-Schema Migration
All tables are created automatically on first startup via `onModuleInit()` in each service. No manual migration scripts needed.

---

## 8. Security Model

### Authentication
- Session token stored in `PSTsSessions` table
- Token sent as `Authorization: Bearer <token>` header
- Sessions expire after 8 hours (`SESSION_TTL_HOURS = 8`)
- Expired sessions cleaned on every login
- Max 10 failed login attempts → 15-minute lockout (per username)

### Authorization — Two Layers

**Layer 1: AuthGuard** (global) — every request must have a valid session token.

**Layer 2: PermissionGuard** (per endpoint) — checks `PSTsRolePermissions` for the user's role.

```typescript
@UseGuards(PermissionGuard)
@RequirePermission('QC', 'canRead')
@Get()
list(...) { ... }
```

Permission fields per module: `canRead`, `canCreate`, `canWrite`, `canDelete`, `canReport`

**Auto-grant rule:** Roles with `PROD` or `INST` canRead automatically receive `QC` permissions if no explicit QC row exists.

### Approval Authorization
Approve/Reject timesheets requires `canWrite` on PROD/INST/PROJ (checked via DB query, not hardcoded role names).

Approval Settings rules further restrict which specific user can approve which timesheet (by department, shift, project, WO criteria).

### Navigation Filtering
Frontend sidebar shows only links the user has `canRead` permission for. Backend enforces the same via permission guards independently.

---

## 9. S3 Storage

### Configuration
```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
S3_BUCKET=bluerhine-erp
S3_FOLDER=dev
```

### S3Service (`backend/src/s3/s3.service.ts`)
- `upload(subfolder, fileName, base64, mimeType)` → returns S3 key
- `presignedUrl(key, expiresIn=3600)` → returns signed URL (default 1 hour)
- `delete(key)` → removes object
- `isConfigured` → boolean, falls back to DB storage if false

### Upload Flow
```
Frontend (base64 dataURL)
  → POST /api/*/attachments { fileData, mimeType, fileName, fileSize }
  → Backend validates (image only, ≤10MB)
  → S3Service.upload() → s3Key stored in DB, fileData = NULL
  → S3Service.presignedUrl() returned to frontend
```

### Download Flow
```
GET /api/*/attachments/:id/download
  → If s3Key exists → generate presigned URL (24h for profiles, 1h for QC)
  → Frontend uses URL directly (images) or opens in new tab (PDFs)
```

---

## 10. Email System

### Providers
- **SMTP** (any provider — Office365, Gmail, etc.)
- **Microsoft Graph API** (OAuth2 client credentials)

### Configuration
Settings → Email Settings → SMTP/Provider tab

### Notification Rules
Settings → Email Settings → Notification Rules tab

Default rules: PROD/INST/WO × SUBMIT/APPROVE/REJECT/COMPLETE events

Each rule controls:
- `enabled` — whether emails are sent at all
- `sendToApprover` — email the designated approver
- `sendToSubmitter` — email the person who submitted
- `ccEmails` — additional recipients

### Templates
4 customisable templates with variables: `{{docNo}}`, `{{type}}`, `{{submitter}}`, `{{approver}}`, `{{department}}`, `{{date}}`, `{{reason}}`, `{{workOrder}}`

### Email Log
Settings → Email Settings → Email Log tab
- Filterable by status (sent/failed/skipped), module, date range
- Paginated (50/page)
- CSV export available

---

## 11. Code Procedures & Standards

### Branch Strategy

```
main          ← production-ready code
feature/xxx   ← new features (branch from main)
fix/xxx       ← bug fixes (branch from main)
hotfix/xxx    ← urgent production fixes
```

### Git Commit Convention

```
<type>: <short description>

<detailed body (optional)>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `docs`, `security`, `perf`, `test`

Examples:
```
feat: add department filter to WO Complete
fix: rejected timesheets now show Edit button only
security: add permission guards to analytics controller
```

### Adding a New Module

**1. Backend — create the module folder:**
```
backend/src/<module>/
  <module>.service.ts      ← DB queries, business logic
  <module>.controller.ts   ← HTTP endpoints + permission guards
  <module>.module.ts       ← NestJS module registration
```

**2. Register in `app.module.ts`:**
```typescript
import { NewModule } from './<module>/<module>.module';
// Add to imports array:
NewModule,
```

**3. Add permission guards to controller:**
```typescript
import { UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@UseGuards(PermissionGuard)
@RequirePermission('MODULE_NAME', 'canRead')
@Get()
list() { ... }
```

**4. Add permission module to RolesPage:**
```javascript
// frontend/src/pages/admin/RolesPage.jsx
const MODULE_LABELS = {
  ...,
  NEW_MODULE: 'New Module Name',
};
const MODULE_GROUPS = [
  { label: 'Group', modules: [..., 'NEW_MODULE'] },
];
```

**5. Add nav link to AppShell:**
```javascript
// frontend/src/components/layout/AppShell.jsx
{ label: 'New Module', to: '/new-module', perm: { module: 'NEW_MODULE', action: 'canRead' } },
```

**6. Add route in App.jsx:**
```jsx
const NewPage = lazy(() => import('./pages/new-module/NewPage'));
<Route path="new-module" element={<NewPage />} />
```

**7. Seed permission row for Admin roles:**
Admins auto-get access to new modules if they have PROD or INST canRead. Otherwise, go to Roles → Admin → check the new module.

### Adding a New Database Column

Always use `onModuleInit()` migration pattern — no separate migration files:

```typescript
async onModuleInit() {
  try {
    // Create table if not exists
    await this.pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='TableName' AND xtype='U')
      CREATE TABLE TableName (
        id        BIGINT IDENTITY(1,1) PRIMARY KEY,
        ...
      )
    `);
    // Add column if not exists (safe to run repeatedly)
    await this.pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('TableName') AND name='newColumn')
        ALTER TABLE TableName ADD newColumn NVARCHAR(100) NULL
    `);
  } catch (err) {
    this.logger.warn(`Schema init skipped: ${err?.message}`);
  }
}
```

### Frontend Data Fetching Pattern

```jsx
// Fetch
const { data = [], isLoading } = useQuery({
  queryKey: ['resource-key', filters],
  queryFn: () => api.get('/endpoint', { params: filters }).then(r => r.data),
  staleTime: 60_000,
});

// Mutate
const { mutate: save, isPending: saving } = useMutation({
  mutationFn: (payload) => api.post('/endpoint', payload).then(r => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['resource-key'] });
    toast('Saved.', 'success');
  },
  onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
});
```

**Important:** Do NOT use `onSuccess` on `useQuery` (removed in TanStack Query v5). Use `useEffect` instead:
```jsx
const { data } = useQuery({ ... });
useEffect(() => {
  if (data) doSomething(data);
}, [data]);
```

### SearchSelect Component

Used for all searchable dropdowns. Supports:
- `value` — selected value
- `label` — display text in dropdown list
- `triggerLabel` — short text shown in the closed button (use for item codes)
- `search` — hidden search text for token-start matching (use for project codes with long names)

```jsx
const options = items.map(i => ({
  value: i.itemcode,
  label: `${i.itemcode} – ${i.itemName}`,   // shown in dropdown
  triggerLabel: i.itemcode,                  // shown in trigger button
}));
```

### Validation Pattern

**Frontend (before API call):**
```javascript
function validate() {
  if (!header.field?.trim()) { toast('Field is required.', 'error'); return false; }
  return true;
}
// In submit:
if (!validate()) return;
```

**Backend (in service):**
```typescript
private assertFields(body: any) {
  if (!body.field?.toString().trim())
    throw new BadRequestException('Field is required.');
}
// Call at start of create() and update()
```

### Permission Check Pattern

```typescript
// Backend controller
const isApprover = await this.timesheetsService.isTimesheetApprover(req.currentUser?.roleCode);
if (!isApprover) throw new HttpException({ message: 'Insufficient permissions.' }, HttpStatus.FORBIDDEN);
```

```javascript
// Frontend
const canApprove = permissions.some(p => ['PROD','INST','PROJ'].includes(p.module) && p.canWrite);
```

### Image Upload Pattern (S3)

```javascript
// Frontend — convert to base64 first, then upload
const reader = new FileReader();
reader.onload = () => {
  api.post('/endpoint/image', {
    fileData: reader.result,  // base64 data URL
    mimeType: file.type,
    fileName: file.name,
    fileSize: file.size,
  });
};
reader.readAsDataURL(file);
```

```typescript
// Backend — validate then upload to S3
if (!body.mimeType?.startsWith('image/'))
  throw new BadRequestException('Only image files accepted.');
if (body.fileData.length > 14_000_000)
  throw new BadRequestException('Image exceeds 10 MB limit.');
const s3Key = await this.s3.upload(subfolder, fileName, body.fileData, mimeType);
// Store s3Key in DB, fileData = NULL
```

---

## 12. API Reference

### Base URL
- Development: `http://localhost:3000/api`
- Production: `http://<server>:3000/api`

### Authentication
All endpoints require: `Authorization: Bearer <sessionToken>`

### Key Endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/auth/login` | Public | Login, returns token + user |
| POST | `/auth/logout` | Authenticated | Invalidate session |
| GET | `/auth/profile` | Authenticated | Current user + profileImageUrl |
| POST | `/auth/profile/image` | Authenticated | Upload profile photo to S3 |
| GET | `/auth/permissions` | Authenticated | Role permissions + dataScope |
| GET | `/timesheets` | PROD/INST/PROJ.canRead | List timesheets |
| POST | `/timesheets` | Authenticated | Create timesheet |
| POST | `/timesheets/:docNo/submit` | Authenticated | Submit for approval |
| POST | `/timesheets/:docNo/approve` | canWrite permission | Approve timesheet |
| POST | `/timesheets/:docNo/reject` | canWrite permission | Reject timesheet |
| GET | `/qc` | QC.canRead | List QC records |
| POST | `/qc` | QC.canCreate | Create QC record |
| POST | `/qc/:id/attachments` | QC.canWrite | Upload QC photo |
| GET | `/qc/eligible-wos` | Authenticated | WOs with Full QC (for WOC) |
| GET | `/wo-complete` | WO_COMPLETE.canRead | List WO completions |
| POST | `/wo-complete` | WO_COMPLETE.canCreate | Create WO complete |
| GET | `/analytics` | REPORTS.canRead | Analytics data |
| GET | `/notifications` | Authenticated | User notifications |
| PATCH | `/notifications/:key/read` | Authenticated | Mark notification read |
| GET | `/email-logs` | SETTINGS.canRead | Email audit log |

---

## 13. Deployment Guide

### Production Build Steps

```bash
# 1. Pull latest
git pull origin main

# 2. Install dependencies (if changed)
cd backend && npm install
cd ../frontend && npm install

# 3. Build frontend
cd frontend && npm run build

# 4. Build backend
cd ../backend && npm run build

# 5. Restart server
pm2 restart ps-timesheet
# OR
node dist/main.js
```

### First-Time Deployment

```bash
# 1. Clone repo
git clone https://github.com/BRI-MW-Development/pstimesheet.git

# 2. Set up .env (see Section 4)
cp backend/.env.example backend/.env
# Edit with actual credentials

# 3. Build & start
cd frontend && npm install && npm run build
cd ../backend && npm install && npm run build
node dist/main.js

# Database tables are created automatically on first startup
# Default admin credentials are seeded on first startup
```

### Health Check
```bash
curl http://localhost:3000/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
```

---

## 14. Known Limitations

| Limitation | Notes |
|-----------|-------|
| No WebSocket notifications | Bell notifications poll every 2 minutes |
| S3 presigned URLs expire | Profile images: 24h, QC attachments: 1h. Re-fetching regenerates |
| WOC date filter is client-side | All WOC records are loaded then filtered in browser |
| QC date locked to today | By design — cannot backdate QC inspections |
| Analytics runs synchronously | Large date ranges may be slow for high-volume data |
| Email delivery confirmation | Only tracks SMTP acceptance, not actual inbox delivery |

---

## Changelog

### v3.0 (June 2026)
- QC Module: full inspection workflow, S3 photos, PDF print
- Analytics: 4-tab reports (Production, Installation, QC, WO Complete)
- Role-based navigation: sidebar filtered by permissions
- Permission guards: all 17 controllers now protected
- S3 storage: QC photos, WOC attachments, profile/employee photos
- Email log: filtering, pagination, CSV export
- Notification types: approved/rejected TS, QC pass/fail
- Security: session cleanup, CORS validation, image type enforcement
- Bug fixes: 9 issues resolved (see commit history)

### v2.0
- Production & Installation Timesheets
- WO Complete module
- Approval Settings & Email notifications
- User & Role management

### v1.0
- Initial release
