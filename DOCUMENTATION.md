# OpsDesk — Technical Documentation

**Version:** 3.6  
**Last Updated:** July 2026  
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

OpsDesk is a full-stack web application for managing:
- **Production & Installation Timesheets** (labour, materials, machinery)
- **Projects Team Timesheets** (daily & weekly)
- **WO Complete** (work order completion tracking)
- **Quality Control (QC)** (inspection checklists, photos, print reports)
- **Analytics** (performance reports per module)
- **Master Data** (employees, departments, items, machinery, vehicles, projects, work orders)
- **Access Control** (users, roles, permissions)
- **Settings** (approval workflows, email notifications, shifts, document numbering, sessions, notification preferences)

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
        ├── qc/{qcId}/{timestamp}-{filename}         — QC inspection photos
        ├── woc/{wocId}/{timestamp}-{filename}        — WO Complete attachments
        ├── proj-ts/{tsId}/{timestamp}-{filename}     — Project Timesheet line attachments
        ├── users/{userId}/{timestamp}-{filename}     — Profile photos
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

**Projects Team (PROJ) — additional restrictions:**
- **Future date guard:** Date picker is capped at today (`max` attribute). In Weekly view, the ▶ button to advance the week is disabled when already at the current week; future day tabs are dimmed, disabled, and show a tooltip. Saving a line with a future date is blocked both in the UI and backend.
- **Line attachments:** Each timesheet line can have one file attachment. Files are stored in S3 (`proj-ts/{tsId}/…`) when S3 is configured, or as base64 in `PSTsProjLineAttachment.fileData` otherwise. Image attachments open in the `FileLightbox` preview; non-image files are downloaded directly.
- **Dashboard count:** Users with `canCreate` (but not `canRead`) now correctly see their own timesheet counts on the dashboard.

### WO Complete

Route: `/woc`

**Validation chain (backend, in order):**
1. Required fields: Work Order, Status
2. Completion date cannot be a future date (UI `max` attribute + backend `BadRequestException`)
3. No duplicate WO Complete for same work order
4. All timesheets for the WO must be Approved or Rejected
5. **Production departments only:** WO must have a Full QC inspection

**Attachments:** Files stored in S3 (`woc/{wocId}/…`). Image attachments open in the `FileLightbox` preview; non-image files are downloaded. Preview is available in both the Edit modal and the View modal.

### QC Module

Routes: `/qc` (list) · `/qc/new` · `/qc/:id/edit` · `/qc/:id/view` · `/qc/:id/print`

**Layout:** Full-screen three-panel form (fills content area below the AppShell menu bar with zero padding). On screens ≤ 900px the form switches to a three-tab layout (Details / Checklist / Info).

**Mandatory fields:** Work Order, Quantity, Remarks, QC Inspector (auto-filled from logged-in user)

**Date restriction:** QC date must be today only (no past or future dates)

**Inspection Checklist (11 sections · 45 items):**
- Items start **blank** — the user must manually select **Pass**, **Fail**, or **N/A** for every item
- Unselected items are highlighted in amber with a "pending" badge
- Section header shows pending / pass / fail / N/A counts in real time
- Saving is blocked until every active item (in non-NA sections) has a selection
- Auto-status: stays *In Progress* while any item is unanswered; flips to *Passed* or *Failed* once all are filled
- Section N/A: mark an entire section not applicable with the "N/A Section" checkbox
- Desktop layout: 3-column grid (11 sections in 4 rows); tablet/mobile: single column

**Left panel compact layout:**
Fields are arranged in 2-column pairs to reduce vertical scrolling:
- QC Number + Date
- Project Name + Customer
- Quantity + Partial/Full
- Inspector + Status

**Image requirements:**
- Minimum 3 images required when setting status to **Passed**
- Maximum 10 images per record
- Images only (JPEG, PNG, WEBP, HEIC)
- Stored in S3: `dev/qc/{id}/{timestamp}-{filename}`

