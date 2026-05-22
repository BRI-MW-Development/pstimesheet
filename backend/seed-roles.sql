-- ============================================================
-- PS TimeSheet  —  Standard Roles Seed
-- Safe to run multiple times (MERGE for roles, DELETE+INSERT for permissions)
-- Run against the DEV database (PSTsRoles, PSTsRolePermissions)
-- ============================================================
SET NOCOUNT ON;

-- ── 0. Ensure dataScope column exists ───────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsRoles') AND name='dataScope')
  ALTER TABLE PSTsRoles ADD dataScope NVARCHAR(10) NOT NULL DEFAULT 'All';

-- ── 1. Upsert roles ─────────────────────────────────────────
--  deptScope : 'All' | 'Production' | 'Installation'
--  dataScope : 'All' | 'OwnDept' | 'Own'
MERGE PSTsRoles AS t
USING (VALUES
  ('ROLE-001', 'Admin',               'All',          'All',     'Active'),
  ('ROLE-002', 'Operation HOD',       'All',          'All',     'Active'),
  ('ROLE-003', 'Installation Lead',   'Installation', 'OwnDept', 'Active'),
  ('ROLE-004', 'Production Lead',     'Production',   'OwnDept', 'Active'),
  ('ROLE-005', 'Projects HOD',        'All',          'All',     'Active'),
  ('ROLE-006', 'Project',             'All',          'Own',     'Active'),
  ('ROLE-007', 'Finance',             'All',          'All',     'Active'),
  ('ROLE-008', 'Data Entry',          'All',          'All',     'Active'),
  ('ROLE-009', 'Production User',     'Production',   'Own',     'Active'),
  ('ROLE-010', 'Installation User',   'Installation', 'Own',     'Active')
) AS s (roleCode, roleName, deptScope, dataScope, status)
ON  t.roleCode = s.roleCode
WHEN MATCHED THEN
  UPDATE SET roleName  = s.roleName,
             deptScope = s.deptScope,
             dataScope = s.dataScope,
             status    = s.status,
             updatedAt = GETDATE()
WHEN NOT MATCHED THEN
  INSERT (roleCode, roleName, deptScope, dataScope, status)
  VALUES (s.roleCode, s.roleName, s.deptScope, s.dataScope, s.status);

PRINT '  Roles upserted.';

-- ── 2. Reset permissions for these 10 roles ─────────────────
DELETE FROM PSTsRolePermissions
WHERE roleCode IN (
  'ROLE-001','ROLE-002','ROLE-003','ROLE-004','ROLE-005',
  'ROLE-006','ROLE-007','ROLE-008','ROLE-009','ROLE-010'
);

-- ── 3. Insert permissions ────────────────────────────────────
-- Columns: roleCode, module, canCreate, canRead, canWrite, canDelete, canReport
INSERT INTO PSTsRolePermissions
       (roleCode,    module,        canCreate, canRead, canWrite, canDelete, canReport)
VALUES

-- ═══════════════════════════════════════════════════════
-- ROLE-001  Admin  —  full access to everything
-- ═══════════════════════════════════════════════════════
('ROLE-001','PROD',          1,1,1,1,1),
('ROLE-001','INST',          1,1,1,1,1),
('ROLE-001','PROJ',          1,1,1,1,1),
('ROLE-001','WO_COMPLETE',   1,1,1,1,1),
('ROLE-001','REPORTS',       1,1,1,1,1),
('ROLE-001','EMPLOYEES',     1,1,1,1,1),
('ROLE-001','DEPARTMENTS',   1,1,1,1,1),
('ROLE-001','ITEMS',         1,1,1,1,1),
('ROLE-001','MACHINERY',     1,1,1,1,1),
('ROLE-001','VEHICLES',      1,1,1,1,1),
('ROLE-001','PROJECTS',      1,1,1,1,1),
('ROLE-001','WORK_ORDERS',   1,1,1,1,1),
('ROLE-001','TASK_TYPES',    1,1,1,1,1),
('ROLE-001','USERS',         1,1,1,1,1),
('ROLE-001','ROLES',         1,1,1,1,1),
('ROLE-001','SHIFTS',        1,1,1,1,1),
('ROLE-001','DOC_NUMBERING', 1,1,1,1,1),
('ROLE-001','SETTINGS',      1,1,1,1,1),

-- ═══════════════════════════════════════════════════════
-- ROLE-002  Operation HOD
--   Timesheets  : PROD + INST + WO_COMPLETE (create/read/write + report, no delete)
--   NOT PROJ    : projects team excluded
--   Reports     : read + report (prod/inst detail; no project detail or audit trail — UI filter)
--   Master      : view only
--   Access ctrl : none  |  Settings: none
--   deptScope   : All   |  dataScope: All
-- ═══════════════════════════════════════════════════════
('ROLE-002','PROD',          1,1,1,0,1),
('ROLE-002','INST',          1,1,1,0,1),
('ROLE-002','WO_COMPLETE',   1,1,1,0,1),
('ROLE-002','REPORTS',       0,1,0,0,1),
('ROLE-002','EMPLOYEES',     0,1,0,0,0),
('ROLE-002','DEPARTMENTS',   0,1,0,0,0),
('ROLE-002','ITEMS',         0,1,0,0,0),
('ROLE-002','MACHINERY',     0,1,0,0,0),
('ROLE-002','VEHICLES',      0,1,0,0,0),
('ROLE-002','PROJECTS',      0,1,0,0,0),
('ROLE-002','WORK_ORDERS',   0,1,0,0,0),
('ROLE-002','TASK_TYPES',    0,1,0,0,0),

