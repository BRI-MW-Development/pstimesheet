import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';

const MODULE_LABELS = {
  PROD: 'Production Timesheets', INST: 'Installation Timesheets', PROJ: 'Projects Timesheets',
  PENDING_APPROVALS: 'Pending Approvals',
  WO_COMPLETE: 'WO Complete', REPORTS: 'Reports', QC: 'Quality Control (QC)',
  EMPLOYEES: 'Employees', DEPARTMENTS: 'Departments', ITEMS: 'Items', MACHINERY: 'Machinery',
  VEHICLES: 'Vehicles', PROJECTS: 'Projects', WORK_ORDERS: 'Work Orders', TASK_TYPES: 'Task Types',
  USERS: 'Users', ROLES: 'Roles', SHIFTS: 'Shifts', DOC_NUMBERING: 'Doc Numbering', SETTINGS: 'Settings',
};

const MODULE_GROUPS = [
  { label: 'Timesheets',      modules: ['PROD', 'INST', 'PROJ', 'PENDING_APPROVALS', 'WO_COMPLETE', 'REPORTS'] },
  { label: 'Quality Control', modules: ['QC'] },
  { label: 'Master Data',     modules: ['EMPLOYEES', 'DEPARTMENTS', 'ITEMS', 'MACHINERY', 'VEHICLES', 'PROJECTS', 'WORK_ORDERS', 'TASK_TYPES'] },
  { label: 'Administration',  modules: ['USERS', 'ROLES', 'SHIFTS', 'DOC_NUMBERING', 'SETTINGS'] },
];

const ALL_MODULES = MODULE_GROUPS.flatMap((g) => g.modules);
const PERM_FIELDS = ['canRead', 'canCreate', 'canWrite', 'canDelete', 'canReport'];