**Status flow:** `In Progress → Passed / Failed`
- Passed records cannot be downgraded
- Failed records can only be edited by approvers

**Attachments / Preview:** Image attachments open in the `FileLightbox` full-screen preview (click the 👁 button). Pending images (not yet saved) show a thumbnail that is also clickable. Non-image files are downloaded directly. The `FileLightbox` overlay supports Escape key, click-outside to close, and a Download button.

**Print:** `/qc/:id/print` — opens in new tab, generates high-quality PDF via jsPDF + html2canvas. Photos are loaded server-side as base64 data URIs (`GET /qc/attachments/:id/download`) to avoid S3 CORS restrictions that block html2canvas `useCORS`. Missing S3 objects show "Unavailable" instead of a spinner.

### Settings

| Route | Description |
|-------|-------------|
| `/settings/approvals` | Approval routing rules by department |
| `/settings/email` | SMTP/Graph config, notification rules, email log |
| `/settings/change-password` | Self-service password change |
| `/settings/sessions` | Active sessions viewer + force-logout (USERS.canRead) |
| `/settings/notifications` | Per-user notification type toggles (all users) |

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
| `PSTsLabourLine` | Labour entries per timesheet |
| `PSTsMaterialLine` | Consumed materials |
| `PSTsEquipmentLine` | Machinery / vehicle / access equipment lines (lineType: MACHINERY, VEHICLE, ACCESS) |
| `PsQcRecord` | QC inspection records |
| `PsQcAttachment` | QC photos (s3Key + fileData for legacy) |
| `PsQcComment` | QC comments (with authorUserId) |
| `PsTsProjLineAttachment` | Project Timesheet line attachments (s3Key or base64 fileData) |
| `PsWoComplete` | WO completion records |
| `PsWoCompleteAttachment` | WO attachments (s3Key or base64 fileData) |
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
| `PsNotifSeen` | Notification read state (userId, notifKey) |
| `PsNotifPreferences` | Per-user notification type preferences (userId, notifType, enabled) |

### Key Column: `PSTsHeader.entered_by_user_id`
Added in v3.2. Stores the creator's user ID for data scoping. Auto-migrated via `onModuleInit()` (`ALTER TABLE ... ADD ... NULL`). Existing records have NULL and are visible to all users until re-saved.

### Column Width: `PSTsMaterialLine.itemName`
Widened to `NVARCHAR(500)` in v3.3 via `onModuleInit()` migration. Columns narrower than 500 chars are auto-altered on startup to prevent "transaction aborted" / string-truncation errors when saving long item descriptions.

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

**Timesheets controller (v3.3):** Uses `TimesheetsService.assertPermission()` inline (not the decorator) because the module must be resolved dynamically from the request type (`PROD`/`INST`/`PROJ`). The `typeFromDocNo()` helper derives the module from the document number prefix (`TS-INST-*` → `INST`, `TS-PROJ-*` → `PROJ`, default `PROD`).

### Approval Authorization
Approve/Reject timesheets requires `canWrite` on PROD/INST/PROJ (checked via `isTimesheetApprover()` DB query, not hardcoded role names). Pending Approvals list is accessible to any role with `canWrite` on at least one timesheet type.

Approval Settings rules further restrict which specific user can approve which timesheet (by department, shift, project, WO criteria).

### Navigation Filtering
Frontend sidebar shows only links the user has `canRead` permission for. Backend enforces the same via permission guards independently.

### Shift Time Validation (v3.3)
On save, the Production and Installation timesheet forms validate that every labour row's start and end times fall within the selected shift's configured window. Overnight shifts (where `endTime < startTime`, e.g. 18:00–06:00) are handled correctly using wrap-around comparison.

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
- `presignedUrl(key, expiresIn=3600)` → returns signed URL (default 1 hour) — used for profile/employee photos only
- `getAsBase64(key, mimeType)` → fetches the S3 object server-side, returns a `data:{mimeType};base64,…` string. Used for all attachment downloads so the browser never makes a cross-origin request to S3 directly.
- `delete(key)` → removes object
- `isConfigured` → boolean, falls back to DB storage if false