-- ═══════════════════════════════════════════════════════
-- ROLE-003  Installation Lead
--   Timesheets  : INST (create/read/write + report, no delete), WO_COMPLETE (create/read/write + report, no delete)
--   Pending Approvals visible (part of INST flow)
--   Reports     : installation detail only
--   Master      : view only
--   Access ctrl : none  |  Settings: none
--   deptScope   : Installation  |  dataScope: OwnDept
-- ═══════════════════════════════════════════════════════
('ROLE-003','INST',          1,1,1,0,1),
('ROLE-003','WO_COMPLETE',   1,1,1,0,1),
('ROLE-003','REPORTS',       0,1,0,0,1),
('ROLE-003','EMPLOYEES',     0,1,0,0,0),
('ROLE-003','DEPARTMENTS',   0,1,0,0,0),
('ROLE-003','ITEMS',         0,1,0,0,0),
('ROLE-003','MACHINERY',     0,1,0,0,0),
('ROLE-003','VEHICLES',      0,1,0,0,0),
('ROLE-003','PROJECTS',      0,1,0,0,0),
('ROLE-003','WORK_ORDERS',   0,1,0,0,0),
('ROLE-003','TASK_TYPES',    0,1,0,0,0),

-- ═══════════════════════════════════════════════════════
-- ROLE-004  Production Lead
--   Timesheets  : PROD (create/read/write + report, no delete), WO_COMPLETE (create/read/write + report, no delete)
--   Pending Approvals visible (part of PROD flow)
--   Reports     : production detail only
--   Master      : view only
--   Access ctrl : none  |  Settings: none
--   deptScope   : Production  |  dataScope: OwnDept
-- ═══════════════════════════════════════════════════════
('ROLE-004','PROD',          1,1,1,0,1),
('ROLE-004','WO_COMPLETE',   1,1,1,0,1),
('ROLE-004','REPORTS',       0,1,0,0,1),
('ROLE-004','EMPLOYEES',     0,1,0,0,0),
('ROLE-004','DEPARTMENTS',   0,1,0,0,0),
('ROLE-004','ITEMS',         0,1,0,0,0),
('ROLE-004','MACHINERY',     0,1,0,0,0),
('ROLE-004','VEHICLES',      0,1,0,0,0),
('ROLE-004','PROJECTS',      0,1,0,0,0),
('ROLE-004','WORK_ORDERS',   0,1,0,0,0),
('ROLE-004','TASK_TYPES',    0,1,0,0,0),

-- ═══════════════════════════════════════════════════════
-- ROLE-005  Projects HOD
--   Timesheets  : PROJ (full CRUD + report)
--   Reports     : project detail only
--   Master      : Projects + Work Orders + Employees + Task Types (view) — project-related
--   Access ctrl : none  |  Settings: none
--   deptScope   : All   |  dataScope: All
-- ═══════════════════════════════════════════════════════
('ROLE-005','PROJ',          1,1,1,0,1),
('ROLE-005','REPORTS',       0,1,0,0,1),
('ROLE-005','PROJECTS',      0,1,0,0,0),
('ROLE-005','WORK_ORDERS',   0,1,0,0,0),
('ROLE-005','EMPLOYEES',     0,1,0,0,0),
('ROLE-005','TASK_TYPES',    0,1,0,0,0),

-- ═══════════════════════════════════════════════════════
-- ROLE-006  Project  (project team member)
--   Timesheets  : PROJ (create/read/write, no delete, canReport)
--   Reports     : project detail only
--   Master      : Projects (view) — can see project list
--   Access ctrl : none  |  Settings: none
--   dataScope   : Own   (sees only own timesheets)
-- ═══════════════════════════════════════════════════════
('ROLE-006','PROJ',          1,1,1,0,1),
('ROLE-006','REPORTS',       0,1,0,0,1),
('ROLE-006','PROJECTS',      0,1,0,0,0),