function RoleModal({ role, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [roleName,  setRoleName]  = useState(role.roleName  ?? '');
  const [dataScope, setDataScope] = useState(role.dataScope ?? 'All');
  const [status,    setStatus]    = useState(role.status    ?? 'Active');

  const { data: existingPerms = [] } = useQuery({
    queryKey: ['role-perms', role.roleCode],
    queryFn: () =>
      role.roleCode
        ? api.get(`/roles/${role.roleCode}/permissions`).then((r) => r.data)
        : [],
    enabled: Boolean(role.roleCode),
  });

  const [perms, setPerms] = useState(null);
  const effectivePerms = perms ?? (() => {
    const map = {};
    existingPerms.forEach((p) => { map[p.module] = p; });
    ALL_MODULES.forEach((m) => {
      if (!map[m]) map[m] = { module: m, canCreate: false, canRead: false, canWrite: false, canDelete: false, canReport: false };
    });
    return map;
  })();

  const { mutate: saveRole, isPending } = useMutation({
    mutationFn: async (payload) => {
      let roleCode = role.roleCode;
      if (roleCode) {
        await api.patch(`/roles/${roleCode}`, { roleName: payload.roleName, dataScope: payload.dataScope, status: payload.status });
      } else {
        const res = await api.post('/roles', { roleName: payload.roleName, dataScope: payload.dataScope, status: payload.status }).then((r) => r.data);
        roleCode = res.roleCode;
      }
      await api.put(`/roles/${roleCode}/permissions`, { permissions: Object.values(payload.perms) });
      return { roleCode };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast(role.roleCode ? 'Role updated.' : 'Role created.', 'success');
      onClose();
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  function toggle(module, field) {
    setPerms((prev) => {
      const base = prev ?? effectivePerms;
      return { ...base, [module]: { ...base[module], [field]: !base[module]?.[field] } };
    });
  }

  function toggleAll(module) {
    setPerms((prev) => {
      const base = prev ?? effectivePerms;
      const p = base[module] ?? {};
      const allOn = PERM_FIELDS.every((f) => p[f]);
      const updated = PERM_FIELDS.reduce((acc, f) => ({ ...acc, [f]: !allOn }), { module });
      return { ...base, [module]: updated };
    });
  }

  const isEdit = Boolean(role.roleCode);

  return (
    <Modal title={isEdit ? 'Edit Role' : 'Add Role'} onClose={onClose} size="lg">
      <form onSubmit={(e) => { e.preventDefault(); saveRole({ roleName, dataScope, status, perms: perms ?? effectivePerms }); }}>

        {isEdit && (
          <div className="modal-banner">
            <div>
              <div className="modal-banner-title">{role.roleName || role.roleCode}</div>
              <div className="modal-banner-sub">
                <span className="wip-link" style={{ fontSize: 12 }}>{role.roleCode}</span>
                {role.dataScope && role.dataScope !== 'All' && <span> · {role.dataScope} scope</span>}
              </div>
            </div>
            <div className="modal-banner-right">
              <Badge variant={status === 'Active' ? 'active' : 'inactive'}>{status}</Badge>
            </div>
          </div>
        )}

        <span className="form-section-label">Role Information</span>
        <div className="form-grid-2" style={{ marginBottom: 0 }}>
          {isEdit && (
            <div className="form-group">
              <label className="form-label">Role Code</label>
              <input type="text" value={role.roleCode} readOnly className="form-control"
                style={{ background: 'var(--bg2)', color: 'var(--text3)' }} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Role Name <span style={{ color: 'var(--red)' }}>*</span></label>
            <input type="text" required className="form-control" value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g. Timesheet Controller" />
          </div>
          <div className="form-group">
            <label className="form-label">Department Scope</label>
            <select className="form-control" value={dataScope} onChange={(e) => setDataScope(e.target.value)}>
              <option value="All">All Departments</option>
              <option value="Production">Production</option>
              <option value="Installation">Installation</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={status}
              onChange={(e) => setStatus(e.target.value)}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>

        <span className="form-section-label">Module Permissions</span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ maxHeight: '360px', overflow: 'auto' }}>
            <table className="perms-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Read</th>
                  <th>Create</th>
                  <th>Write</th>
                  <th>Delete</th>
                  <th>Report</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {MODULE_GROUPS.flatMap(({ label, modules }) => [
                  <tr className="perms-group-row" key={`g-${label}`}>
                    <td colSpan={7}>{label}</td>
                  </tr>,
                  ...modules.map((mod) => {
                    const p = (perms ?? effectivePerms)[mod] ?? {};
                    const allOn = PERM_FIELDS.every((f) => p[f]);
                    return (
                      <tr key={mod}>
                        <td>{MODULE_LABELS[mod] ?? mod}</td>
                        {PERM_FIELDS.map((field) => (
                          <td key={field}>
                            <button
                              type="button"
                              className={`perm-toggle${p[field] ? ' on' : ''}`}
                              onClick={() => toggle(mod, field)}
                              title={field.replace('can', '')}
                            >
                              {p[field] ? (
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5 6 4.5 9 10.5 3"/></svg>
                              ) : null}
                            </button>
                          </td>
                        ))}
                        <td>
                          <button
                            type="button"
                            className={`perm-all-btn${allOn ? ' on' : ''}`}
                            onClick={() => toggleAll(mod)}
                          >
                            {allOn ? 'Clear' : 'All'}
                          </button>
                        </td>
                      </tr>
                    );
                  }),
                ])}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isPending}>
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function RolesPage() {
  const [editing, setEditing] = useState(null);
  const [search, setSearch]   = useState('');

  const { data: roles = [], isLoading, isError, error } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data),
  });

  const filtered = roles.filter(
    (r) =>
      r.roleCode?.toLowerCase().includes(search.toLowerCase()) ||
      r.roleName?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: '#',         label: '#',                num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'roleCode',  label: 'Role Code',        sort: true, render: (r) => <span className="wip-link">{r.roleCode}</span> },
    { key: 'roleName',  label: 'Role Name',        sort: true },
    { key: 'dataScope', label: 'Department Scope', sort: true },
    {
      key: 'status', label: 'Status', sort: true,
      render: (row) => (
        <Badge variant={row.status === 'Active' ? 'active' : 'inactive'}>
          {row.status ?? 'Active'}
        </Badge>
      ),
    },
    { key: 'userCount', label: 'Users', sort: true, render: (r) => r.userCount ?? 0 },
    {
      key: 'actions', label: '', sort: false,
      render: (row) => (
        <button className="wip-icon-btn wip-icon-btn-edit" title="Edit" onClick={() => setEditing(row)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      ),
    },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="Roles &amp; Permissions"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ Add Role</button>
        }
      />
      {isError && (
        <div style={{ margin: '12px 0', padding: '10px 14px', background: 'var(--red-bg, #fff1f1)', border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)', fontSize: 12 }}>
          Failed to load roles: {error?.response?.data?.message ?? error?.message ?? 'Unknown error'}
        </div>
      )}
      <Table columns={columns} data={filtered} loading={isLoading} />
      {editing && <RoleModal role={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
