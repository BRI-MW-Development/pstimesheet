# PS TimeSheet — Backend

NestJS (TypeScript) API server for the PS TimeSheet application. Connects to two SQL Server databases and serves the compiled React frontend as static files.

---

## Prerequisites

- Node.js 18+
- Access to the ERP-Live SQL Server (read-only)
- Access to the ERP-Dev SQL Server (read/write — timesheet data)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DB_SERVER` | ERP-Live SQL Server hostname/IP |
| `DB_NAME` | ERP live database name (e.g. `ERP-Live`) |
| `DB_USER` | SQL login for live DB |
| `DB_PASSWORD` | SQL password for live DB |
| `DB_PORT` | SQL Server port (default `1433`) |
| `DB_TRUST_CERT` | Set `yes` for self-signed certs (internal servers) |
| `DEV_DB_SERVER` | ERP-Dev SQL Server hostname/IP |
| `DEV_DB_NAME` | Dev database name (e.g. `ERP-Dev`) |
| `DEV_DB_USER` | SQL login for dev DB |
| `DEV_DB_PASSWORD` | SQL password for dev DB |
| `DEV_DB_PORT` | SQL Server port (default `1433`) |
| `DEV_DB_TRUST_CERT` | Set `yes` for self-signed certs |
| `PORT` | HTTP port the server listens on (default `3000`) |
| `FRONTEND_ORIGIN` | Browser-facing URL, e.g. `http://192.168.1.100:3000`. Used for CORS. |
| `EXTRA_ORIGINS` | Comma-separated extra allowed origins (e.g. Vite dev server on port 5173) |

---

## Running

### Development

```bash
npm run start:dev
```

Runs with file-watching. Does **not** serve the React frontend — use `npm run dev` in the `frontend/` directory instead and set `EXTRA_ORIGINS=http://localhost:5173`.

### Production (plain Node)

Build first (from repo root):

```bash
./build-prod.sh        # Linux/macOS
build-prod.bat         # Windows
```

Then start:

```bash
./start-prod.sh        # Linux/macOS
start-prod.bat         # Windows
```

### Production (PM2 — recommended for servers)

```bash
# From repo root
pm2 start ecosystem.config.js
pm2 logs ps-timesheet
pm2 monit
```

PM2 config is at `ecosystem.config.js` (repo root). Logs go to `backend/logs/`.

---

## Architecture

### Two Database Pools

| Pool Token | Database | Purpose |
|---|---|---|
| `SQL_POOL` | ERP-Live | Read-only master data (employees, departments, items, projects, work orders) |
| `DEV_SQL_POOL` | ERP-Dev | All PS TimeSheet data — timesheets, users, roles, sessions, settings |

`DatabaseModule` is `@Global()` — both pools are injected directly into any service without needing to import `DatabaseModule` in each feature module.

### Static File Serving (Production)

`ServeStaticModule` serves `frontend/dist/` at `/`. Custom middleware in `main.ts` handles React Router deep links — any non-API GET that doesn't match a file returns `index.html`.

### Authentication

- `AuthGuard` is registered as a global `APP_GUARD` — all endpoints require a valid Bearer token by default
- Use `@Public()` on any endpoint that should skip auth (e.g. `POST /auth/login`)
- `PermissionGuard` + `@RequirePermission('MODULE', 'canRead')` for module-level RBAC on admin endpoints

### Password Hashing

Passwords are stored as **bcrypt hashes** (cost 12) in `PSTsUsers.passwordHash`.

`checkPassword()` accepts multiple hash formats for backward compatibility with accounts created before the bcrypt migration:

| Format | Detection |
|---|---|
| bcrypt `$2b$...` | Prefix check |
| bcrypt `$2a$...` (old rounds) | Prefix check |
| SHA-256 lowercase hex (64 chars) | Length + hex check |
| SHA-256 uppercase hex | Uppercase comparison |
| SHA-256 with `0x` prefix | Strips prefix then compares |
| SHA-256 base64 | Length + base64 comparison |