-- ═══════════════════════════════════════════════════════
-- ROLE-007  Finance
--   Timesheets  : PROD + INST + WO_COMPLETE (read + report only — no create/write/delete)
--   Reports     : all reports (canReport)
--   Master      : view only
--   Access ctrl : none  |  Settings: none
--   deptScope   : All   |  dataScope: All
-- ═══════════════════════════════════════════════════════
('ROLE-007','PROD',          0,1,0,0,1),
('ROLE-007','INST',          0,1,0,0,1),
('ROLE-007','WO_COMPLETE',   0,1,0,0,1),
('ROLE-007','REPORTS',       0,1,0,0,1),
('ROLE-007','EMPLOYEES',     0,1,0,0,0),
('ROLE-007','DEPARTMENTS',   0,1,0,0,0),
('ROLE-007','ITEMS',         0,1,0,0,0),
('ROLE-007','MACHINERY',     0,1,0,0,0),
('ROLE-007','VEHICLES',      0,1,0,0,0),
('ROLE-007','PROJECTS',      0,1,0,0,0),
('ROLE-007','WORK_ORDERS',   0,1,0,0,0),
('ROLE-007','TASK_TYPES',    0,1,0,0,0),

-- ═══════════════════════════════════════════════════════
-- ROLE-008  Data Entry
--   Timesheets  : PROD + INST + WO_COMPLETE (create/read/write, no delete, canReport)
--   Reports     : all except audit trail (canReport — audit trail restricted in UI)
--   Master      : view only
--   Access ctrl : none  |  Settings: none
--   deptScope   : All   |  dataScope: All
-- ═══════════════════════════════════════════════════════
('ROLE-008','PROD',          1,1,1,0,1),
('ROLE-008','INST',          1,1,1,0,1),
('ROLE-008','WO_COMPLETE',   1,1,1,0,1),
('ROLE-008','REPORTS',       0,1,0,0,1),
('ROLE-008','EMPLOYEES',     0,1,0,0,0),
('ROLE-008','DEPARTMENTS',   0,1,0,0,0),
('ROLE-008','ITEMS',         0,1,0,0,0),
('ROLE-008','MACHINERY',     0,1,0,0,0),
('ROLE-008','VEHICLES',      0,1,0,0,0),
('ROLE-008','PROJECTS',      0,1,0,0,0),
('ROLE-008','WORK_ORDERS',   0,1,0,0,0),
('ROLE-008','TASK_TYPES',    0,1,0,0,0),

-- ═══════════════════════════════════════════════════════
-- ROLE-009  Production User  (production department staff)
--   Timesheets  : PROD (create/read/write, no delete, no report)
--   Master      : view only
--   Access ctrl : none  |  Settings: none
--   deptScope   : Production  |  dataScope: Own
-- ═══════════════════════════════════════════════════════
('ROLE-009','PROD',          1,1,1,0,0),
('ROLE-009','EMPLOYEES',     0,1,0,0,0),
('ROLE-009','DEPARTMENTS',   0,1,0,0,0),
('ROLE-009','ITEMS',         0,1,0,0,0),
('ROLE-009','MACHINERY',     0,1,0,0,0),
('ROLE-009','VEHICLES',      0,1,0,0,0),
('ROLE-009','PROJECTS',      0,1,0,0,0),
('ROLE-009','WORK_ORDERS',   0,1,0,0,0),
('ROLE-009','TASK_TYPES',    0,1,0,0,0),

-- ═══════════════════════════════════════════════════════
-- ROLE-010  Installation User  (installation department staff)
--   Timesheets  : INST (create/read/write, no delete, no report)
--   Master      : view only
--   Access ctrl : none  |  Settings: none
--   deptScope   : Installation  |  dataScope: Own
-- ═══════════════════════════════════════════════════════
('ROLE-010','INST',          1,1,1,0,0),
('ROLE-010','EMPLOYEES',     0,1,0,0,0),
('ROLE-010','DEPARTMENTS',   0,1,0,0,0),
('ROLE-010','ITEMS',         0,1,0,0,0),
('ROLE-010','MACHINERY',     0,1,0,0,0),
('ROLE-010','VEHICLES',      0,1,0,0,0),
('ROLE-010','PROJECTS',      0,1,0,0,0),
('ROLE-010','WORK_ORDERS',   0,1,0,0,0),
('ROLE-010','TASK_TYPES',    0,1,0,0,0);

PRINT '  Permissions seeded.';
PRINT '';
PRINT 'Done. 10 roles ready:';
PRINT '  ROLE-001  Admin                 — full access';
PRINT '  ROLE-002  Operation HOD         — PROD+INST+WO, master read, reports (no proj/audit)';
PRINT '  ROLE-003  Installation Lead     — INST+WO, installation dept only, OwnDept scope';
PRINT '  ROLE-004  Production Lead       — PROD+WO, production dept only, OwnDept scope';
PRINT '  ROLE-005  Projects HOD          — PROJ full, project master read, project reports';
PRINT '  ROLE-006  Project               — PROJ (own records), project reports, Own scope';
PRINT '  ROLE-007  Finance               — PROD+INST+WO read only, all reports, master read';
PRINT '  ROLE-008  Data Entry            — PROD+INST+WO create/write, all reports, master read';
PRINT '  ROLE-009  Production User       — PROD create/write, master read, Own scope';
PRINT '  ROLE-010  Installation User     — INST create/write, master read, Own scope';
