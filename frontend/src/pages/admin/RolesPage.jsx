import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { usePermission } from '../../hooks/usePermission';

/* ── Design tokens (mirrors QC module palette) ──────────── */
const G = {
  timesheets:  { color: '#0f7173', bg: '#e6f3f3', border: '#0f7173' },
  qc:          { color: '#7c3aed', bg: '#ede9fe', border: '#7c3aed' },
  reports:     { color: '#2563eb', bg: '#dbeafe', border: '#2563eb' },
  master:      { color: '#d97706', bg: '#fef3c7', border: '#d97706' },
  admin:       { color: '#dc2626', bg: '#fee2e2', border: '#dc2626' },
};
const GROUP_STYLE = [G.timesheets, G.qc, G.reports, G.master, G.admin];

const PM = [
  { field: 'canRead',    short: 'Read',    color: '#2563eb', bg: '#dbeafe' },
  { field: 'canCreate',  short: 'Create',  color: '#16a34a', bg: '#dcfce7' },
  { field: 'canWrite',   short: 'Write',   color: '#d97706', bg: '#fef3c7' },
  { field: 'canDelete',  short: 'Delete',  color: '#dc2626', bg: '#fee2e2' },
  { field: 'canReport',  short: 'Report',  color: '#7c3aed', bg: '#ede9fe' },
  { field: 'canApprove', short: 'Approve', color: '#0f7173', bg: '#e6f3f3' },
];

const MODULE_LABELS = {
  PROD: 'Production Timesheets', INST: 'Installation Timesheets', PROJ: 'Projects Timesheets',
  PENDING_APPROVALS: 'Pending Approvals', TIMELINE: 'Timeline',
  WO_COMPLETE: 'WO Complete', QC: 'Quality Control (QC)',
  REPORTS: 'Reports & Analytics', AUDIT_TRAIL: 'Audit Trail',
  EMPLOYEES: 'Employees', DEPARTMENTS: 'Departments', ITEMS: 'Items',
  MACHINERY: 'Machinery', VEHICLES: 'Vehicles', ACCESS_EQUIPMENT: 'Access Equipment',
  PROJECTS: 'Projects', WORK_ORDERS: 'Work Orders', TASK_TYPES: 'Task Types',
  USERS: 'Users', ROLES: 'Roles', SHIFTS: 'Shifts', DOC_NUMBERING: 'Doc Numbering',
  SETTINGS: 'Settings', NOTIFICATIONS: 'Notification Settings',
  HOD_TEAMS: 'HOD Teams',
};

const MODULE_GROUPS = [
  { label: 'Timesheets',      modules: ['PROD', 'INST', 'PROJ', 'PENDING_APPROVALS', 'TIMELINE', 'WO_COMPLETE'] },
  { label: 'Quality Control', modules: ['QC'] },
  { label: 'Reports',         modules: ['REPORTS', 'AUDIT_TRAIL'] },
  { label: 'Master Data',     modules: ['EMPLOYEES', 'DEPARTMENTS', 'ITEMS', 'MACHINERY', 'VEHICLES', 'ACCESS_EQUIPMENT', 'PROJECTS', 'WORK_ORDERS', 'TASK_TYPES'] },
  { label: 'Administration',  modules: ['USERS', 'ROLES', 'SHIFTS', 'DOC_NUMBERING', 'SETTINGS', 'NOTIFICATIONS', 'HOD_TEAMS'] },
];

const ALL_MODULES = MODULE_GROUPS.flatMap((g) => g.modules);
const PERM_FIELDS = ['canRead', 'canCreate', 'canWrite', 'canDelete', 'canReport', 'canApprove'];