On next successful login, legacy SHA-256 passwords are **not** auto-upgraded — run the password reset tool or direct SQL to migrate specific accounts.

### Performance: Index Creation

`AuthService.onModuleInit` creates performance indexes on `PSTsLoginHistory`, `PSTsSessions`, and `PSTsFailedAttempts`. Index creation runs via `setImmediate()` so it never blocks application startup — the server is ready to accept requests immediately.

---

## Module Structure

```
src/
├── app.module.ts          ← Root module, registers ServeStaticModule + feature modules
├── main.ts                ← Bootstrap, SPA fallback middleware, CORS
├── database/
│   └── database.module.ts ← Global module providing SQL_POOL and DEV_SQL_POOL
├── auth/
│   ├── auth.module.ts
│   ├── auth.service.ts    ← Login, sessions, login history, password check
│   └── auth.controller.ts ← /auth/* endpoints
├── users/
│   └── ...                ← User CRUD, password reset
├── roles/
│   └── ...                ← Role CRUD, permission management
├── timesheets/
│   └── ...                ← Timesheet CRUD, submit/approve/reject, CSV reports
├── departments/
│   └── ...                ← ERP departments merged with PSDepartmentProfile
├── employees/
│   └── ...                ← ERP employee master (read-only)
├── items/
│   └── ...                ← ERP item master (read-only)
├── system-settings/
│   └── ...                ← Shifts, document numbering, approval settings
├── wo-complete/
│   └── ...                ← Work Order Completion records + file attachments
└── audit/
    └── ...                ← Combined audit log
```

---

## API Overview

Base path: `/api`

All endpoints require `Authorization: Bearer <token>` except `POST /auth/login`.

| Group | Base Path | Notes |
|---|---|---|
| Auth | `/auth` | Login, logout, sessions, login history |
| Users | `/users` | CRUD + password reset |
| Roles | `/roles` | CRUD + permissions |
| Timesheets | `/timesheets` | CRUD, submit/approve/reject, CSV export |
| Departments | `/departments` | ERP + PS overrides |
| Employees | `/employees` | ERP read-only |
| Items | `/items` | ERP read-only |
| Shifts | `/system-settings/shifts` | PS-managed shift definitions |
| Work Orders | `/work-orders` | ERP read-only |
| WO Complete | `/wo-complete` | WOC records + attachments |
| Audit | `/audit` | Combined audit trail |

See `PS_TimeSheet_Documentation.md` (repo root) for the full API reference.

---

## Key Auth Endpoints

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/auth/login` | `@Public()` — returns `{ token, expiresAt, user }` |
| POST | `/auth/logout` | Invalidates current session |
| GET | `/auth/sessions` | Active sessions list — requires `USERS canRead` |
| DELETE | `/auth/sessions/user/:userId` | Terminate all sessions for a user |
| GET | `/auth/login-history` | `?days=30&page=1&limit=50` — paginated |
| GET | `/auth/login-history/:userId` | Same pagination params |

---

## Running Tests

```bash
npm run test          # unit tests
npm run test:cov      # with coverage report
```

---

## Password Reset (Emergency)

If a user cannot log in and the UI reset is not an option, generate a bcrypt hash and update directly in SQL:

```javascript
// Run once in Node to generate a hash
const bcrypt = require('bcrypt');
console.log(bcrypt.hashSync('NewPassword123!', 12));
```

```sql
-- Clear any failed attempt lockout
DELETE FROM PSTsFailedAttempts WHERE username = 'theusername';

-- Set new password
UPDATE PSTsUsers
SET passwordHash = '$2b$12$<hash_from_above>'
WHERE username = 'theusername';
```

---

## Logs (PM2)

| File | Content |
|---|---|
| `backend/logs/app.log` | Combined stdout |
| `backend/logs/error.log` | stderr only |