### Upload Flow
```
Frontend (base64 dataURL)
  → POST /api/*/attachments { fileData, mimeType, fileName, fileSize }
  → Backend validates (≤5 MB for WOC/PROJ, image-only for QC)
  → S3Service.upload() → s3Key stored in DB, fileData = NULL
```

### Download Flow (Attachments — QC, WOC, Project Timesheet)
```
GET /api/*/attachments/:id/download  (or /api/*/attachments/:id)
  → If s3Key exists → S3Service.getAsBase64() fetches object server-side
    → returns { fileData: "data:image/jpeg;base64,…", fileName, mimeType }
  → Frontend renders as <img src> or opens FileLightbox (images)
    or triggers <a download> (non-images)
```

> **Why server-side proxy?** Browser `fetch()` to S3 presigned URLs is blocked by S3 CORS policy (no `Access-Control-Allow-Origin` header by default). html2canvas `useCORS: true` also fails for the same reason. Using `getAsBase64()` keeps the request server-to-server; the browser only ever sees a data URI.

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

### Full-Screen Page Pattern

Pages that need to fill the entire content area below the AppShell topbar (e.g., QC Form) use the following pattern:

**App.jsx** — route stays inside `<AppShell>` so the topbar remains visible:
```jsx
<Route path="qc/new" element={<QCFormPage />} />
```

**AppShell.jsx** — detect the route and zero out `main-content` padding:
```jsx
const location = useLocation();
const isFullBleed = /^\/qc\/(new|[^/]+(\/edit|\/view)?)$/.test(location.pathname);
// ...
<main className="main-content"
  style={isFullBleed ? { padding: 0, overflow: 'hidden' } : undefined}
>
```

**Page component** — outer div fills 100% of the (now padding-free) container:
```jsx
<div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
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

### FileLightbox Component

`frontend/src/components/ui/FileLightbox.jsx`

Full-screen overlay for previewing a single file attachment.

**Props:**
- `file: { src: string, name: string, mimeType: string }` — `src` must be a data URI (`data:image/...;base64,...`)
- `onClose` — called when the overlay, close button, or Escape key is used
- `onDownload?` — optional; when provided, a Download button is shown in the overlay

**Behaviour:**
- Images render at up to 90vw × 78vh with `object-fit: contain`
- Non-images show a file-icon placeholder with the filename
- Escape key and click-outside both close the overlay
- `zIndex: 10000` — renders above all modals

**Usage pattern:**
```jsx
import FileLightbox from '../../components/ui/FileLightbox';

const [lightbox, setLightbox] = useState(null);

// Open
setLightbox({ src: dataUri, name: fileName, mimeType });

