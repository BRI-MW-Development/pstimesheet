# PS TimeSheet — Frontend Architecture

**Status:** React migration complete (May 2026).  
The legacy monolithic HTML/JS file has been fully replaced by a React SPA built with Vite.

---

## Current Structure

```
frontend/
├── src/
│   ├── main.jsx                   ← React entry point
│   ├── App.jsx                    ← Router root (React Router v6)
│   ├── api/
│   │   └── client.js              ← Axios instance, 401 interceptor, auth headers
│   ├── store/
│   │   └── authStore.js           ← Zustand auth state (token, user, logout)
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── timesheets/            ← PROD, INST, Projects Team
│   │   ├── admin/
│   │   │   ├── UsersPage.jsx
│   │   │   ├── RolesPage.jsx
│   │   │   └── LoginHistoryPage.jsx  ← Login History + Active Sessions tabs
│   │   ├── master/                ← Employee, Dept, Item, etc.
│   │   ├── woc/                   ← Work Order Completion
│   │   ├── reports/
│   │   └── settings/              ← Shifts, Document Numbering
│   ├── components/
│   │   └── ui/
│   │       └── Table.jsx          ← Reusable sortable table with optional pagination
│   └── styles/
│       └── ...
├── dist/                          ← Built output (served by backend in production)
├── index.html
├── vite.config.js
└── package.json
```

---

## Key Frontend Decisions

### API Client (`src/api/client.js`)

- Axios instance with `baseURL = '/api'`
- Automatically attaches `Authorization: Bearer <token>` from Zustand store
- Response interceptor: on 401, clears auth state and redirects to `/login`
  - Guard: does **not** redirect on 401 from `POST /auth/login` itself (avoids reload loop on wrong password)

### Auth State (Zustand)

- `authStore` holds `{ token, user, isAuthenticated }`
- Persisted to `localStorage` via `zustand/middleware/persist`
- `logout()` clears state + localStorage

### Data Fetching (`@tanstack/react-query`)

- All server data fetched via React Query
- `keepPreviousData: true` on paginated queries to avoid flicker when changing pages

### Table Component

`Table.jsx` is a shared sortable table. Pass `pageSize` prop for client-side pagination:

```jsx
<Table columns={cols} data={rows} pageSize={50} />
```

When `pageSize` is omitted the table renders all rows (existing behaviour unchanged).

### Login History Pagination

Login history uses **server-side pagination** (`OFFSET / FETCH` in SQL). The API accepts:

```
GET /api/auth/login-history?days=30&page=1&limit=50
```

Response: `{ data: [...], total, page, pages, limit }`

---

## Production Build

From repo root:

```bash
./build-prod.sh   # macOS/Linux
build-prod.bat    # Windows
```

This runs:
1. `npm ci` in `frontend/`
2. `npm run build` — outputs to `frontend/dist/`
3. `npm ci --omit=dev` in `backend/`
4. `npm run build` — outputs to `backend/dist/`

The backend's `ServeStaticModule` serves `frontend/dist/` at `/`. React Router deep links are handled by a custom middleware in `main.ts` that returns `index.html` for any non-API GET that doesn't match a file.

---

## Active Sessions — isCurrent Logic

The `GET /api/auth/sessions` endpoint returns a boolean `isCurrent` field for each session. The backend computes this by comparing each session's token against the token on the incoming request:

```typescript
return sessions.map(({ sessionToken, ...rest }) => ({
  ...rest,
  isCurrent: sessionToken === req.sessionToken,
}));
```

Raw tokens are **never** sent to the frontend. The `Terminate` button is hidden for the current session and shown for all others.
