import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';

const MODULE_LABELS = {
  PROD: 'Production Timesheets', INST: 'Installation Timesheets', PROJ: 'Projects Timesheets',
  WO_COMPLETE: 'WO Complete', REPORTS: 'Reports', EMPLOYEES: 'Employees',
  DEPARTMENTS: 'Departments', ITEMS: 'Items', MACHINERY: 'Machinery', VEHICLES: 'Vehicles',
  PROJECTS: 'Projects', WORK_ORDERS: 'Work Orders', TASK_TYPES: 'Task Types',
  USERS: 'Users', ROLES: 'Roles', SHIFTS: 'Shifts', DOC_NUMBERING: 'Doc Numbering', SETTINGS: 'Settings',
};

function calcPwStrength(pw) {
  if (!pw) return { score: 0, rules: {} };
  const rules = {
    len:  pw.length >= 8,
    up:   /[A-Z]/.test(pw),
    lo:   /[a-z]/.test(pw),
    num:  /[0-9]/.test(pw),
    sp:   /[^A-Za-z0-9]/.test(pw),
    nsp:  !/\s/.test(pw),
  };
  const score = Object.values(rules).filter(Boolean).length;
  return { score, rules };
}

function PwStrengthBar({ password }) {
  const { score, rules } = calcPwStrength(password);
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];
  const fill = Math.round((score / 6) * 100);
  const color = colors[Math.min(score - 1, 4)] ?? '#e5e7eb';
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg3,#e5e7eb)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${fill}%`, borderRadius: 2, background: color, transition: 'width .2s, background .2s' }} />
      </div>
      <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 11 }}>
        {[
          ['len',  rules.len,  'Min 8 characters'],
          ['up',   rules.up,   'Uppercase letter'],
          ['lo',   rules.lo,   'Lowercase letter'],
          ['num',  rules.num,  'Number'],
          ['sp',   rules.sp,   'Special character'],
          ['nsp',  rules.nsp,  'No spaces'],
        ].map(([key, ok, label]) => (
          <span key={key} style={{ color: ok ? '#16a34a' : 'var(--text3,#9ca3af)' }}>
            {ok ? '✓' : '✗'} {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function UserViewModal({ user, onClose, onEdit }) {
  const initials = (user.displayName ?? user.username ?? '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  return (
    <Modal title="User Details" onClose={onClose}>
      <div className="modal-banner">
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          {/* Profile photo or initials */}
          <div style={{ width:52, height:52, borderRadius:'50%', overflow:'hidden', flexShrink:0, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:18, border:'2px solid var(--border2)' }}>
            {user.profileImageUrl
              ? <img src={user.profileImageUrl} alt={initials} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{ e.target.style.display='none'; }} />
              : initials}
          </div>
          <div>
            <div className="modal-banner-title">{user.displayName || user.username}</div>
            <div className="modal-banner-sub">{[user.roleName ?? user.roleCode, user.departmentCode].filter(Boolean).join(' · ') || '—'}</div>
          </div>
        </div>
        <div className="modal-banner-right">
          <Badge variant={user.status === 'Active' ? 'active' : 'inactive'}>{user.status}</Badge>
          <span className="wip-link" style={{ fontSize: 12 }}>ID: {user.userId ?? '—'}</span>
        </div>
      </div>
      <div className="detail-grid-2col">
        <div className="detail-row"><span>User ID</span><span className="wip-link">{user.userId ?? '—'}</span></div>
        <div className="detail-row"><span>Username</span><span>{user.username ?? '—'}</span></div>
        <div className="detail-row"><span>Display Name</span><span>{user.displayName ?? '—'}</span></div>
        <div className="detail-row"><span>Role</span><span>{user.roleName ?? user.roleCode ?? '—'}</span></div>
        <div className="detail-row"><span>Department</span><span>{user.departmentCode ?? '—'}</span></div>
        <div className="detail-row"><span>Employee Code</span><span>{user.employeeCode ?? '—'}</span></div>
        <div className="detail-row"><span>Email</span><span>{user.email ?? '—'}</span></div>
        <div className="detail-row"><span>Phone</span><span>{user.phone ?? '—'}</span></div>
        <div className="detail-row"><span>Status</span><Badge variant={user.status === 'Active' ? 'active' : 'inactive'}>{user.status}</Badge></div>
        <div className="detail-row"><span>Last Login</span><span>{(user.lastLoginAt || user.lastLogin) ? new Date(user.lastLoginAt ?? user.lastLogin).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}</span></div>
        <div className="detail-row"><span>Created</span><span>{user.createdAt ? new Date(user.createdAt).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}</span></div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        <button type="button" className="btn btn-primary" onClick={() => { onClose(); onEdit(user); }}>Edit</button>
      </div>
    </Modal>
  );
}

function UserModal({ user, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(user.userId);

  const [form, setForm] = useState({
    username:        user.username       ?? '',
    displayName:     user.displayName    ?? '',
    roleCode:        user.roleCode       ?? '',
    employeeCode:    user.employeeCode   ?? '',
    departmentCode:  user.departmentCode ?? '',
    email:           user.email          ?? '',
    phone:           user.phone          ?? '',
    status:          user.status         ?? 'Active',
    password:        '',
    confirmPassword: '',
  });
  const [showPwStrength, setShowPwStrength] = useState(false);
  const [tempPwResult, setTempPwResult] = useState(null);
  const [linkedEmp, setLinkedEmp] = useState(null);

  const { data: roles       = [] } = useQuery({ queryKey: ['roles'],       queryFn: () => api.get('/roles').then((r) => r.data) });
  const { data: employees   = [] } = useQuery({ queryKey: ['employees'],   queryFn: () => api.get('/employees').then((r) => r.data) });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments').then((r) => r.data) });

  const activeDepts = departments.filter((d) => d.isActive !== false && d.isActive !== 0);

  const { data: rolePerms = [] } = useQuery({
    queryKey: ['role-perms', form.roleCode],
    queryFn: () => api.get(`/roles/${form.roleCode}/permissions`).then((r) => r.data),
    enabled: Boolean(form.roleCode),
  });

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload) =>
      isEdit
        ? api.patch(`/users/${user.userId}`, payload).then((r) => r.data)
        : api.post('/users', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast(isEdit ? 'User updated.' : 'User created.', 'success');
      onClose();
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const { mutate: resetPw, isPending: resetting } = useMutation({
    mutationFn: () => api.post(`/users/${user.userId}/reset-password`).then((r) => r.data),
    onSuccess: (data) => setTempPwResult(data.tempPassword),
    onError: (err) => toast(err?.response?.data?.message ?? 'Reset failed.', 'error'),
  });

  function onEmployeeChange(empCode) {
    const emp = employees.find((e) => e.employeeNo === empCode);
    setForm((f) => ({
      ...f,
      employeeCode: empCode,
      departmentCode: emp?.departmentCode ?? f.departmentCode,
      displayName: emp ? [emp.firstName, emp.lastname].filter(Boolean).join(' ') : f.displayName,
      email: emp?.emailId && !f.email ? emp.emailId : f.email,
    }));
    setLinkedEmp(emp ?? null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (form.password && form.password !== form.confirmPassword) {
      toast('Passwords do not match.', 'error');
      return;
    }
    const payload = { ...form };
    delete payload.confirmPassword;
    if (!payload.password) delete payload.password;
    save(payload);
  }

  const activePerms = rolePerms.filter((p) => p.canRead || p.canCreate || p.canWrite || p.canDelete || p.canReport);

  if (tempPwResult) {
    return (
      <Modal title="Temporary Password" onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
            Temporary password for <strong>{user.username}</strong>:
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 20, fontWeight: 700, letterSpacing: 2,
            padding: '12px 24px', background: 'var(--bg2)', borderRadius: 8,
            border: '1px solid var(--border)', userSelect: 'all', color: 'var(--accent)',
          }}>
            {tempPwResult}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12 }}>
            User will be required to change password on next login.
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-primary" onClick={() => { navigator.clipboard?.writeText(tempPwResult); toast('Copied to clipboard.', 'success'); }}>Copy</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={isEdit ? 'Edit User' : 'Create Login User'} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>
        <span className="form-section-label">Login Details</span>
        <div className="form-grid-2">
          {isEdit && (
            <div className="form-group">
              <label className="form-label">User ID</label>
              <input className="form-control" value={user.userId ?? ''} readOnly
                style={{ background: 'var(--bg2)', color: 'var(--text3)' }} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Username <span style={{ color: 'var(--red)' }}>*</span></label>
            <input className="form-control" required placeholder="sara.k" value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Display Name <span style={{ color: 'var(--red)' }}>*</span></label>
            <input className="form-control" required placeholder="Sara Khalid" value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">
              Password{' '}
              {isEdit && <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}>(leave blank to keep current)</span>}
            </label>
            <input className="form-control" type="password" placeholder="••••••••" value={form.password}
              required={!isEdit}
              onChange={(e) => { setForm((f) => ({ ...f, password: e.target.value })); setShowPwStrength(true); }}
              onFocus={() => setShowPwStrength(true)} />
            {showPwStrength && form.password && <PwStrengthBar password={form.password} />}
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className="form-control" type="password" placeholder="••••••••" value={form.confirmPassword}
              required={!isEdit || Boolean(form.password)}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} />
          </div>
        </div>

        <span className="form-section-label">Role &amp; Access</span>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Role <span style={{ color: 'var(--red)' }}>*</span></label>
            <select className="form-control" required value={form.roleCode}
              onChange={(e) => setForm((f) => ({ ...f, roleCode: e.target.value }))}>
              <option value="">— Select —</option>
              {roles.map((r) => <option key={r.roleCode} value={r.roleCode}>{r.roleName}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <span className="form-section-label">Profile &amp; Assignment</span>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">
              Employee Code <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}>(optional)</span>
            </label>
            <select className="form-control" value={form.employeeCode}
              onChange={(e) => onEmployeeChange(e.target.value)}>
              <option value="">— Not linked —</option>
              {employees.map((emp) => (
                <option key={emp.employeeNo} value={emp.employeeNo}>
                  {emp.employeeNo} – {[emp.firstName, emp.lastname].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
          </div>

          {linkedEmp?.imageUrl && (
            <div className="form-group">
              <label className="form-label">Employee Photo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={linkedEmp.imageUrl} alt={linkedEmp.firstName}
                  style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                  onError={(e) => { e.target.style.display = 'none'; }} />
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                  {[linkedEmp.firstName, linkedEmp.lastname].filter(Boolean).join(' ')} · {linkedEmp.departmentCode ?? '—'}
                </span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-control" value={form.departmentCode}
              onChange={(e) => setForm((f) => ({ ...f, departmentCode: e.target.value }))}>
              <option value="">— Select —</option>
              {activeDepts.map((d) => (
                <option key={d.departmentCode ?? d.departmentId} value={d.departmentCode ?? String(d.departmentId)}>
                  {d.departmentCode ?? String(d.departmentId)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" placeholder="sara@company.com" value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">
              Phone <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}>(optional)</span>
            </label>
            <input className="form-control" placeholder="+971 5x xxx xxxx" value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>

        {activePerms.length > 0 && (
          <div style={{ marginTop: 4, padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 8 }}>Granted Modules</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {activePerms.map((p) => (
                <span key={p.module} style={{ padding: '3px 9px', background: 'var(--accent-bg,var(--blue-bg))', color: 'var(--accent,var(--blue))', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                  {MODULE_LABELS[p.module] ?? p.module}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="modal-foot">
          {isEdit && (
            <button type="button" className="btn btn-ghost" disabled={resetting} onClick={() => resetPw()}>
              {resetting ? 'Generating…' : 'Temp Password'}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading, isError, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const { mutate: unlock } = useMutation({
    mutationFn: (userId) => api.post(`/users/${userId}/unlock`).then((r) => r.data),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast(data.message ?? 'User unlocked.', 'success'); },
    onError: (err) => toast(err?.response?.data?.message ?? 'Unlock failed.', 'error'),
  });

  const filtered = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: '#',           label: '#',            num: true,  sort: false, render: (_, i) => i + 1 },
    {
      key: 'avatar', label: '', sort: false, width: '44px',
      render: (r) => {
        const ini = (r.displayName ?? r.username ?? '?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        return (
          <div style={{ width:32,height:32,borderRadius:'50%',overflow:'hidden',background:'var(--accent)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,flexShrink:0 }}>
            {r.profileImageUrl
              ? <img src={r.profileImageUrl} alt={ini} style={{ width:'100%',height:'100%',objectFit:'cover' }} onError={e=>{e.target.style.display='none';}} />
              : ini}
          </div>
        );
      },
    },
    { key: 'userId',      label: 'User ID',      sort: true, render: (r) => <span className="wip-link">{r.userId ?? '—'}</span> },
    { key: 'username',    label: 'Username',     sort: true },
    { key: 'displayName', label: 'Display Name', sort: true },
    { key: 'roleName',    label: 'Role',         sort: true, render: (r) => r.roleName ?? r.roleCode ?? '—' },
    { key: 'email',       label: 'Email',        sort: true },
    {
      key: 'status', label: 'Status', sort: true,
      render: (row) => <Badge variant={row.status === 'Active' ? 'active' : 'inactive'}>{row.status}</Badge>,
    },
    {
      key: 'actions', label: '', sort: false,
      render: (row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="wip-icon-btn wip-icon-btn-view" title="View" onClick={() => setViewing(row)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button className="wip-icon-btn wip-icon-btn-edit" title="Edit" onClick={() => setEditing(row)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          {!!row.isLocked && (
            <button className="wip-icon-btn wip-icon-btn-delete" title="Unlock"
              onClick={() => { if (confirm(`Unlock user ${row.username}?`)) unlock(row.userId); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="User List"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ Add User</button>
        }
      />
      {isError && (
        <div style={{ margin: '12px 0', padding: '10px 14px', background: 'var(--red-bg, #fff1f1)', border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)', fontSize: 12 }}>
          Failed to load users: {error?.response?.data?.message ?? error?.message ?? 'Unknown error'}
        </div>
      )}
      <Table columns={columns} data={filtered} loading={isLoading} />
      {viewing && <UserViewModal user={viewing} onClose={() => setViewing(null)} onEdit={setEditing} />}
      {editing && <UserModal user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