// Render
{lightbox && (
  <FileLightbox
    file={lightbox}
    onClose={() => setLightbox(null)}
    onDownload={() => { const a = document.createElement('a'); a.href = lightbox.src; a.download = lightbox.name; a.click(); }}
  />
)}
```

Used in: **QCFormPage**, **ProjTimesheetPage** (`AttachCell`), **WocPage** (edit modal + view modal).

---

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

**Scroll behaviour:** Scrolling inside the dropdown list does **not** close it. Scrolling any ancestor (page, sidebar) closes it. Implemented via capture-phase scroll listener that checks `dropdownRef.current.contains(e.target)`.

**Portal:** Dropdown renders via `createPortal(…, document.body)` so it is never clipped by parent `overflow: hidden` containers. Position is `fixed` calculated from `getBoundingClientRect()`. Opens upward automatically when there is insufficient space below the trigger.

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
| GET | `/timesheets` | PROD/INST/PROJ.canRead (by type param) | List timesheets |
| GET | `/timesheets/pending-approvals` | canWrite on any PROD/INST/PROJ | Pending approvals list |
| GET | `/timesheets/ts-employees` | canRead on any PROD/INST/PROJ | Employee lookup |
| GET | `/timesheets/preview-docno` | type.canCreate | Preview next doc number |
| GET | `/timesheets/report-detail` | type.canReport | Detail report |
| GET | `/timesheets/report-summary` | type.canReport | Summary report |
| GET | `/timesheets/:docNo` | type.canRead (derived from docNo) | Get single timesheet |
| POST | `/timesheets` | body.tsType.canCreate | Create timesheet |
| PUT | `/timesheets/:docNo` | type.canWrite (derived from docNo) | Update timesheet |
| POST | `/timesheets/:docNo/submit` | type.canCreate (derived from docNo) | Submit for approval |
| POST | `/timesheets/weekly` | PROJ.canCreate | Create weekly project timesheet |
| POST | `/timesheets/batch` | batchType.canCreate | Batch create timesheets |
| DELETE | `/timesheets/:docNo` | type.canDelete (derived from docNo) | Delete timesheet |
| POST | `/timesheets/:docNo/approve` | canWrite permission | Approve timesheet |
| POST | `/timesheets/:docNo/reject` | canWrite permission | Reject timesheet |
| GET | `/qc` | QC.canRead | List QC records |
| POST | `/qc` | QC.canCreate | Create QC record |
| POST | `/qc/:id/attachments` | QC.canWrite | Upload QC photo |
| GET | `/qc/eligible-wos` | Authenticated | WOs with Full QC (for WOC) |
| GET | `/wo-complete` | WO_COMPLETE.canRead | List WO completions |
| POST | `/wo-complete` | WO_COMPLETE.canCreate | Create WO complete |
| GET | `/analytics` | REPORTS.canRead | Analytics data |
| GET | `/notifications` | Authenticated | User notifications (filtered by preferences) |
| PATCH | `/notifications/:key/read` | Authenticated | Mark one notification read |
| PATCH | `/notifications/read-all` | Authenticated | Mark all notifications read (atomic bulk insert) |
| GET | `/notifications/preferences` | Authenticated | Get per-user notification type toggles |
| PATCH | `/notifications/preferences` | Authenticated | Save per-user notification type toggles |
| GET | `/auth/sessions` | USERS.canRead | List active sessions |
| DELETE | `/auth/sessions/user/:userId` | USERS.canWrite | Force-logout a user |
| GET | `/auth/login-history` | USERS.canRead | Paginated login history |
| GET | `/auth/login-history/:userId` | USERS.canRead | Login history for a specific user |
| GET | `/work-orders/numbers` | Authenticated | Lightweight list of all WO numbers (search) |
| GET | `/search?q=` | Authenticated | Global search — timesheets, WOs, projects, employees, QC, WOC |
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
| No WebSocket notifications | Bell notifications poll every 60 seconds (background polling paused when tab is not focused) |
| S3 presigned URLs expire | Profile/employee images only: 24h TTL. Re-fetching regenerates. Attachment downloads use server-side `getAsBase64()` proxy — no expiry issue |
| WOC date filter is client-side | All WOC records are loaded then filtered in browser |
| QC date locked to today | By design — cannot backdate QC inspections |
| Analytics runs synchronously | Large date ranges may be slow for high-volume data |
| Email delivery confirmation | Only tracks SMTP acceptance, not actual inbox delivery |
| Unsaved-warning scope | `beforeunload` + Cancel/Back buttons guarded; clicking sidebar nav links without saving does NOT warn (requires router migration to `createBrowserRouter` to support `useBlocker`) |
| Role-scoped list — old records | Timesheets created before v3.2 have `entered_by_user_id = NULL` and are visible to all users; they will be scoped correctly once re-saved |

---

## Changelog

### v3.6 (July 2026)
Branding refresh, theme system expansion, and login page redesign.

**App renamed to OpsDesk**
- Application rebranded from "PS TimeSheet Pro" to **OpsDesk**
- Browser tab title updated (`index.html`): `PS TimeSheet` → `OpsDesk`
- Topbar brand name updated: `PS TimeSheet Pro` → `OpsDesk`, sub-line `BRI Professional Signs` → `Professional Signs`
- Login page wordmark updated: `TimesheetPro` / `Project Timesheet` → `OpsDesk`
- Footer copyright updated: `BRI Professional Signs` → `Professional Signs`

**Theme system — 3 new themes**
- **Light** (`data-theme="light"`): clean white/`#f2f2f7` backgrounds, near-black text, iOS-style bright mode; dark sidebar retained for contrast
- **Dark** (`data-theme="dark"`): deep `#0e0e12` background, `#1c1c24` card surfaces, light text, warmer amber accent tuned for dark backgrounds
- **Glass / Frosted** (`data-theme="glass"`): semi-transparent surfaces with `backdrop-filter: blur(24px) saturate(160%)` on topbar, sidebar, and cards; deep purple/teal mesh gradient body background for the frosted-glass iOS effect
- All three themes added to the `THEMES` array in `AppShell.jsx` and appear in the profile menu theme selector