/* ── Confirm delete dialog ────────────────────────────────── */
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,14,4,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(3px)' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '28px 28px 22px', maxWidth: 380, width: '90%', boxShadow: 'var(--sh-lg)', border: '1px solid var(--border2)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Confirm</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 22, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn" style={{ background: '#dc2626', color: '#fff', border: 'none' }} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ── Print / Export helper ───────────────────────────────── */
function printRole(role, perms, moduleGroups, moduleLabels) {
  const rows = moduleGroups.flatMap(({ label, modules }) => [
    `<tr style="background:#f1f5f9"><td colspan="7" style="padding:6px 10px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#475569">${label}</td></tr>`,
    ...modules.map(mod => {
      const p = perms[mod] ?? {};
      const cell = (f, col) => `<td style="text-align:center;padding:5px 6px"><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${p[f] ? col : '#e2e8f0'}">&nbsp;</span></td>`;
      return `<tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:5px 10px;font-size:12px">${moduleLabels[mod] ?? mod}</td>
        ${cell('canRead','#2563eb')}${cell('canCreate','#16a34a')}${cell('canWrite','#d97706')}
        ${cell('canDelete','#dc2626')}${cell('canReport','#7c3aed')}${cell('canApprove','#0f7173')}
      </tr>`;
    }),
  ]).join('');

  const html = `<!DOCTYPE html><html><head><title>Role: ${role.roleCode}</title>
  <style>body{font-family:system-ui,sans-serif;margin:32px;color:#0f172a}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#0f7173;color:#fff;padding:7px 10px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.5px}th:first-child{text-align:left}.meta{display:flex;gap:24px;margin-bottom:20px;background:#f8fafc;border-radius:8px;padding:14px 18px}.meta-item label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b}.meta-item div{font-size:14px;font-weight:600;margin-top:2px}h1{font-size:20px;margin-bottom:4px}p{color:#64748b;font-size:12px;margin-bottom:20px}@media print{body{margin:16px}}</style>
  </head><body>
  <h1>Role: ${role.roleName} <span style="font-size:13px;color:#64748b;font-weight:400">(${role.roleCode})</span></h1>
  <p>${role.description || 'No description'}</p>
  <div class="meta">
    <div class="meta-item"><label>Data Scope</label><div>${role.dataScope ?? 'All'}</div></div>
    <div class="meta-item"><label>Status</label><div>${role.status ?? 'Active'}</div></div>
    <div class="meta-item"><label>Users</label><div>${role.userCount ?? 0}</div></div>
    <div class="meta-item"><label>Printed</label><div>${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div></div>
  </div>
  <table><thead><tr><th style="text-align:left;min-width:180px">Module</th>
    <th style="color:#93c5fd">Read</th><th style="color:#86efac">Create</th>
    <th style="color:#fcd34d">Write</th><th style="color:#fca5a5">Delete</th>
    <th style="color:#c4b5fd">Report</th><th style="color:#5eead4">Approve</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <script>window.onload=()=>window.print()</script></body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

function RoleModal({ role, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab,         setTab]         = useState('permissions'); // 'permissions' | 'users' | 'history'
  const [roleName,    setRoleName]    = useState(role.roleName    ?? '');
  const [description, setDescription] = useState(role.description ?? '');
  const [dataScope,   setDataScope]   = useState(role.dataScope   ?? 'All');
  const [status,      setStatus]      = useState(role.status      ?? 'Active');

  const { data: existingPerms = [] } = useQuery({
    queryKey: ['role-perms', role.roleCode],
    queryFn: () => role.roleCode ? api.get(`/roles/${role.roleCode}/permissions`).then((r) => r.data) : [],
    enabled: Boolean(role.roleCode),
  });
  const { data: assignedUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['role-users', role.roleCode],
    queryFn: () => api.get(`/roles/${role.roleCode}/users`).then((r) => r.data),
    enabled: Boolean(role.roleCode) && tab === 'users',
  });
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['role-history', role.roleCode],
    queryFn: () => api.get(`/roles/${role.roleCode}/history`).then((r) => r.data),
    enabled: Boolean(role.roleCode) && tab === 'history',
  });

  const [perms, setPerms] = useState(null);
  const effectivePerms = perms ?? (() => {
    const map = {};
    existingPerms.forEach((p) => { map[p.module] = p; });
    ALL_MODULES.forEach((m) => {
      if (!map[m]) map[m] = { module: m, canRead: false, canCreate: false, canWrite: false, canDelete: false, canReport: false, canApprove: false };
    });
    return map;
  })();

  const { mutate: saveRole, isPending } = useMutation({
    mutationFn: async (payload) => {
      let roleCode = role.roleCode;
      if (roleCode) {
        await api.patch(`/roles/${roleCode}`, { roleName: payload.roleName, description: payload.description, dataScope: payload.dataScope, status: payload.status });
      } else {
        const res = await api.post('/roles', { roleName: payload.roleName, description: payload.description, dataScope: payload.dataScope, status: payload.status }).then((r) => r.data);
        roleCode = res.roleCode;
      }
      await api.put(`/roles/${roleCode}/permissions`, { permissions: Object.values(payload.perms) });
      return { roleCode };
    },
    onSuccess: ({ roleCode }) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['role-perms', roleCode] });
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
      return { ...base, [module]: PERM_FIELDS.reduce((acc, f) => ({ ...acc, [f]: !allOn }), { module }) };
    });
  }
  function toggleGroup(modules) {
    setPerms((prev) => {
      const base = prev ?? effectivePerms;
      const groupAllOn = modules.every((m) => PERM_FIELDS.every((f) => base[m]?.[f]));
      const updated = { ...base };
      modules.forEach((m) => { updated[m] = PERM_FIELDS.reduce((acc, f) => ({ ...acc, [f]: !groupAllOn }), { module: m }); });
      return updated;
    });
  }

  const isEdit = Boolean(role.roleCode);
  const ep = perms ?? effectivePerms;
  const totalEnabled = ALL_MODULES.reduce((n, m) => n + PERM_FIELDS.filter((f) => ep[m]?.[f]).length, 0);

  const TABS = isEdit ? [
    { key: 'permissions', label: 'Permissions' },
    { key: 'users',       label: `Users${assignedUsers.length ? ` (${assignedUsers.length})` : ''}` },
    { key: 'history',     label: 'History' },
  ] : [];

  return (
    <Modal title={isEdit ? 'Edit Role' : 'Add Role'} onClose={onClose} size="lg">
      <form onSubmit={(e) => { e.preventDefault(); saveRole({ roleName, description, dataScope, status, perms: ep }); }}>

        {/* ── Role info strip ───────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
          {isEdit && (
            <div style={{ flex: '0 0 120px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Role Code</div>
              <input type="text" value={role.roleCode} readOnly className="form-control" style={{ background: 'var(--bg2)', color: 'var(--text3)', fontSize: 13 }} />
            </div>
          )}
          <div style={{ flex: '1 1 160px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Role Name <span style={{ color: 'var(--red)' }}>*</span></div>
            <input type="text" required className="form-control" value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Timesheet Controller" style={{ fontSize: 13 }} />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Data Scope</div>
            <select className="form-control" value={dataScope} onChange={(e) => setDataScope(e.target.value)} style={{ fontSize: 13 }}>
              <option value="All">All — see every record</option>
              <option value="Own">Own — only records they entered</option>
              <option value="OwnDept">Dept — all records in their department</option>
            </select>
          </div>
          <div style={{ flex: '0 0 100px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Status</div>
            <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)} style={{ fontSize: 13 }}>
              <option>Active</option><option>Inactive</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Description</div>
          <input type="text" className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Briefly describe the purpose of this role…" style={{ fontSize: 13 }} />
        </div>

        {/* ── Tab bar (edit only) ───────────────────────── */}
        {isEdit && (
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border2)', marginBottom: 14, gap: 0 }}>
            {TABS.map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                style={{ padding: '7px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: tab === key ? '#0f7173' : 'var(--text3)', borderBottom: `2px solid ${tab === key ? '#0f7173' : 'transparent'}`, marginBottom: -2, transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
            {tab === 'permissions' && (
              <button type="button" onClick={() => printRole({ ...role, roleName, description, dataScope, status }, ep, MODULE_GROUPS, MODULE_LABELS)}
                style={{ marginLeft: 'auto', padding: '5px 12px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Export
              </button>
            )}
          </div>
        )}

        {/* ── Permissions tab ───────────────────────────── */}
        {tab === 'permissions' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Module Permissions</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {PM.map(({ short, color, bg }) => (
                  <span key={short} style={{ padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: bg, color }}>{short}</span>
                ))}
                {totalEnabled > 0 && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#16a34a', marginLeft: 2 }}>{totalEnabled} on</span>}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MODULE_GROUPS.map(({ label, modules }, gi) => {
                const gs = GROUP_STYLE[gi] ?? G.admin;
                const groupAllOn = modules.every((m) => PERM_FIELDS.every((f) => ep[m]?.[f]));
                const enabledMods = modules.filter((m) => PERM_FIELDS.some((f) => ep[m]?.[f])).length;
                return (
                  <div key={label} style={{ background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border2)', borderLeft: `4px solid ${gs.color}`, boxShadow: 'var(--sh-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: gs.bg + '55', borderBottom: '1px solid var(--border)', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: gs.color, flex: 1 }}>{label}</span>
                      {enabledMods > 0 && <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: gs.bg, color: gs.color }}>{enabledMods}/{modules.length}</span>}
                      <button type="button" onClick={() => toggleGroup(modules)}
                        style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${gs.color}40`, background: groupAllOn ? gs.color : 'transparent', color: groupAllOn ? '#fff' : gs.color, transition: 'all 0.15s' }}>
                        {groupAllOn ? 'Clear all' : 'Enable all'}
                      </button>
                    </div>
                    {modules.map((mod, mi) => {
                      const p = ep[mod] ?? {};
                      const anyOn = PERM_FIELDS.some((f) => p[f]);
                      const allOn = PERM_FIELDS.every((f) => p[f]);
                      return (
                        <div key={mod} style={{ display: 'flex', alignItems: 'center', padding: '7px 12px', borderBottom: mi < modules.length - 1 ? '1px solid var(--border)' : 'none', gap: 8, background: anyOn ? gs.bg + '22' : 'var(--surface)', transition: 'background 0.12s' }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: allOn ? gs.color : anyOn ? gs.color + 'aa' : 'var(--border2)', transition: 'background 0.15s' }} />
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: anyOn ? 'var(--text)' : 'var(--text3)' }}>{MODULE_LABELS[mod] ?? mod}</span>
                          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border2)', flexShrink: 0 }}>
                            {PM.map(({ field, short, color, bg }, pi) => (
                              <button key={field} type="button" onClick={() => toggle(mod, field)}
                                style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', borderRight: pi < PM.length - 1 ? '1px solid var(--border2)' : 'none', background: p[field] ? bg : 'var(--surface)', color: p[field] ? color : 'var(--text3)', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
                                {short.slice(0, 3)}
                              </button>
                            ))}
                          </div>
                          <button type="button" onClick={() => toggleAll(mod)}
                            style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${allOn ? gs.color : 'var(--border2)'}`, background: allOn ? gs.color : 'transparent', color: allOn ? '#fff' : 'var(--text3)', transition: 'all 0.15s', flexShrink: 0, minWidth: 36 }}>
                            {allOn ? 'Clear' : 'All'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Users tab ────────────────────────────────── */}
        {tab === 'users' && (
          <div>
            {usersLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
            ) : assignedUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>
                <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>👤</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No users assigned to this role</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{assignedUsers.length} user{assignedUsers.length !== 1 ? 's' : ''} assigned</div>
                {assignedUsers.map((u) => {
                  const ini = (u.displayName || u.username || '?')[0].toUpperCase();
                  const isActive = u.status === 'Active';
                  return (
                    <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#0f7173,#1a9496)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{ini}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{u.displayName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{u.username}{u.employeeCode ? ` · ${u.employeeCode}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: isActive ? '#dcfce7' : '#f3f4f6', color: isActive ? '#16a34a' : '#6b7280' }}>{u.status}</span>
                        {u.lastLoginAt && (
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                            Last login {new Date(u.lastLoginAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── History tab ───────────────────────────────── */}
        {tab === 'history' && (
          <div>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>
                <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>📋</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No history yet</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {history.map((h, i) => {
                  const actionColor = h.action === 'DELETE' ? '#dc2626' : h.action === 'CREATE' ? '#16a34a' : '#2563eb';
                  const actionBg    = h.action === 'DELETE' ? '#fee2e2' : h.action === 'CREATE' ? '#dcfce7' : '#dbeafe';
                  return (
                    <div key={h.id ?? i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: actionBg, color: actionColor, flexShrink: 0, marginTop: 2 }}>{h.action}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{h.details || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>by {h.performedByName ?? '—'}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                        {h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ───────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
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
  const toast        = useToast();
  const queryClient  = useQueryClient();
  const [editing,    setEditing]    = useState(null);
  const [search,     setSearch]     = useState('');
  const [confirmDel, setConfirmDel] = useState(null); // role row to delete
  const canWrite  = usePermission('ROLES', 'canWrite');
  const canCreate = usePermission('ROLES', 'canCreate');
  const canDelete = usePermission('ROLES', 'canDelete');

  const { data: roles = [], isLoading, isError, error } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data),
  });

  const { mutate: cloneRole, isPending: cloning } = useMutation({
    mutationFn: (roleCode) => api.post(`/roles/${roleCode}/clone`).then((r) => r.data),
    onSuccess: (newRole) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast(`Cloned as ${newRole.roleCode}. Open it to rename.`, 'success');
      setEditing(newRole);
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Clone failed.', 'error'),
  });

  const { mutate: deleteRole, isPending: deleting } = useMutation({
    mutationFn: (roleCode) => api.delete(`/roles/${roleCode}`).then((r) => r.data),
    onSuccess: (_, roleCode) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast(`Role ${roleCode} deleted.`, 'success');
      setConfirmDel(null);
    },
    onError: (err) => { toast(err?.response?.data?.message ?? 'Delete failed.', 'error'); setConfirmDel(null); },
  });

  const filtered = roles.filter(
    (r) =>
      r.roleCode?.toLowerCase().includes(search.toLowerCase()) ||
      r.roleName?.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase())
  );

  /* ── Icon SVGs ───────────────────────────────────── */
  const EditIcon   = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
  const CloneIcon  = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
  const TrashIcon  = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;

  const columns = [
    { key: '#',          label: '#',           num: true, sort: false, render: (_, i) => i + 1 },
    { key: 'roleCode',   label: 'Role Code',   sort: true, render: (r) => <span className="wip-link">{r.roleCode}</span> },
    { key: 'roleName',   label: 'Role Name',   sort: true },
    {
      key: 'description', label: 'Description', sort: false,
      render: (r) => r.description
        ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>{r.description}</span>
        : <span style={{ fontSize: 11, color: 'var(--border2)', fontStyle: 'italic' }}>—</span>,
    },
    {
      key: 'dataScope', label: 'Scope', sort: true,
      render: (r) => {
        const map = { All: 'All', Own: 'Own', OwnDept: 'Dept' };
        const label = map[r.dataScope] ?? r.dataScope ?? 'All';
        const color = r.dataScope === 'Own' ? '#7c3aed' : r.dataScope === 'OwnDept' ? '#0369a1' : '#374151';
        const bg    = r.dataScope === 'Own' ? '#ede9fe' : r.dataScope === 'OwnDept' ? '#e0f2fe' : '#f3f4f6';
        const title = r.dataScope === 'Own' ? 'Only records entered by the user' : r.dataScope === 'OwnDept' ? 'All records in their assigned department' : 'All records';
        return <span title={title} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, color, background: bg, cursor: 'help' }}>{label}</span>;
      },
    },
    {
      key: 'status', label: 'Status', sort: true,
      render: (row) => (
        <Badge variant={row.status === 'Active' ? 'active' : 'inactive'}>{row.status ?? 'Active'}</Badge>
      ),
    },
    { key: 'userCount', label: 'Users', sort: true, render: (r) => r.userCount ?? 0 },
    {
      key: 'actions', label: '', sort: false,
      render: (row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {canWrite && (
            <button className="wip-icon-btn wip-icon-btn-edit" title="Edit" onClick={() => setEditing(row)}>{EditIcon}</button>
          )}
          {canCreate && (
            <button className="wip-icon-btn" title="Clone" disabled={cloning} onClick={() => cloneRole(row.roleCode)}
              style={{ color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 5, padding: '3px 6px', background: 'var(--surface)', cursor: 'pointer' }}>
              {CloneIcon}
            </button>
          )}
          {canDelete && (
            <button className="wip-icon-btn wip-icon-btn-del" title="Delete" onClick={() => setConfirmDel(row)}
              style={{ color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 5, padding: '3px 6px', background: '#fff5f5', cursor: 'pointer' }}>
              {TrashIcon}
            </button>
          )}
        </div>
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
        actions={canCreate && <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ Add Role</button>}
      />
      {isError && (
        <div style={{ margin: '12px 0', padding: '10px 14px', background: '#fff1f1', border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)', fontSize: 12 }}>
          Failed to load roles: {error?.response?.data?.message ?? error?.message ?? 'Unknown error'}
        </div>
      )}
      <Table columns={columns} data={filtered} loading={isLoading} />
      {editing && <RoleModal role={editing} onClose={() => setEditing(null)} />}
      {confirmDel && (
        <ConfirmDialog
          message={`Delete role "${confirmDel.roleName}" (${confirmDel.roleCode})?${confirmDel.userCount > 0 ? ` This role has ${confirmDel.userCount} assigned user(s) — deletion will be blocked.` : ' This cannot be undone.'}`}
          onConfirm={() => deleteRole(confirmDel.roleCode)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
