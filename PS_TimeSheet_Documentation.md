# PS TimeSheet — Technical Documentation

**Version:** 1.0  
**Date:** May 2026  
**Prepared by:** Development Team  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Database — Dev DB Tables](#3-database--dev-db-tables)
4. [Database — Live ERP Tables (Read-Only)](#4-database--live-erp-tables-read-only)
5. [Authentication & Session Management](#5-authentication--session-management)
6. [User Management](#6-user-management)
7. [Role & Permission System](#7-role--permission-system)
8. [Timesheet Modules](#8-timesheet-modules)
9. [Master Data Modules](#9-master-data-modules)
10. [Work Order Completion (WOC)](#10-work-order-completion-woc)
11. [Department Profile Management](#11-department-profile-management)
12. [Reports](#12-reports)
13. [System Settings](#13-system-settings)
14. [Frontend Architecture](#14-frontend-architecture)
15. [API Reference](#15-api-reference)
16. [Validations](#16-validations)
17. [Business Rules & Formulas](#17-business-rules--formulas)
18. [Hardcoded Configuration Values](#18-hardcoded-configuration-values)
19. [Email Notification System](#19-email-notification-system)
20. [Audit Trail](#20-audit-trail)

---

## 1. System Overview

PS TimeSheet is an internal operations management system for ProSigns. It provides:

- **Production & Installation Timesheets** — daily labour and material records for field teams
- **Projects Team Timesheets** — weekly/daily time logs for the Projects department
- **Work Order Completion (WOC)** — formal completion records linked to work orders
- **Master Data** — read-only views of live ERP data (employees, departments, items, etc.)
- **User & Role Management** — access control with module-level permissions
- **Reports** — CSV export of timesheet detail and summary data

**Technology Stack:**

| Layer | Technology |
|---|---|
| Backend | NestJS (Node.js), TypeScript |
| Database | Microsoft SQL Server (MSSQL) |
| Frontend | React 18 (Vite), React Router v6, Zustand, React Query |
| Auth | Session token (Bearer), bcrypt password hashing (cost 12) |
| File Storage | Local filesystem (WOC attachments) |

---

## 2. Architecture

### Two Database Connections

The system connects to two separate SQL Server databases simultaneously:

| Pool | Env Variable | Usage |
|---|---|---|
| `SQL_POOL` (Live/ERP) | `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Read-only master data from ERP system |
| `DEV_SQL_POOL` (Dev/PS) | `DEV_DB_SERVER`, `DEV_DB_NAME`, `DEV_DB_USER`, `DEV_DB_PASSWORD` | All timesheet data, users, roles, PS-specific tables |

> **Important:** The two databases are on different servers. No cross-database JOINs are possible. When data from both is needed (e.g. department profiles merged with ERP departments), each pool is queried separately and results are merged in TypeScript.

### Request Flow

```
Browser → GET/POST /api/* 
  → AuthGuard (validates Bearer token against PSTsSessions)
  → Controller → Service → MSSQL
  → JSON response
```

All endpoints except `POST /api/auth/login` require a valid session token.

---

## 3. Database — Dev DB Tables

All tables below live in the **Dev (PS)** database unless stated otherwise.

---

### PSTsUsers

Stores application user accounts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `userId` | NVARCHAR(30) | PK | Format: `USR-0001`, auto-incremented |
| `username` | NVARCHAR(50) | UNIQUE NOT NULL | Login username |
| `displayName` | NVARCHAR(100) | NOT NULL | Full name shown in UI |
| `passwordHash` | NVARCHAR(255) | NOT NULL | bcrypt hash (cost 12). Legacy accounts may still hold SHA-256 hex until next login/reset. |
| `roleCode` | NVARCHAR(30) | FK → PSTsRoles | Assigned role |
| `email` | NVARCHAR(150) | NULL | Contact email |
| `phone` | NVARCHAR(30) | NULL | Contact phone |
| `status` | NVARCHAR(10) | DEFAULT 'Active' | `Active` or `Inactive` |
| `mustChangePassword` | BIT | DEFAULT 0 | Forces password change on next login |
| `employeeCode` | NVARCHAR(30) | NULL | Links to ERP employee (`ErpMasterEmployee.employeeCode`) |
| `departmentCode` | NVARCHAR(30) | NULL | User's department for Projects Team auto-fill |
| `createdAt` | DATETIME | DEFAULT GETDATE() | Creation timestamp |
| `updatedAt` | DATETIME | DEFAULT GETDATE() | Last update timestamp |

**Auto-ID Logic:** `MAX(numeric part of userId) + 1`, zero-padded to 4 digits. E.g. if max is `USR-0012`, next is `USR-0013`.

---

### PSTsSessions

Active login sessions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `sessionToken` | NVARCHAR(64) | PK | 32-byte random hex (64 chars) |
| `userId` | NVARCHAR(30) | FK → PSTsUsers | Session owner |
| `createdAt` | DATETIME | DEFAULT GETDATE() | Login time |
| `expiresAt` | DATETIME2 | NOT NULL | Login time + 8 hours |
| `lastActiveAt` | DATETIME | DEFAULT GETDATE() | Bumped on every authenticated request |
| `isActive` | BIT | DEFAULT 1 | Set to 0 on logout or force-logout |
| `loggedOutAt` | DATETIME | NULL | Logout timestamp |
| `ipAddress` | NVARCHAR(45) | NULL | Client IP |
| `userAgent` | NVARCHAR(500) | NULL | Browser user agent string |

---

### PSTsLoginHistory

Audit log of all login attempts (successful and failed).

| Column | Type | Description |
|---|---|---|
| `id` | INT IDENTITY | Auto-increment PK |
| `userId` | NVARCHAR(30) | NULL if username not found |
| `username` | NVARCHAR(50) | Attempted username |
| `attemptAt` | DATETIME | DEFAULT GETDATE() |
| `success` | BIT | 1 = success, 0 = failed |
| `ipAddress` | NVARCHAR(45) | Client IP |
| `userAgent` | NVARCHAR(500) | Browser string |
| `city` | NVARCHAR(100) | Geo-lookup city |
| `country` | NVARCHAR(100) | Geo-lookup country |
| `failReason` | NVARCHAR(200) | NULL on success |
| `sessionToken` | NVARCHAR(64) | Set on success, links to PSTsSessions |

---

### PSTsFailedAttempts

Tracks failed attempts for lockout enforcement.

| Column | Type | Description |
|---|---|---|
| `id` | INT IDENTITY | PK |
| `username` | NVARCHAR(50) | Attempted username |
| `ipAddress` | NVARCHAR(45) | Client IP |
| `attemptAt` | DATETIME | DEFAULT GETDATE() |

**Lockout rule:** If 5 or more failed attempts within 15 minutes (by username OR IP), the next attempt is blocked.

---

### PSTsPasswordHistory

Stores hashed previous passwords to prevent reuse.

| Column | Type | Description |
|---|---|---|
| `id` | INT IDENTITY | PK |
| `userId` | NVARCHAR(30) | FK → PSTsUsers |
| `passwordHash` | NVARCHAR(255) | bcrypt or SHA-256 hash (same format as PSTsUsers) |
| `changedAt` | DATETIME | DEFAULT GETDATE() |

**Policy:** Last 3 passwords are retained. New password must not match any of them.

---

### PSTsRoles

Role definitions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `roleCode` | NVARCHAR(30) | PK | Format: `ROLE-001`, auto-incremented |
| `roleName` | NVARCHAR(100) | NOT NULL | Display name |
| `deptScope` | NVARCHAR(30) | DEFAULT 'All' | Department scope (informational) |
| `dataScope` | NVARCHAR(10) | DEFAULT 'All' | Data visibility scope |
| `status` | NVARCHAR(10) | DEFAULT 'Active' | `Active` or `Inactive` |
| `createdAt` | DATETIME | DEFAULT GETDATE() | |
| `updatedAt` | DATETIME | DEFAULT GETDATE() | |

**Auto-ID Logic:** `MAX(numeric part of roleCode) + 1`, zero-padded to 3 digits.

---

### PSTsRolePermissions

Per-module permissions for each role.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INT IDENTITY | PK | |
| `roleCode` | NVARCHAR(30) | FK → PSTsRoles | |
| `module` | NVARCHAR(50) | NOT NULL | Module name — must match PERM_MODULE list |
| `canCreate` | BIT | DEFAULT 0 | Can create new records |
| `canRead` | BIT | DEFAULT 0 | Can view the module / page |
| `canWrite` | BIT | DEFAULT 0 | Can edit existing records |
| `canDelete` | BIT | DEFAULT 0 | Can delete records |
| `canReport` | BIT | DEFAULT 0 | Can export reports |

**Upsert pattern:** MERGE on `(roleCode, module)` — insert if new, update if exists.

**Valid module names (must be exact):**

| Group | Module |
|---|---|
| General | `Dashboard` |
| Timesheets | `Production Timesheets`, `Installation Timesheets`, `Projects Team`, `WO Complete` |
| Master Data | `Employee Master`, `Department Master`, `Item Master`, `Machinery Master`, `Vehicle Master`, `Access Equipment`, `Project Master`, `Work Orders`, `Task Type Master` |
| Reporting | `Reports`, `Audit Trail` |
| Settings | `Document Numbering`, `Shift Setup` |
| Access Control | `User Management`, `Role Management`, `Login History`, `Active Sessions` |

---

### PSTsHeader

Timesheet header record — one row per timesheet document.

| Column | Type | Description |
|---|---|---|
| `tsDocNo` | NVARCHAR(30) | PK. Auto-generated. Format: `PS-PROD-YYYYMM-NNN`, `PS-INST-YYYYMM-NNN`, `PS-PROJ-YYYYMM-NNN` |
| `tsType` | NVARCHAR(10) | `PROD`, `INST`, or `PROJ` |
| `entryDate` | DATE | Timesheet date |
| `projectId` | INT | FK → ErpMasterProject |
| `projectName` | NVARCHAR(200) | Denormalised project name |
| `workOrderNo` | NVARCHAR(50) | Work order number |
| `department_code` | NVARCHAR(50) | Department code selected on timesheet |
| `shift_code` | NVARCHAR(30) | FK → PSTsShifts |
| `entered_by_name` | NVARCHAR(100) | Display name of person who entered the record |
| `status` | NVARCHAR(20) | `Draft`, `Submitted`, `Approved`, `Rejected` |
| `submittedAt` | DATETIME | NULL until submitted |
| `approvedAt` | DATETIME | NULL until approved |
| `approvedBy` | NVARCHAR(100) | Name of approver |
| `rejectedAt` | DATETIME | NULL unless rejected |
| `rejectionReason` | NVARCHAR(500) | NULL unless rejected |
| `isDeleted` | BIT | DEFAULT 0. Soft delete |
| `createdAt` | DATETIME | DEFAULT GETDATE() |
| `updatedAt` | DATETIME | DEFAULT GETDATE() |

**Document Number Format:**  
`PS-{TYPE}-{YYYYMM}-{NNN}` where NNN is the sequence for that type+month, zero-padded to 3 digits.  
Example: `PS-PROD-202605-001`

---

### PSTsLabourLines

Labour entries attached to a timesheet header.

| Column | Type | Description |
|---|---|---|
| `id` | INT IDENTITY | PK |
| `tsDocNo` | NVARCHAR(30) | FK → PSTsHeader |
| `employeeCode` | NVARCHAR(30) | ERP employee code |
| `employeeName` | NVARCHAR(100) | Denormalised employee name |
| `taskType` | NVARCHAR(50) | Task description |
| `startTime` | NVARCHAR(5) | HH:MM format |
| `endTime` | NVARCHAR(5) | HH:MM format |
| `duration` | NVARCHAR(5) | Calculated: endTime − startTime (HH:MM) |
| `overtime` | NVARCHAR(5) | Overtime hours (HH:MM) |
| `remarks` | NVARCHAR(500) | Free text |

---

### PSTsMaterialLines

Material entries attached to a timesheet header.

| Column | Type | Description |
|---|---|---|
| `id` | INT IDENTITY | PK |
| `tsDocNo` | NVARCHAR(30) | FK → PSTsHeader |
| `itemCode` | NVARCHAR(50) | ERP item code |
| `itemName` | NVARCHAR(200) | Denormalised item name |
| `quantity` | DECIMAL(18,3) | Quantity used |
| `uom` | NVARCHAR(20) | Unit of measure |
| `description` | NVARCHAR(500) | Item description |

---

### PSTsMachineryLines

Machinery/equipment used entries attached to a timesheet header.

| Column | Type | Description |
|---|---|---|
| `id` | INT IDENTITY | PK |
| `tsDocNo` | NVARCHAR(30) | FK → PSTsHeader |
| `machineryId` | NVARCHAR(30) | ERP machinery ID |
| `machineryName` | NVARCHAR(100) | Denormalised name |
| `startTime` | NVARCHAR(5) | HH:MM |
| `endTime` | NVARCHAR(5) | HH:MM |
| `duration` | NVARCHAR(5) | Calculated HH:MM |

---

### PSTsAccessEquipmentLines

Access equipment used (scissor lift, boom lift, etc.) attached to timesheet.

| Column | Type | Description |
|---|---|---|
| `id` | INT IDENTITY | PK |
| `tsDocNo` | NVARCHAR(30) | FK → PSTsHeader |
| `equipmentName` | NVARCHAR(100) | Equipment type name |
| `quantity` | INT | Number of units |
| `duration` | NVARCHAR(5) | HH:MM |

---

### PSTsVehicleLines

Vehicles used entries.

| Column | Type | Description |
|---|---|---|
| `id` | INT IDENTITY | PK |
| `tsDocNo` | NVARCHAR(30) | FK → PSTsHeader |
| `vehicleId` | NVARCHAR(30) | FK → PSTsVehicles |
| `vehicleName` | NVARCHAR(100) | Denormalised |
| `purpose` | NVARCHAR(200) | Usage description |
| `startTime` | NVARCHAR(5) | HH:MM |
| `endTime` | NVARCHAR(5) | HH:MM |

---

### PSTsProjLabourLines

Labour lines for Projects Team timesheets (different structure from PROD/INST).

| Column | Type | Description |
|---|---|---|
| `id` | INT IDENTITY | PK |
| `tsDocNo` | NVARCHAR(30) | FK → PSTsHeader |
| `employeeCode` | NVARCHAR(30) | ERP employee code |
| `employeeName` | NVARCHAR(100) | Denormalised |
| `monday` through `sunday` | NVARCHAR(5) | HH:MM hours per day (weekly format) |
| `totalHours` | NVARCHAR(5) | Sum across all days |
| `taskDescription` | NVARCHAR(200) | |
| `remarks` | NVARCHAR(500) | |

---

### PSDepartmentProfile

PS overrides for ERP departments. Does not modify ERP data.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `departmentId` | INT | PK | Matches `ErpMasterDepartment.departmentId` |
| `mainDepartmentOverride` | NVARCHAR(100) | NULL | Override for parent department name |
| `isActive` | BIT | NOT NULL DEFAULT 1 | 0 = hide from timesheet dropdowns |
| `updatedAt` | DATETIME | DEFAULT GETDATE() | |
| `updatedBy` | NVARCHAR(100) | NULL | Display name of user who last edited |

**Migration logic (runs on startup):**  
If the table exists with old `departmentCode` primary key (but no `departmentId` column), the table is dropped and recreated with `departmentId` as PK. This ensures uniqueness — `departmentCode` is not unique in ERP (e.g. "Digital" exists three times with different IDs).

---

### PsTsDocNumbering

Document numbering configuration.

| Column | Type | Description |
|---|---|---|
| `tsType` | NVARCHAR(10) | PK. `PROD`, `INST`, or `PROJ` |
| `prefix` | NVARCHAR(20) | E.g. `PS-PROD` |
| `nextSeq` | INT | Current sequence counter (auto-incremented on each issue) |
| `updatedAt` | DATETIME | |

---

### PSTsShifts

Shift definitions used in timesheet header.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `shiftCode` | NVARCHAR(30) | PK (stored uppercase) | E.g. `MORNING`, `EVENING` |
| `shiftName` | NVARCHAR(100) | NOT NULL | Display name |
| `startTime` | NVARCHAR(5) | HH:MM | Shift start |
| `endTime` | NVARCHAR(5) | HH:MM | Shift end |
| `graceMinutes` | INT | 0–180 | Allowable late minutes |
| `status` | NVARCHAR(10) | `Active`/`Inactive` | |
| `createdAt` | DATETIME | | |
| `updatedAt` | DATETIME | | |

---

### PsTsVehicles (PSTsVehicles)

PS-managed vehicle registry.

| Column | Type | Description |
|---|---|---|
| `vehicleId` | NVARCHAR(30) | PK. Format: `VEH-0001` |
| `plateNumber` | NVARCHAR(30) | Vehicle registration |
| `vehicleType` | NVARCHAR(50) | Type/model |
| `status` | NVARCHAR(10) | `Active`/`Inactive` |
| `createdAt` | DATETIME | |
| `updatedAt` | DATETIME | |

---

### PsWoComplete

Work Order Completion records.

| Column | Type | Description |
|---|---|---|
| `id` | INT IDENTITY | PK |
| `docNo` | NVARCHAR(30) | Auto-generated. Format: `PS-WOC-YYYYMM-NNN` |
| `completedDate` | DATE | Completion date |
| `projectId` | INT | FK → ErpMasterProject |
| `projectName` | NVARCHAR(200) | Denormalised |
| `workOrderNumber` | NVARCHAR(50) | Associated work order |
| `department` | NVARCHAR(100) | Main department (from dropdown) |
| `customerName` | NVARCHAR(200) | Customer name |
| `status` | NVARCHAR(50) | E.g. `WO Completed`, `Data Entry Completed` |
| `remarks` | NVARCHAR(1000) | Free text |
| `enteredBy` | NVARCHAR(100) | User display name |
| `createdAt` | DATETIME | |
| `updatedAt` | DATETIME | |

---

### PsWoCompleteAttachments

File attachments for WOC records.

| Column | Type | Description |
|---|---|---|
| `id` | INT IDENTITY | PK |
| `wocId` | INT | FK → PsWoComplete |
| `originalName` | NVARCHAR(255) | Original filename |
| `storedName` | NVARCHAR(255) | Filename on disk (UUID-based) |
| `mimeType` | NVARCHAR(100) | MIME type |
| `sizeBytes` | INT | File size |
| `uploadedAt` | DATETIME | DEFAULT GETDATE() |

---

### PsTsApprovalSettings

Approval routing configuration per timesheet type.

| Column | Type | Description |
|---|---|---|
| `id` | INT IDENTITY | PK |
| `tsType` | NVARCHAR(10) | `PROD`, `INST`, or `PROJ` |
| `approverName` | NVARCHAR(100) | Designated approver name |
| `approverEmail` | NVARCHAR(150) | For email notifications |
| `isActive` | BIT | DEFAULT 1 |

---

### PsTsEmailSettings / PsTsEmailNotificationRules / PsTsEmailTemplates / PsTsEmailLog

Email configuration tables for notification system. See [Section 19](#19-email-notification-system).

---

## 4. Database — Live ERP Tables (Read-Only)

These tables are in the live ERP database. The system **never writes** to them.

| Table | Description | Key Columns Used |
|---|---|---|
| `ErpMasterDepartment` | All company departments | `departmentId`, `departmentCode`, `parentDepartmentId`, `isActive` |
| `ErpMasterEmployee` | All employees | `employeeCode`, `employeeName`, `departmentCode`, `email`, `phone`, `designation`, `isActive`, `isDeleted` |
| `ErpMasterItem` | Item/material master | `itemcode`, `itemName`, `description`, `uomId`, `subsidiaryId`, `isActive` |
| `ErpMasterTaxnomy` | Units of measure | `taxnomyId`, `taxnomyCode` (UOM code) |
| `ErpMasterSubsidiary` | Company subsidiaries | `subsidiaryId`, `subsidiaryCode` |
| `ErpMasterMachinery` | Machinery master | `machineryId`, `machineryCode`, `machineryName`, `subsidiaryId`, `isActive` |
| `ErpMasterAccessEquipment` | Access equipment master | `equipmentId`, `equipmentName`, `isActive` |
| `ErpMasterProject` | Projects | `projectId`, `projectCode`, `projectName`, `subsidiaryId`, `isActive`, `isDeleted` |
| `ErpOperationWorkOrder` | Production work orders | `workOrderNo`, `projectId`, `status` |
| `erpinstallationworkorder` | Installation work orders | `workOrderNo`, `projectId`, `status` |
| `ErpMasterTaskType` | Task type definitions | `taskTypeId`, `taskTypeName`, `isActive` |

---

## 5. Authentication & Session Management

### Login Flow

1. Client sends `POST /api/auth/login` with `{ username, password, city?, country? }`
2. Server looks up user by username in `PSTsUsers`
3. Checks `PSTsFailedAttempts` — if ≥ 5 failures in last 15 minutes (by username OR IP) → **locked out**
4. Verifies password against stored hash via `checkPassword()` (see Password Hashing below)
5. Checks `user.status === 'Active'`
6. Creates session: inserts into `PSTsSessions` with `expiresAt = now + 8 hours`
7. Logs to `PSTsLoginHistory`
8. Returns: `{ token, expiresAt, mustChangePassword, user: { userId, username, displayName, roleCode } }`

### Session Validation (every authenticated request)

- Reads `Authorization: Bearer <token>` header
- Queries `PSTsSessions JOIN PSTsUsers WHERE sessionToken = @token`
- Checks `isActive = 1` AND `expiresAt > NOW()`
- On success: bumps `lastActiveAt = GETDATE()`
- On failure: throws 401 Unauthorized

### Session Duration

- **8 hours** from login time
- `lastActiveAt` is updated but does NOT extend expiry

### Lockout Policy

| Setting | Value |
|---|---|
| Max failed attempts | 5 |
| Lockout window | 15 minutes |
| Lockout scope | username OR IP address |
| Message shown | "Account locked. Try again in 15 minutes." |

### Active Sessions

`GET /api/auth/sessions` returns all active sessions. Each row includes a server-computed `isCurrent` boolean — `true` only for the session making the request. Raw session tokens are **never** returned to the frontend.

Admins can terminate all sessions for a specific user:

```
DELETE /api/auth/sessions/user/:userId
```

### Password Expiry

- Password expiry is calculated as **last password change + 90 days**
- Shown on dashboard as a warning (red if ≤ 7 days, amber if ≤ 30 days)
- No automatic enforcement — informational only

---

## 6. User Management

### User ID Format

`USR-XXXX` — auto-incremented from MAX existing numeric suffix + 1.

### Password Policy (enforced on create, update, reset, change-password)

| Rule | Requirement |
|---|---|
| Minimum length | 8 characters |
| Uppercase | At least 1 uppercase letter (A–Z) |
| Lowercase | At least 1 lowercase letter (a–z) |
| Number | At least 1 digit (0–9) |
| Special character | At least 1 of `!@#$%^&*` etc. |
| No spaces | Spaces not allowed |
| No username | Password must not contain the username (case-insensitive) |
| History | Must not match any of the last 3 passwords |

### Password Hashing

Passwords are stored as **bcrypt hashes** (cost 12). `checkPassword()` also accepts legacy SHA-256 formats (lowercase hex, uppercase hex, `0x`-prefixed, base64) to allow accounts created before the bcrypt migration to keep working transparently.

New passwords set via create, update, reset, or change-password are always stored as bcrypt.

### Password Reset (Admin)

Admin can reset any user's password via the UI. The system:
1. Generates a 10-character random temp password (includes upper, lower, digit, special)
2. Hashes it with bcrypt and stores it
3. Sets `mustChangePassword = 1`
4. Returns the temp password to the admin to share with the user
5. On next login, user is prompted to change password

### Emergency Password Reset (Direct SQL)

If a user is locked out and the UI is not accessible:

```javascript
// 1. Generate hash in Node
const bcrypt = require('bcrypt');
console.log(bcrypt.hashSync('NewPassword123!', 12));
```

```sql
-- 2. Clear lockout
DELETE FROM PSTsFailedAttempts WHERE username = 'theusername';

-- 3. Set new password
UPDATE PSTsUsers
SET passwordHash = '$2b$12$<hash>'
WHERE username = 'theusername';
```

### User Fields

| Field | Notes |
|---|---|
| `employeeCode` | Links to ERP `ErpMasterEmployee.employeeCode`. Used for Projects Team auto-fill |
| `departmentCode` | User's department. Not yet used for access filtering |

---

## 7. Role & Permission System

### Role Code Format

`ROLE-XXX` — auto-incremented from MAX existing numeric suffix + 1.

### Role Fields

| Field | Values | Notes |
|---|---|---|
| `deptScope` | Any string, default `All` | Informational only, not enforced by code |
| `dataScope` | `All` or specific value | Read by frontend as `window._userDataScope` |
| `status` | `Active` / `Inactive` | Inactive roles still work — no enforcement |

### How Permissions Are Enforced

**Frontend + Backend.** Admin endpoints (login history, active sessions, user management, role management) are protected on the backend by `PermissionGuard` + `@RequirePermission`. Permission enforcement for navigation and UI:

1. On dashboard load: `GET /api/auth/permissions` returns `{ permissions[], dataScope }`
2. `canRead(module)` function checks if user's role has `canRead = true` for that module
3. Dashboard **quick-links** are filtered — only modules with `canRead` appear
4. **Sidebar navigation** is NOT filtered by permission
5. Hardcoded check: editing a timesheet with status `Approved` requires `roleCode === 'ROLE-001'`

### Permission Flags

| Flag | Controls |
|---|---|
| `canRead` | Whether the module link appears on dashboard quick-links |
| `canCreate` | Used in Role Management UI display only |
| `canWrite` | Used in Role Management UI display only |
| `canDelete` | Used in Role Management UI display only |
| `canReport` | Used in Role Management UI display only |

> **Note:** Only `canRead` is actively checked in the frontend logic. The other flags (`canCreate`, `canWrite`, `canDelete`, `canReport`) are stored and displayed in Role Management but not yet enforced in the UI.

### Role Delete Guard

A role cannot be deleted if it has any users assigned to it. The delete API checks the user count before proceeding.

---

## 8. Timesheet Modules

### 8.1 Timesheet Types

| Type Code | Name | Department Source | Employee Source |
|---|---|---|---|
| `PROD` | Production | Departments where `mainDepartment = 'production'` (case-insensitive) | `deptFilter=prod-inst` (Production + Installation depts) |
| `INST` | Installation | Departments where `mainDepartment` includes `'inst'` | `deptFilter=inst` (Production + Installation + Digital depts) |
| `PROJ` | Projects Team | No dept filter on header | `deptFilter=projects` (Projects dept only) |

### 8.2 Timesheet Statuses

```
Draft → Submitted → Approved
                 ↘ Rejected → (re-edit as Draft) → Submitted
```

| Status | Who Sets It | Notes |
|---|---|---|
| `Draft` | System on create | Default status |
| `Submitted` | User submitting | Locks form for editing (unless admin) |
| `Approved` | Approver | Only ROLE-001 can edit after this |
| `Rejected` | Approver | Returns to editable state |

### 8.3 Document Numbering

**Format:** `PS-{TYPE}-{YYYYMM}-{NNN}`

- `TYPE` = `PROD`, `INST`, or `PROJ`
- `YYYYMM` = Year and month of creation
- `NNN` = 3-digit zero-padded sequence, **resets to 001 each month**

**Examples:**
- `PS-PROD-202605-001` — First production timesheet in May 2026
- `PS-INST-202605-012` — 12th installation timesheet in May 2026

### 8.4 PROD/INST Timesheet Structure

Each timesheet has:

| Section | Contents |
|---|---|
| **Header** | Date, Project, Work Order, Department, Shift, Entry Person |
| **Labour Lines** | Employee, Task Type, Start Time, End Time, Duration (auto), Overtime, Remarks |
| **Material Lines** | Item Code (searchable), Item Name, Description, Quantity, UOM |
| **Machinery Lines** | Machinery, Start Time, End Time, Duration (auto) |
| **Access Equipment Lines** | Equipment name, Quantity, Duration |
| **Vehicle Lines** | Vehicle, Purpose, Start Time, End Time |

### 8.5 Projects Team Timesheet Structure

| Section | Contents |
|---|---|
| **Header** | Date/Week, Project, Work Order, Entry Person |
| **Labour Lines** | Employee, Mon–Sun hours (HH:MM), Total, Task Description, Remarks |

**Auto-fill:** Employee field pre-populated from the logged-in user's linked `employeeCode`.

### 8.6 Duration Calculation

```
duration = endTime − startTime (in minutes), converted to HH:MM
if endTime < startTime: add 24 hours (overnight shift support)
```

**Function `calcDurationMinutes(start, end):`**
```
minutes = (eh × 60 + em) − (sh × 60 + sm)
if minutes < 0: minutes += 1440   ← handles midnight crossover
```

**HH:MM parsing:**
```
hmToMinutes("08:30") → 510
minutesToHm(510)     → "08:30"
```

---

## 9. Master Data Modules

All master data is **read-only** in the PS TimeSheet system — sourced from the live ERP database.

### 9.1 Employee Master

- Source: `ErpMasterEmployee` (live DB)
- Filtered: `isActive = 1` AND `isDeleted = 0`
- Joins: `ErpMasterDepartment` for department name

**deptFilter values for employee API:**

| Value | SQL Filter Applied |
|---|---|
| `prod-inst` | `departmentCode LIKE '%production%' OR departmentCode LIKE '%install%'` |
| `inst` | `departmentCode LIKE '%production%' OR departmentCode LIKE '%install%' OR departmentCode LIKE '%digital%'` |
| `projects` | `departmentCode LIKE '%project%'` |
| *(empty)* | No department filter |

- **View modal** available per employee row (read-only, no writes to ERP)
- **Edit button** shown but routes to ERP update page (not implemented — ERP is shared with other systems)

### 9.2 Department Master

- Source: `ErpMasterDepartment` (live DB) merged with `PSDepartmentProfile` (dev DB)
- Filtered: `md.isActive = 1` (ERP active only)
- Merge logic:
  - `mainDepartment` = `PSDepartmentProfile.mainDepartmentOverride` if set, else ERP parent department code
  - `isActive` = `PSDepartmentProfile.isActive` if a profile exists, else `true`

**Edit behaviour:**
- Edit button opens modal to change `mainDepartmentOverride` and `isActive`
- Changes saved to `PSDepartmentProfile` (dev DB only) — ERP is never touched
- Inactive departments (`isActive = 0`) are excluded from PROD and INST timesheet department dropdowns

### 9.3 Item Master

- Source: `ErpMasterItem` JOIN `ErpMasterTaxnomy` (for UOM) JOIN `ErpMasterSubsidiary`
- **Exclusions:**
  - Items with `-SJO-` in the name (frontend filter via `isSjoItem()`)
  - Items belonging to subsidiary with `subsidiaryCode LIKE '%prosigns ksa%'` (backend SQL filter)
- **Subsidiaries fetched:** IDs 1 and 3 (hardcoded)
- Displayed as searchable dropdown in timesheet material rows

### 9.4 Other Masters

| Master | Source | Notes |
|---|---|---|
| Machinery | `ErpMasterMachinery` | Subsidiary 1 only |
| Access Equipment | `ErpMasterAccessEquipment` | All active records |
| Projects | `ErpMasterProject` | Subsidiaries 1, 3. `isActive=1`, `isDeleted=0` |
| Work Orders | `ErpOperationWorkOrder` + `erpinstallationworkorder` | Subsidiaries 1, 3. Statuses: `In Process`, `Released` |
| Task Types | `ErpMasterTaskType` | All active |

---

## 10. Work Order Completion (WOC)

WOC records a formal completion event for a work order, with optional file attachments.

**Document Number Format:** `PS-WOC-YYYYMM-NNN` (same auto-numbering as timesheets)

**Fields:**
- Date, Project, Work Order Number, Department (main dept dropdown from `masterProdDepartments`)
- Customer Name, Status, Remarks, Entered By
- **Attachments** — uploaded files stored on disk, metadata in `PsWoCompleteAttachments`

**File Upload:**
- Stored in `uploads/woc/` directory on the server
- Filename on disk: `{UUID}.{original_extension}`
- Download via `GET /api/wo-complete/attachments/:attachId/download`

---

## 11. Department Profile Management

### Problem Solved

ERP `ErpMasterDepartment` is shared with other systems — it cannot be modified. PS TimeSheet needs to:
1. Rename the parent department shown for some departments
2. Mark certain departments as inactive so they don't appear in timesheet dropdowns

### Solution: PSDepartmentProfile overlay

- `PSDepartmentProfile` in the dev DB stores overrides keyed by `departmentId` (INT, unique)
- On every `GET /api/departments`, both pools are queried and results merged in TypeScript:

```typescript
mainDepartment = profile.mainDepartmentOverride || erp.parentDeptCode || null
isActive       = profile exists ? Boolean(profile.isActive) : true
```

- `departmentId` (not `departmentCode`) is used as PK because `departmentCode` is **not unique** in ERP (e.g. "Digital" appears 3 times with different IDs)

### Edit Flow

1. User clicks Edit on a department row
2. `openDeptEdit(departmentId)` opens modal with current values
3. User changes Main Department override and/or Active/Inactive status
4. `saveDeptProfile()` sends `PUT /api/departments/:id/profile`
5. Backend does MERGE upsert into `PSDepartmentProfile`
6. Frontend immediately reloads both department tables and timesheet dropdowns

---

## 12. Reports

### Available Reports

| Report | Format | Data Source |
|---|---|---|
| Timesheet Detail Report | CSV | `PSTsHeader` + all line tables, filtered by date range and type |
| Timesheet Summary Report | CSV | Aggregated view of `PSTsHeader` |

### Removed Reports (not yet built)

The following were removed from the UI as they are not implemented:
- Labour Hours Report
- Work Order Progress
- Approval Pending

---

## 13. System Settings

### Shift Setup

Managed via `PSTsShifts`. Used as a dropdown in timesheet header.

**Validation rules:**
- `shiftCode` — required, stored uppercase
- `shiftName` — required
- `startTime` / `endTime` — must match `HH:MM` format (regex: `/^([01]\d|2[0-3]):([0-5]\d)$/`)
- `graceMinutes` — integer, 0–180
- `status` — must be exactly `Active` or `Inactive`

### Document Numbering

Configurable prefix per timesheet type. Sequence resets monthly. Admin can view and manually adjust sequence numbers.

### Approval Settings

Per timesheet type, defines who is the designated approver (name + email). Used for email notification routing.

---

## 14. Frontend Architecture

The frontend is a **React 18 SPA** built with Vite. In production, the compiled output (`frontend/dist/`) is served directly by the NestJS backend.

### Technology

| Library | Purpose |
|---|---|
| React 18 + Vite | Component framework and build tool |
| React Router v6 | Client-side routing |
| Zustand | Auth state (token, user, logout) — persisted to `localStorage` |
| `@tanstack/react-query` | Server data fetching, caching, pagination |
| Axios | HTTP client (`src/api/client.js`) |

### File Structure

```
frontend/src/
├── main.jsx                  ← Entry point
├── App.jsx                   ← Router root
├── api/
│   └── client.js             ← Axios instance, auth headers, 401 redirect
├── store/
│   └── authStore.js          ← Zustand auth store
├── pages/
│   ├── LoginPage.jsx
│   ├── DashboardPage.jsx
│   ├── timesheets/
│   ├── admin/
│   │   ├── UsersPage.jsx
│   │   ├── RolesPage.jsx
│   │   └── LoginHistoryPage.jsx
│   ├── master/
│   ├── woc/
│   ├── reports/
│   └── settings/
└── components/
    └── ui/
        └── Table.jsx         ← Sortable table, optional client-side pagination
```

### API Client (`client.js`)

Axios instance configured with `baseURL = '/api'`. Auth token is attached automatically from the Zustand store. The 401 response interceptor redirects to `/login` — but only if the failing request was **not** `POST /auth/login` itself (avoids a reload loop when the user types a wrong password).

### Data Fetching

React Query is used for all server state. Paginated queries use `keepPreviousData: true` to avoid a loading flash when moving between pages.

### Table Component

`components/ui/Table.jsx` supports optional client-side pagination via a `pageSize` prop:

```jsx
<Table columns={cols} data={rows} pageSize={50} />
```

Without `pageSize`, all rows are rendered (existing usage unchanged).

### Login History

Login history uses **server-side pagination**. The frontend sends `?page=N&limit=50` and the backend returns:

```json
{ "data": [...], "total": 412, "page": 2, "pages": 9, "limit": 50 }
```

### Department Filtering for Timesheets

```javascript
// PROD — departments whose mainDepartment === 'production'
// INST — departments whose mainDepartment includes 'inst'
// Both exclude inactive departments (isActive === false or 0)
```

### Active Sessions Tab

Shows all active sessions. The `isCurrent` flag comes from the server (the backend compares each session token against the incoming request token). Sessions flagged `isCurrent` show a "Current" badge; all others show a "Logout" button that calls `DELETE /api/auth/sessions/user/:userId`.

---

## 15. API Reference

Base URL: `http://{hostname}:3000/api`

All endpoints require `Authorization: Bearer {token}` header except `POST /auth/login`.

### Authentication

| Method | Endpoint | Body / Params | Response |
|---|---|---|---|
| POST | `/auth/login` | `{ username, password, city?, country? }` | `{ token, expiresAt, mustChangePassword, user }` |
| POST | `/auth/logout` | — | `{ ok: true }` |
| GET | `/auth/me` | — | User object |
| GET | `/auth/permissions` | — | `{ permissions[], dataScope }` |
| GET | `/auth/dashboard-stats` | — | Stats object |
| GET | `/auth/login-audit` | — | Login audit for current user |
| GET | `/auth/login-history` | `?days=30&page=1&limit=50` | All login history (paginated) |
| GET | `/auth/login-history/:userId` | `?days=30&page=1&limit=50` | User-specific login history (paginated) |
| GET | `/auth/sessions` | — | All active sessions (includes `isCurrent` boolean) |
| DELETE | `/auth/sessions/user/:userId` | — | Terminate all sessions for a user |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` | `{ ok: true }` |

### Departments

| Method | Endpoint | Params / Body | Response |
|---|---|---|---|
| GET | `/departments` | — | `DepartmentMasterRow[]` |
| PUT | `/departments/:id/profile` | `{ mainDepartmentOverride?, isActive, updatedBy? }` | `{ ok: true }` |

`DepartmentMasterRow`: `{ departmentId, departmentCode, mainDepartment, isActive }`

### Employees

| Method | Endpoint | Params | Response |
|---|---|---|---|
| GET | `/employees` | `?regionIds=1,3&deptFilter=prod-inst\|inst\|projects` | `EmployeeRow[]` |

### Items

| Method | Endpoint | Params | Response |
|---|---|---|---|
| GET | `/items` | `?subsidiaryIds=1,3` | `ItemMasterRow[]` |

### Timesheets

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/timesheets` | Filter: `?type=PROD&status=Draft&startDate=&endDate=&workOrderNo=` |
| POST | `/timesheets` | Create new timesheet |
| GET | `/timesheets/:docNo` | Get single timesheet with all lines |
| PUT | `/timesheets/:docNo` | Update timesheet |
| DELETE | `/timesheets/:docNo` | Soft delete (`isDeleted = 1`) |
| POST | `/timesheets/batch` | Create multiple timesheets |
| POST | `/timesheets/:docNo/submit` | Change status to Submitted |
| POST | `/timesheets/:docNo/approve` | Change status to Approved |
| POST | `/timesheets/:docNo/reject` | Change status to Rejected |
| GET | `/timesheets/pending-approvals` | All Submitted timesheets |
| GET | `/timesheets/preview-docno` | `?type=PROD` → next document number |
| GET | `/timesheets/report-detail` | CSV export |

### Users

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/users` | All users |
| POST | `/users` | Create user |
| GET | `/users/:userId` | Get one user |
| PATCH | `/users/:userId` | Update user |
| DELETE | `/users/:userId` | Delete user |
| POST | `/users/:userId/reset-password` | Admin reset → returns `{ tempPassword }` |

### Roles

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/roles` | All roles |
| POST | `/roles` | Create role |
| GET | `/roles/:roleCode` | Get one role |
| PATCH | `/roles/:roleCode` | Update role |
| DELETE | `/roles/:roleCode` | Delete (fails if users assigned) |
| GET | `/roles/:roleCode/permissions` | Get permissions |
| PUT | `/roles/:roleCode/permissions` | Save permissions (MERGE upsert) |

---

## 16. Validations

### Timesheet Header

| Field | Rule |
|---|---|
| Date | Required |
| Project | Required |
| Work Order | Required |
| Department | Required (PROD/INST only) |
| Shift | Required |

### Labour Lines (PROD/INST)

| Field | Rule |
|---|---|
| Employee | Required — must select from searchable dropdown |
| Start Time | Required, HH:MM |
| End Time | Required, HH:MM |
| Duration | Auto-calculated, read-only |

### Material Lines

| Field | Rule |
|---|---|
| Item Code | Required — must select from searchable dropdown; stored as `dataset.itemCode` |
| Quantity | Required, numeric |

### Password (Users)

| Rule | Detail |
|---|---|
| Min length | 8 characters |
| Must contain | Uppercase, lowercase, digit, special char |
| No spaces | Enforced |
| No username | Case-insensitive check |
| History | Cannot reuse last 3 passwords |

### Shift

| Field | Rule |
|---|---|
| shiftCode | Required |
| shiftName | Required |
| startTime / endTime | Must match `HH:MM` (regex validated) |
| graceMinutes | Integer 0–180 |
| status | Must be exactly `Active` or `Inactive` |

### Role Delete

- Cannot delete a role that has 1 or more users assigned

### Department Profile Save

- `isActive` — boolean (converted from select value `'1'`/`'0'`)
- `mainDepartmentOverride` — optional string, stored as NULL if empty

---

## 17. Business Rules & Formulas

### Time Duration Calculation

```
calcDurationMinutes(startTime, endTime):
  sh, sm = split startTime by ':'
  eh, em = split endTime by ':'
  minutes = (eh × 60 + em) − (sh × 60 + sm)
  if minutes < 0: minutes += 1440   ← overnight handling
  return minutes

minutesToHm(minutes):
  h = floor(minutes / 60)
  m = minutes % 60
  return zero-pad(h, 2) + ':' + zero-pad(m, 2)
```

**Example:** Start `22:00`, End `02:00` → `(2×60) − (22×60)` = `−1200` → `−1200 + 1440 = 240` mins → `04:00`

### Document Number Generation

```
SELECT MAX(sequence_for_this_type_and_month) + 1
Format: prefix + '-' + YYYYMM + '-' + zero-pad(seq, 3)
```

Sequence resets to 1 each calendar month per type.

### Password Expiry

```
expiry = lastPasswordChange + 90 days
daysRemaining = ceil((expiry - today) / 86400000)
color = red if daysRemaining ≤ 7
      = amber if daysRemaining ≤ 30
      = normal otherwise
```

### Account Lockout

```
if COUNT(PSTsFailedAttempts WHERE (username=? OR ip=?) AND attemptAt > now-15min) >= 5:
  BLOCK login
  remainingAttempts = 5 - count - 1
  if remainingAttempts > 0: show "X attempt(s) remaining"
  else: show "locked"
```

### SJO Item Filter

Items with `-SJO-` in the item name are excluded from all item dropdowns.  
`isSjoItem(item) = item.itemName.includes('-SJO-')`

### Department Active Filter (Timesheet Dropdown)

```
visible = isActive !== false AND isActive !== 0
```

Handles both boolean `false` (mssql BIT→boolean) and numeric `0` defensively.

### Approval Status Gate

```
if timesheet.status === 'Approved' AND currentUser.roleCode !== 'ROLE-001':
  disable all edit fields
  disable save button
```

---

## 18. Hardcoded Configuration Values

These values are embedded in the source code. If infrastructure changes, code must be updated.

| Value | File | Location | Description |
|---|---|---|---|
| API port `3000` | `legacy.js` | `getApiBaseUrl()` | Backend server port |
| `subsidiaryIds=1,3` | `legacy.js` | 5 API calls | Work orders, projects, items fetch for subsidiaries 1 and 3 |
| `subsidiaryIds=1` | `legacy.js` | Machinery API | Machinery fetched for subsidiary 1 only |
| `regionIds=1,3` | `legacy.js` | Employee API calls | Employees fetched for regions 1 and 3 |
| `'production'` | `legacy.js` | `populateProdDepartmentSelect` | String to match mainDepartment for PROD dept filter |
| `'inst'` | `legacy.js` | `populateInstDepartmentSelect` | String to match mainDepartment for INST dept filter |
| `'production'`, `'install'`, `'digital'`, `'project'` | `employees.service.ts` | `deptFilter` LIKE clauses | ERP departmentCode patterns |
| `ROLE-001` | `legacy.js` | Approval edit gate | Only this roleCode can edit Approved timesheets |
| Session TTL `8 hours` | `auth.service.ts` | `SESSION_TTL_HOURS` | Session expiry duration |
| Max failed attempts `5` | `auth.service.ts` | `MAX_FAILED` | Lockout threshold |
| Lockout window `15 min` | `auth.service.ts` | `LOCKOUT_MINUTES` | Failed attempt window |
| Password expiry `90 days` | `auth.service.ts` | `getMyLoginAudit` | Days before password expires |
| Password history `3` | `users.service.ts` | `PW_HISTORY_KEEP` | Number of old passwords remembered |

---

## 19. Email Notification System

Email notifications are sent for timesheet events (submit, approve, reject). Configuration is stored in the dev DB.

### Tables

| Table | Purpose |
|---|---|
| `PsTsEmailSettings` | SMTP connection details (server, port, user, password, TLS, sender name/address) |
| `PsTsEmailNotificationRules` | Which events trigger emails (submit/approve/reject per type) |
| `PsTsEmailTemplates` | HTML email body templates per event type, with `{{variable}}` placeholders |
| `PsTsEmailLog` | Log of all sent/failed emails |

### Supported Notification Events

- Timesheet submitted (notifies approver)
- Timesheet approved (notifies submitter)
- Timesheet rejected (notifies submitter with reason)

---

## 20. Audit Trail

`GET /api/audit` returns a combined audit log sourced from multiple tables:

- `PSTsLoginHistory` — all login/logout events
- `PSTsHeader` changes — timesheet status transitions (submit/approve/reject)

The Audit Trail page displays: timestamp, user, action, document number or description, IP address.

---

## 21. Production Deployment

### Prerequisites

- Node.js 18+ on the host machine
- SQL Server connection details for both ERP-Live and ERP-Dev
- A completed `backend/.env` file (copy from `backend/.env.example`)

### Build

Run the build script from the repo root. It installs dependencies and compiles both frontend and backend:

```bash
./build-prod.sh        # macOS / Linux
build-prod.bat         # Windows
```

Output:
- `frontend/dist/` — compiled React SPA
- `backend/dist/` — compiled NestJS server

### Start (Plain Node)

```bash
./start-prod.sh        # macOS / Linux
start-prod.bat         # Windows
```

Opens on `http://localhost:<PORT>` (default 3000). Press Ctrl+C to stop.

### Start (PM2 — Recommended for Servers)

```bash
pm2 start ecosystem.config.js
pm2 save                         # persist across reboots
pm2 logs ps-timesheet
```

PM2 restarts the process automatically if it crashes. Logs are written to `backend/logs/`.

### CORS / Network

Set `FRONTEND_ORIGIN` in `.env` to the URL users open in their browser (the server's LAN IP + port), e.g.:

```
FRONTEND_ORIGIN=http://192.168.1.100:3000
```

For developer machines running the Vite dev server, add the dev machine's URL to `EXTRA_ORIGINS`:

```
EXTRA_ORIGINS=http://192.168.1.50:5173
```

---

*End of Documentation*