**Login page — feature list update**
- Added **Project Timesheet** as a feature item ("Log hours against project codes")
- Hero subtitle updated to lead with "project timesheets": *"A unified platform for project timesheets, production tracking, installation scheduling, QC inspections, and management reporting."*

**Vite proxy fix**
- `vite.config.js` proxy target changed from `http://localhost:3000` to `http://127.0.0.1:3000` — fixes login failures caused by Node.js preferring IPv6 (`::1`) when resolving `localhost`, which was routing API calls to a different project's dev server on the same port

---

### v3.5 (June 2026)
Performance, notifications overhaul, settings pages, global search, and report fixes.

**Notifications — 10 new types**
All notification types are generated in `NotificationsService.getForUser()` and filtered per-user by the new preferences table:

| Type key | Description | Visible to |
|---|---|---|
| `pending_approvals` | Timesheets awaiting approval — digest (>3) or individual cards (≤3); red if any >48h | Privileged |
| `ts_approved` | Own timesheet approved in last 7 days | All users |
| `ts_rejected` | Own timesheet rejected in last 7 days, with reason | All users |
| `forgotten_drafts` | Draft timesheets >2 days old (top 3) | All users |
| `proj_missing` | No PROJ timesheet submitted by Wednesday of the current week | PROJ users |
| `qc_status` | QC record passed/failed in last 7 days | Inspector + Privileged |
| `qc_woc_eligible` | Full QC done but no WO Complete record yet (last 7 days, top 5) | Privileged |
| `woc_conflict` | WO marked complete but timesheets still in Draft/Submitted (last 30 days, top 3) | Privileged |
| `woc_new` | New WO Complete records created in last 7 days | Privileged |
| `login_failures` | ≥5 failed login attempts in the last hour | Admin only |

**Notification Preferences**
- New `PsNotifPreferences` table (auto-created on startup): `(userId, notifType, enabled)` with UNIQUE constraint
- `GET /notifications/preferences` — returns `{ [notifType]: boolean }`, all default `true`
- `PATCH /notifications/preferences` — upserts via MERGE; validates against known type list
- `getForUser()` loads prefs first and gates each of the 10 sections with `on(type)` check
- Settings → **Notifications** page (`/settings/notifications`): toggle rows per type with audience badge and description; Save/Reset buttons; visible to all users

**Mark-all-read rewrite**
- Replaced DELETE + N serial INSERTs with a single atomic bulk `INSERT … SELECT … WHERE NOT EXISTS`
- Frontend: `invalidateQueries` only fires inside `try` after the PATCH succeeds (not unconditionally)

**Settings — new pages**
- Settings → **Sessions** (`/settings/sessions`): existing `LoginHistoryPage` with Login History and Active Sessions tabs; accessible via USERS.canRead
- Settings → **Notifications** (`/settings/notifications`): new `NotificationSettingsPage` with per-type toggles

**Global Search fixes**
- Fixed `tsDocNo` column name (was `docNo` — silently returning no results)
- Fixed `department_code` column name (was `department`)
- Added QC Records group to search results (navigates to `/qc/:id/view`)
- Added WO Complete group to search results (navigates to `/woc`)
- Cross-entity search: searching by project ID or WO number now returns related timesheets, QC records, and WOC records
- Sub-labels show contextual metadata (project ID · WO number · status)

**Dashboard data fix**
- `entered_by_user_id` column name corrected (was `enteredByUserId`) — role users with `dataScope = 'Own'` were seeing all-zero counts
- Sargable date ranges: `YEAR()/MONTH()` replaced with explicit range predicates for `entryDate` (DATE column), and `TRY_CAST` approach for `qcDate` / `completedDate` (NVARCHAR columns)

**Performance improvements**
- **N+1 → batch lookups:** `insertLines()` now collects all employee codes and item codes before the loop, runs one `IN (…)` query each, builds a Map, and resolves from the Map — reduces timesheet save from N+2 DB round-trips to 2
- **Reference data caching:** `staleTime: 5 * 60 * 1000` added to all 9 reference queries in `InstTimesheetFormPage` and 8 in `ProdTimesheetFormPage`; all option arrays wrapped in `useMemo`
- **Session heartbeat throttle:** `validateSession` skips the `UPDATE lastActiveAt` if it was written within the last 5 minutes (reads the existing value, compares before writing)
- **HTTP cache headers:** removed global `Cache-Control: no-store` from the axios default headers; individual sensitive requests can still opt in
- **Background polling:** `refetchIntervalInBackground: false` added to the pending-approvals 60s poll (pauses when tab is not focused)
- **DB indexes:** 5 composite indexes applied (`backend/db/perf-indexes.sql`): `PSTsHeader(status, isDeleted)`, `PSTsHeader(entered_by_user_id)`, `PSTsHeader(entryDate)`, `PSTsLabourLine(tsId)`, `PsTsEquipmentLine(tsId)`
- **Sargable week query:** timesheet week filter changed from `CAST(h.entryDate AS DATE) >= ...` to an explicit range `h.entryDate >= … AND h.entryDate < …`

**Reports — Production Detail Report fixes**
- **Labour duration was always 0:** `insertLines()` read `lr.duration` but the form sends `lr.durationMinutes`; fixed to `lr.durationMinutes ?? lr.duration`. Existing records (already stored with `durationMinutes = 0`) are recovered by a SQL fallback: `ISNULL(NULLIF(durationMinutes, 0), DATEDIFF(MINUTE, TRY_CAST(startTime AS TIME), TRY_CAST(endTime AS TIME)))` in both the detail and summary report queries
- **Machinery / Vehicle / Access Equipment missing:** the UNION returned `lineType = 'MACHINERY' / 'VEHICLE' / 'ACCESS'` but the frontend only checked for `'EQUIPMENT'`; all three types now recognised with correct labels and units (`X min`, `X km`, `Xh`)
- Equipment Lines summary card now counts all three equipment subtypes

**Work Orders**
- New `GET /work-orders/numbers` endpoint: lightweight UNION of work order numbers from both ERP tables, no joins — used by global search

**Bug fixes**
- `entered_by_user_id` corrected in notification approved/rejected queries (was `enteredByUserId`)
- Notification toggle page: removed `disabled` on toggles for non-applicable role types — all users can freely enable/disable any preference

---

### v3.4 (June 2026)
Feature and bug-fix release: S3 image proxy, future date guards, attachment preview everywhere.

**Dashboard**
- **Timesheet count fix:** Dashboard now counts timesheets for users who have `canCreate` but not `canRead` (permission query changed from `canRead = 1` to `canRead = 1 OR canCreate = 1`).

**S3 — Server-side proxy**
- Added `S3Service.getAsBase64(key, mimeType)` that fetches S3 objects server-to-server and returns a `data:…;base64,…` string. All attachment download endpoints now use this instead of presigned URLs.
- Fixes QC print page: photos were previously returned as S3 presigned URLs which the browser could not fetch cross-origin (S3 CORS blocks `fetch()`); html2canvas `useCORS: true` also failed for the same reason. Base64 data URIs are rendered natively.
- QC print: missing/deleted S3 objects now show "Unavailable" instead of hanging on "Loading…".

**Projects Team Timesheet — future date guard**
- Date picker `max` capped at today's date.
- Weekly form: ▶ (advance week) button disabled when already on the current week.
- Future day tabs in the weekly view are dimmed, non-clickable, and show a tooltip ("Cannot enter timesheets for future dates").
- Active day snaps to the last non-future day when the selected week changes.
- Backend: saving a line with a future date returns `BadRequestException`.

**Projects Team Timesheet — line attachments**
- New table `PsTsProjLineAttachment` with `s3Key NVARCHAR(500)` column (auto-migrated via `onModuleInit()`).
- Files upload to S3 under `proj-ts/{tsId}/…` when S3 is configured; stored as base64 in `fileData` column otherwise.
- `S3Module` added to `TimesheetsModule` imports.

**WO Complete — future date guard**
- Completion date picker `max` capped at today (local timezone, not UTC).
- Frontend `handleSubmit` blocks save with a toast if date > today.
- Backend `assertWocFields()` throws `BadRequestException('Completion date cannot be a future date.')`.

**Approval Settings — UserPicker dropdown**
- Dropdown rendered via `ReactDOM.createPortal` to `document.body` so it is no longer clipped by the modal's `overflow-y: auto` container. Position computed from `getBoundingClientRect()` on open.

**Attachment Preview — FileLightbox (all modules)**
- New shared component `frontend/src/components/ui/FileLightbox.jsx`: full-screen overlay with Escape/click-outside to close, image display (`max 90vw × 78vh`), file-icon fallback for non-images, optional Download button.
- **QC Form:** Pending image thumbnails are now clickable (zoom-in preview). Saved image attachments show a 👁 button that opens the lightbox; non-image saved attachments keep the ↓ download button.
- **Project Timesheet (AttachCell):** New unsaved images show a 36×28 thumbnail; clicking it opens the lightbox. Saved image attachments show a 👁 button; non-images show a file icon and trigger download.
- **WO Complete (Edit modal + View modal):** Saved image attachments show a 👁 button that opens the lightbox with a Download button; non-images show ↓ to download directly.

### v3.3 (June 2026)
Bug-fix and security release covering Installation timesheet, QC print, and backend permission enforcement.

**Installation & Production Timesheet**
- **Department dropdown fix:** filter now checks both `mainDepartment` and `departmentCode` for `install`/`produc` prefix so abbreviated ERP codes (e.g. "INST") are correctly matched; dropdown no longer appears empty.
- **Shift dropdown — Active only:** shift list filtered to `status === 'Active'` entries; inactive/retired shifts no longer appear.
- **Shift time window validation:** on save, every labour row's start and end times are checked against the selected shift's configured window; overnight shifts (end < start) handled with wrap-around comparison; save is blocked with a toast if times fall outside the shift window.
- **Same start/end time guard:** save blocked if a labour row has identical start and end times.
- **Qty required:** save blocked if a material row is added without a quantity.

**QC Module**
- **Print — N/A count fix:** N/A item count in the printed summary was always 0 because `activeSections` already excluded N/A sections before counting. Fixed by computing `naCount` directly from `QC_SECTIONS` filtered by `snNA`.

**Backend — Database**
- **`PSTsMaterialLine.itemName` column widened:** auto-altered to `NVARCHAR(500)` on startup via `onModuleInit()` migration if the column is narrower than 500 chars. Fixes "transaction aborted / string-truncation" errors when saving long item descriptions.

**Backend — Security**
- **Timesheets controller permission guards:** all 16 timesheet API routes now call `assertPermission()` before executing. Previously, any authenticated user could call any endpoint regardless of role. Module is resolved dynamically from the request (PROD/INST/PROJ) using `typeFromDocNo()` and `typeToModule()`.
- **Pending Approvals guard fix:** guard now uses `isTimesheetApprover()` (checks canWrite on any of PROD/INST/PROJ) instead of `PROD.canWrite`; Installation Lead role (INST.canWrite only) can now access the pending approvals list correctly.

**Role Permissions**
- **ROLE-009 (QC Inspector):** removed erroneous `SHIFTS.canWrite` permission.
- **ROLE-010 (Viewer):** removed erroneous `VEHICLES.canDelete` permission.

### v3.2 (June 2026)
Bug-fix release from manual QA testing (44 items reviewed).

**Timesheet — Production & Installation**
- **#27 Unsaved-form warning:** Cancel and Back buttons now show a `confirm()` dialog when the form has unsaved changes. `beforeunload` also fires on browser close/refresh.
- **#10 Empty labour guard:** save blocked if no employee row is filled.
- **#12 Duplicate entry guard:** save blocked if the same employee + time slot appears twice.
- **#13 Overlapping time guard:** save blocked if two rows for the same employee have overlapping start/end times.
- **#15 Future date guard:** date field capped at today (`max` attribute + server-side check).
- **#31 Edit button role check:** Submitted timesheets show the Edit button only to users with the `canReport` permission (approvers).
- **#19/#20 Edit form data loss (Installation):** fixed field-name mismatch in the load `useEffect`; `itemName`, `equipmentName`, and `hoursUsed` DB columns now map correctly so material descriptions, vehicle plates, vehicle KM, and access equipment restore correctly on edit.
- **Dept filter:** Production timesheet only shows production departments; Installation only shows installation departments.

**QC Module**
- **#44 Photo mandatory:** save/submit blocked with a toast if no photo has been attached. Applies to both pending uploads and already-uploaded files.
- **#43 Delete guard after comments:** `DELETE /qc/:id` now returns `403` if the record has any comments and the requesting user is not an Admin/Manager/Supervisor.

**Global**
- **#8/#9 Role-based data scope:** `PSTsHeader` now stores `entered_by_user_id`. The `/timesheets` list endpoint scopes results to the requesting user's own records unless the user has `canReport` / is Admin/Manager/Supervisor. Records created before v3.2 (NULL `entered_by_user_id`) remain visible to all users.

**SearchSelect**
- **#32 Multi-word search:** filter changed from `token.startsWith(query)` to `.includes(query)` — searching "triple bay" now finds "Triple Bay Sign".
- **Dropdown last-item clipping:** `DROPDOWN_MAX_H` increased from 240 → 260 px; added `padding-bottom: 4px` to the list so the last item is never clipped.

**Project Timesheet**
- **#34 Task Type mapping:** `taskType` field correctly round-trips from `shiftCode` DB column on load.

### v3.1 (June 2026)
- **QC Form — full-screen layout:** form fills the full content area below the AppShell menu bar; `main-content` padding zeroed on QC form routes via `useLocation` in AppShell
- **QC Form — responsive layout:** screens ≤ 900px switch to a three-tab layout (Details / Checklist / Info) using React `window.innerWidth` state (no CSS-only selector dependency)
- **QC Checklist — no default selection:** all items start blank; user must manually choose Pass, Fail, or N/A for every item; amber highlight + "pending" badge for unanswered items; save blocked until all active items are filled
- **QC Checklist — 3-column desktop grid:** 11 sections now display in 3 columns (4 rows) instead of 2 columns (6 rows), significantly reducing scrolling
- **QC Left panel — compact 2-column field pairs:** QC No + Date, Project Name + Customer, Qty + Partial/Full, Inspector + Status displayed side-by-side; summary replaced with a compact 3×2 tile grid
- **SearchSelect — scroll fix:** scrolling inside the dropdown list no longer closes it; only ancestor/page scroll closes the dropdown
- **Auto-status logic:** status stays *In Progress* while any checklist item is unanswered; only resolves to *Passed*/*Failed* when all items have been answered

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
