import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';

/* ── helpers ──────────────────────────────────────────────── */
function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Avatar({ name, url, size = 32 }) {
  const ini = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#0f7173,#1a9496)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
      {url
        ? <img src={url} alt={ini} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
        : ini}
    </div>
  );
}

function calcPwStrength(pw) {
  if (!pw) return { score: 0, rules: {} };
  const rules = { len: pw.length >= 8, up: /[A-Z]/.test(pw), lo: /[a-z]/.test(pw), num: /[0-9]/.test(pw), sp: /[^A-Za-z0-9]/.test(pw), nsp: !/\s/.test(pw) };
  return { score: Object.values(rules).filter(Boolean).length, rules };
}

function PwStrengthBar({ password }) {
  const { score, rules } = calcPwStrength(password);
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];
  const fill = Math.round((score / 6) * 100);
  const color = colors[Math.min(score - 1, 4)] ?? '#e5e7eb';
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${fill}%`, borderRadius: 2, background: color, transition: 'width .2s, background .2s' }} />
      </div>
      <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 11 }}>
        {[['len', rules.len, 'Min 8 chars'], ['up', rules.up, 'Uppercase'], ['lo', rules.lo, 'Lowercase'], ['num', rules.num, 'Number'], ['sp', rules.sp, 'Special char'], ['nsp', rules.nsp, 'No spaces']].map(([k, ok, lbl]) => (
          <span key={k} style={{ color: ok ? '#16a34a' : 'var(--text3)' }}>{ok ? '✓' : '✗'} {lbl}</span>
        ))}
      </div>
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Delete', confirmColor = '#dc2626' }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,14,4,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(3px)' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '28px 28px 22px', maxWidth: 400, width: '90%', boxShadow: 'var(--sh-lg)', border: '1px solid var(--border2)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Confirm</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 22, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn" style={{ background: confirmColor, color: '#fff', border: 'none' }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ── View modal (tabs: Details | Login History | Audit History) ─ */
function UserViewModal({ user, onClose, onEdit }) {
  const [tab, setTab] = useState('details');

  const { data: loginHistory = [], isLoading: loginLoading } = useQuery({
    queryKey: ['user-login-history', user.userId],
    queryFn: () => api.get(`/users/${user.userId}/login-history`).then(r => r.data),
    enabled: tab === 'login',
  });
  const { data: auditHistory = [], isLoading: auditLoading } = useQuery({
    queryKey: ['user-audit-history', user.userId],
    queryFn: () => api.get(`/users/${user.userId}/history`).then(r => r.data),
    enabled: tab === 'audit',
  });

  const TABS = [
    { key: 'details', label: 'Details' },
    { key: 'login',   label: `Login History` },
    { key: 'audit',   label: 'Change History' },
  ];

  return (
    <Modal title="User Details" onClose={onClose} size="lg">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
        <Avatar name={user.displayName ?? user.username} url={user.profileImageUrl} size={52} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{user.displayName || user.username}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{[user.roleName ?? user.roleCode, user.departmentCode].filter(Boolean).join(' · ') || '—'}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <Badge variant={user.status === 'Active' ? 'active' : 'inactive'}>{user.status}</Badge>
          {user.isLocked && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#fee2e2', color: '#dc2626' }}>LOCKED</span>}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border2)', marginBottom: 16, gap: 0 }}>
        {TABS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: tab === key ? '#0f7173' : 'var(--text3)', borderBottom: `2px solid ${tab === key ? '#0f7173' : 'transparent'}`, marginBottom: -2, transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === 'details' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          {[
            ['User ID',       user.userId],
            ['Username',      user.username],
            ['Display Name',  user.displayName],
            ['Role',          user.roleName ?? user.roleCode],
            ['Department',    user.departmentCode],
            ['Employee Code', user.employeeCode],
            ['Email',         user.email],
            ['Phone',         user.phone],
            ['Status',        null, <Badge variant={user.status === 'Active' ? 'active' : 'inactive'}>{user.status}</Badge>],
            ['Last Login',    fmtDateTime(user.lastLoginAt)],
            ['Created',       fmtDateTime(user.createdAt)],
            ['Must Change PW',user.mustChangePassword ? 'Yes — pending' : 'No'],
          ].map(([label, val, node]) => (
            <div key={label} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{node ?? (val || '—')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Login history tab */}
      {tab === 'login' && (
        <div>
          {loginLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
          ) : loginHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: 32, opacity: 0.25, marginBottom: 10 }}>🔑</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>No login history found</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {loginHistory.map((h, i) => (
                <div key={h.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < loginHistory.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: h.success ? '#16a34a' : '#dc2626', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: h.success ? 'var(--text)' : '#dc2626' }}>{h.success ? 'Successful login' : (h.failReason || 'Failed login')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{[h.ipAddress, h.city, h.country].filter(Boolean).join(' · ') || 'No location data'}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{fmtDateTime(h.attemptAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit history tab */}
      {tab === 'audit' && (
        <div>
          {auditLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
          ) : auditHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: 32, opacity: 0.25, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>No change history yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {auditHistory.map((h, i) => {
                const col = h.action === 'DELETE' ? '#dc2626' : h.action === 'CREATE' ? '#16a34a' : '#2563eb';
                const bg  = h.action === 'DELETE' ? '#fee2e2' : h.action === 'CREATE' ? '#dcfce7' : '#dbeafe';
                return (
                  <div key={h.id ?? i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: i < auditHistory.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
                    <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: bg, color: col, flexShrink: 0, marginTop: 1 }}>{h.action}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{h.details || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>by {h.performedByName ?? '—'}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{fmtDate(h.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        <button type="button" className="btn btn-primary" onClick={() => { onClose(); onEdit(user); }}>Edit</button>
      </div>
    </Modal>
  );
}

/* ── Temp password screen ─────────────────────────────────── */
function TempPwScreen({ username, tempPw, onClose }) {
  const toast = useToast();
  return (
    <Modal title="Temporary Password" onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Temporary password for <strong>{username}</strong>:</div>
        <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, letterSpacing: 3, padding: '14px 24px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', userSelect: 'all', color: '#0f7173' }}>{tempPw}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12 }}>User will be required to change password on next login.</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => { navigator.clipboard?.writeText(tempPw); toast('Copied to clipboard.', 'success'); }}>Copy</button>
        <button className="btn btn-ghost" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

/* ── Share credentials after creation ────────────────────── */
function ShareCredentialsScreen({ userId, username, password, email, displayName, onClose }) {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const appName = 'PS TimeSheet';
  const appUrl  = window.location.origin;
  const message = `Your ${appName} login credentials:\n\nUsername: ${username}\nTemporary Password: ${password}\nURL: ${appUrl}\n\nNote: You will be required to change your password on your first login.`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  function copy() { navigator.clipboard?.writeText(message); toast('Credentials copied.', 'success'); }

  async function sendEmail() {
    if (!email) { toast('No email address on this user account.', 'error'); return; }
    setSending(true);
    try {
      await api.post(`/users/${userId}/send-credentials`, { email, username, password, displayName });
      toast(`Credentials emailed to ${email}.`, 'success');
    } catch (err) {
      toast(err?.response?.data?.message ?? 'Email send failed.', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title="Share Login Credentials" onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#4ade80)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>✓</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>User Created Successfully</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>Share the login credentials with the user.</div>

        {/* Credential box */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '16px 20px', textAlign: 'left', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)' }}>Username</span>
            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{username}</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)' }}>Temp Password</span>
            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#0f7173', letterSpacing: 2 }}>{password}</span>
          </div>
        </div>

        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e', marginBottom: 20, textAlign: 'left' }}>
          ⚠ The user must change their password on first login.
        </div>

        {/* Share options */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={copy} className="btn"
            style={{ background: '#0f7173', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>
          <button onClick={sendEmail} disabled={sending || !email} className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: !email ? 0.5 : 1 }}
            title={!email ? 'No email address on this user' : `Send to ${email}`}>
            {sending
              ? <span style={{ width: 14, height: 14, border: '2px solid #0f7173', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
            {sending ? 'Sending…' : `Send Email${email ? ` (${email})` : ''}`}
          </button>
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, textDecoration: 'none', color: '#16a34a', border: '1px solid #86efac' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.914.015C5.37.015.055 5.33.055 11.875c0 2.09.544 4.052 1.497 5.756L0 24l6.547-1.717A11.853 11.853 0 0011.914 23.7c6.545 0 11.86-5.315 11.86-11.86S18.459.015 11.914.015z" fillRule="evenodd" clipRule="evenodd"/></svg>
            WhatsApp
          </a>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-ghost" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

/* ── Edit / Create modal ──────────────────────────────────── */
function UserModal({ user, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const isEdit = Boolean(user.userId);

  const [form, setForm] = useState({
    username:           user.username        ?? '',
    displayName:        user.displayName     ?? '',
    roleCode:           user.roleCode        ?? '',
    employeeCode:       user.employeeCode    ?? '',
    departmentCode:     user.departmentCode  ?? '',
    email:              user.email           ?? '',
    phone:              user.phone           ?? '',
    status:             user.status          ?? 'Active',
    mustChangePassword: isEdit ? !!(user.mustChangePassword) : true, // new users must change on first login
    password:           '',
    confirmPassword:    '',
  });
  const [showPwStrength, setShowPwStrength] = useState(false);
  const [tempPwResult,   setTempPwResult]   = useState(null);
  const [sharedCreds,    setSharedCreds]    = useState(null);
  const [linkedEmp,      setLinkedEmp]      = useState(null);
  const [photoPreview,   setPhotoPreview]   = useState(user.profileImageUrl ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: roles       = [] } = useQuery({ queryKey: ['roles'],       queryFn: () => api.get('/roles').then(r => r.data) });
  const { data: employees   = [] } = useQuery({ queryKey: ['employees'],   queryFn: () => api.get('/employees').then(r => r.data) });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments').then(r => r.data) });
  const { data: rolePerms   = [] } = useQuery({
    queryKey: ['role-perms', form.roleCode],
    queryFn: () => api.get(`/roles/${form.roleCode}/permissions`).then(r => r.data),
    enabled: Boolean(form.roleCode),
  });

  const activeDepts  = departments.filter(d => d.isActive !== false && d.isActive !== 0);
  const activeRoles  = roles.filter(r => r.status === 'Active');
  const activePerms  = rolePerms.filter(p => p.canRead || p.canCreate || p.canWrite || p.canDelete || p.canReport);

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: payload => isEdit
      ? api.patch(`/users/${user.userId}`, payload).then(r => r.data)
      : api.post('/users', payload).then(r => r.data),
    onSuccess: (data, payload) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (isEdit) {
        toast('User updated.', 'success');
        onClose();
      } else {
        setSharedCreds({ userId: data?.userId, username: payload.username, password: payload.password, email: payload.email, displayName: payload.displayName });
      }
    },
    onError: err => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const { mutate: resetPw, isPending: resetting } = useMutation({
    mutationFn: () => api.post(`/users/${user.userId}/reset-password`).then(r => r.data),
    onSuccess: data => setTempPwResult(data.tempPassword),
    onError: err => toast(err?.response?.data?.message ?? 'Reset failed.', 'error'),
  });

  function onEmployeeChange(empCode) {
    const emp = employees.find(e => e.employeeNo === empCode);
    setForm(f => ({ ...f, employeeCode: empCode, departmentCode: emp?.departmentCode ?? f.departmentCode, displayName: emp ? [emp.firstName, emp.lastname].filter(Boolean).join(' ') : f.displayName, email: emp?.emailId && !f.email ? emp.emailId : f.email }));
    setLinkedEmp(emp ?? null);
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) { toast('Only image files accepted.', 'error'); return; }
    setUploadingPhoto(true);
    try {
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      setPhotoPreview(dataUrl);
      const result = await api.post(`/users/${user.userId}/upload-profile-image`, { fileData: dataUrl, mimeType: file.type, fileName: file.name }).then(r => r.data);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast('Photo updated.', 'success');
      if (result.profileImageUrl) setPhotoPreview(result.profileImageUrl);
    } catch { toast('Photo upload failed.', 'error'); setPhotoPreview(user.profileImageUrl ?? null); }
    finally { setUploadingPhoto(false); }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (form.password && form.password !== form.confirmPassword) { toast('Passwords do not match.', 'error'); return; }
    const payload = { ...form };
    delete payload.confirmPassword;
    if (!payload.password) delete payload.password;
    save(payload);
  }

  if (sharedCreds) return <ShareCredentialsScreen {...sharedCreds} onClose={onClose} />;
  if (tempPwResult) return <TempPwScreen username={user.username} tempPw={tempPwResult} onClose={onClose} />;

  return (
    <Modal title={isEdit ? 'Edit User' : 'Create User'} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>

        {/* ── Profile photo (edit only) ── */}
        {isEdit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            <div style={{ position: 'relative' }}>
              <Avatar name={form.displayName || user.username} url={photoPreview} size={56} />
              {uploadingPhoto && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{form.displayName || user.username}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{user.userId}</div>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}
                style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', cursor: 'pointer', color: '#0f7173' }}>
                {uploadingPhoto ? 'Uploading…' : 'Change Photo'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            </div>
          </div>
        )}

        {/* ── Login Details ── */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 10 }}>Login Details</div>
        <div className="form-grid-2" style={{ marginBottom: 18 }}>
          {isEdit && (
            <div className="form-group">
              <label className="form-label">User ID</label>
              <input className="form-control" value={user.userId ?? ''} readOnly style={{ background: 'var(--bg2)', color: 'var(--text3)' }} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Username <span style={{ color: 'var(--red)' }}>*</span></label>
            <input className="form-control" required placeholder="sara.k" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Display Name <span style={{ color: 'var(--red)' }}>*</span></label>
            <input className="form-control" required placeholder="Sara Khalid" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Password {isEdit && <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}>(blank = keep current)</span>}</label>
            <input className="form-control" type="password" placeholder="••••••••" value={form.password} required={!isEdit}
              onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setShowPwStrength(true); }}
              onFocus={() => setShowPwStrength(true)} />
            {showPwStrength && form.password && <PwStrengthBar password={form.password} />}
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className="form-control" type="password" placeholder="••••••••" value={form.confirmPassword}
              required={!isEdit || Boolean(form.password)} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} />
          </div>
        </div>

        {/* ── Role & Access ── */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 10 }}>Role &amp; Access</div>
        <div className="form-grid-2" style={{ marginBottom: 18 }}>
          <div className="form-group">
            <label className="form-label">Role <span style={{ color: 'var(--red)' }}>*</span></label>
            <select className="form-control" required value={form.roleCode} onChange={e => setForm(f => ({ ...f, roleCode: e.target.value }))}>
              <option value="">— Select —</option>
              {activeRoles.map(r => <option key={r.roleCode} value={r.roleCode}>{r.roleName}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option>Active</option><option>Inactive</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.mustChangePassword} onChange={e => setForm(f => ({ ...f, mustChangePassword: e.target.checked }))}
                style={{ width: 15, height: 15, accentColor: '#d97706', cursor: 'pointer' }} />
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Require password change on next login</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>(forces user to set a new password)</span>
            </label>
          </div>
        </div>

        {/* ── Profile & Assignment ── */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 10 }}>Profile &amp; Assignment</div>
        <div className="form-grid-2" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">Employee Code <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}>(optional)</span></label>
            <select className="form-control" value={form.employeeCode} onChange={e => onEmployeeChange(e.target.value)}>
              <option value="">— Not linked —</option>
              {employees.map(emp => <option key={emp.employeeNo} value={emp.employeeNo}>{emp.employeeNo} – {[emp.firstName, emp.lastname].filter(Boolean).join(' ')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-control" value={form.departmentCode} onChange={e => setForm(f => ({ ...f, departmentCode: e.target.value }))}>
              <option value="">— Select —</option>
              {activeDepts.map(d => <option key={d.departmentCode ?? d.departmentId} value={d.departmentCode ?? String(d.departmentId)}>{d.departmentCode ?? String(d.departmentId)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" placeholder="sara@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}>(optional)</span></label>
            <input className="form-control" placeholder="+971 5x xxx xxxx" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>

        {/* Role permissions preview */}
        {activePerms.length > 0 && (
          <div style={{ padding: '10px 14px', background: '#e6f3f3', border: '1px solid #0f717330', borderRadius: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f7173', marginBottom: 8 }}>Permissions via role</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {activePerms.map(p => <span key={p.module} style={{ padding: '3px 9px', background: '#fff', border: '1px solid #0f717340', color: '#0f7173', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{p.module}</span>)}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)', justifyContent: 'space-between' }}>
          <div>
            {isEdit && (
              <button type="button" className="btn btn-ghost" disabled={resetting} onClick={() => resetPw()}>
                {resetting ? 'Generating…' : 'Temp Password'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save User'}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ── Main page ────────────────────────────────────────────── */
export default function UsersPage() {
  const toast       = useToast();
  const queryClient = useQueryClient();
  const canWrite  = usePermission('USERS', 'canWrite');
  const canCreate = usePermission('USERS', 'canCreate');
  const canDelete = usePermission('USERS', 'canDelete');
  const currentUserId = useAuthStore(s => s.user?.userId);

  const [editing,    setEditing]    = useState(null);
  const [viewing,    setViewing]    = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [search,     setSearch]     = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { data: users = [], isLoading, isError, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles').then(r => r.data) });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments').then(r => r.data) });

  const { mutate: unlock } = useMutation({
    mutationFn: userId => api.post(`/users/${userId}/unlock`).then(r => r.data),
    onSuccess: data => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast(data.message ?? 'User unlocked.', 'success'); },
    onError: err => toast(err?.response?.data?.message ?? 'Unlock failed.', 'error'),
  });

  const { mutate: deleteUser } = useMutation({
    mutationFn: userId => api.delete(`/users/${userId}`).then(r => r.data),
    onSuccess: (_, userId) => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast(`User deleted.`, 'success'); setConfirmDel(null); },
    onError: err => { toast(err?.response?.data?.message ?? 'Delete failed.', 'error'); setConfirmDel(null); },
  });

  const { mutate: toggleStatus } = useMutation({
    mutationFn: ({ userId, status }) => api.patch(`/users/${userId}`, { status }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: err => toast(err?.response?.data?.message ?? 'Update failed.', 'error'),
  });

  const { mutate: impersonate } = useMutation({
    mutationFn: async userId => {
      // Create a session for the target user
      const session = await api.post(`/auth/impersonate/${userId}`).then(r => r.data);
      // Fetch permissions for that session
      const perms = await api.get('/auth/permissions', {
        headers: { Authorization: `Bearer ${session.token}` },
      }).then(r => r.data);
      return { ...session, permissions: perms.permissions ?? [], dataScope: perms.dataScope ?? 'All' };
    },
    onSuccess: data => {
      // Hand off session to a new tab via localStorage (30s claim window)
      localStorage.setItem('ps_impersonate', JSON.stringify({
        token: data.token, user: data.user,
        permissions: data.permissions, dataScope: data.dataScope,
        expiresAt: Date.now() + 30_000,
      }));
      window.open('/impersonate', '_blank');
      toast(`Opening session as ${data.user.displayName}…`, 'success');
    },
    onError: err => toast(err?.response?.data?.message ?? 'Impersonation failed.', 'error'),
  });

  const allDepts = [...new Set(users.map(u => u.departmentCode).filter(Boolean))].sort();

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || [u.username, u.displayName, u.email, u.roleName, u.roleCode, u.departmentCode, u.employeeCode].some(v => v?.toLowerCase().includes(q));
    const matchRole   = !filterRole   || u.roleCode       === filterRole;
    const matchDept   = !filterDept   || u.departmentCode === filterDept;
    const matchStatus = !filterStatus || (filterStatus === 'Locked' ? u.isLocked : u.status === filterStatus);
    return matchSearch && matchRole && matchDept && matchStatus;
  });

  const activeFilters = [filterRole, filterDept, filterStatus].filter(Boolean).length;

  const EditIcon  = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
  const ViewIcon  = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
  const TrashIcon = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
  const LockIcon  = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>;

  /* Impersonate icon */
  const ImpersonateIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      <polyline points="16 12 20 12"/><line x1="18" y1="10" x2="18" y2="14"/>
    </svg>
  );

  /* Power/toggle icon for status quick-switch */
  const PowerIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
    </svg>
  );

  const columns = [
    { key: '#', label: '#', num: true, sort: false, width: '36px', render: (_, i) => i + 1 },
    {
      key: 'displayName', label: 'Name', sort: true,
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={r.displayName ?? r.username} url={r.profileImageUrl} size={32} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{r.displayName || r.username}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.userId} · {r.username}</div>
          </div>
        </div>
      ),
    },
    { key: 'roleName',       label: 'Role',       sort: true, render: r => <span style={{ fontSize: 12 }}>{r.roleName ?? r.roleCode ?? '—'}</span> },
    {
      key: 'departmentCode', label: 'Dept', sort: true,
      render: r => r.departmentCode
        ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1' }}>{r.departmentCode}</span>
        : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>,
    },
    { key: 'email',      label: 'Email',      sort: true, render: r => <span style={{ fontSize: 12 }}>{r.email || '—'}</span> },
    {
      key: 'lastLoginAt', label: 'Last Login', sort: true,
      render: r => <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDate(r.lastLoginAt)}</span>,
    },
    {
      key: 'status', label: 'Status', sort: true,
      render: r => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
          <Badge variant={r.status === 'Active' ? 'active' : 'inactive'}>{r.status}</Badge>
          {!!r.isLocked        && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#fee2e2', color: '#dc2626' }}>Locked</span>}
          {!!r.mustChangePassword && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#fef3c7', color: '#d97706' }}>PW Reset</span>}
        </div>
      ),
    },
    {
      key: 'actions', label: '', sort: false,
      render: row => (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="wip-icon-btn wip-icon-btn-view" title="View details" onClick={() => setViewing(row)}>{ViewIcon}</button>
          {!!canWrite && <button className="wip-icon-btn wip-icon-btn-edit" title="Edit" onClick={() => setEditing(row)}>{EditIcon}</button>}
          {!!canWrite && row.userId !== currentUserId && row.status === 'Active' && (
            <button className="wip-icon-btn" title={`Login as ${row.displayName}`}
              onClick={() => { if (confirm(`Open a new tab logged in as "${row.displayName}"? This session will be fully active.`)) impersonate(row.userId); }}
              style={{ color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 5, padding: '3px 6px', background: '#f5f3ff', cursor: 'pointer' }}>
              {ImpersonateIcon}
            </button>
          )}
          {!!canWrite && !!row.isLocked && (
            <button className="wip-icon-btn" title="Unlock account"
              onClick={() => { if (confirm(`Unlock ${row.username}?`)) unlock(row.userId); }}
              style={{ color: '#d97706', border: '1px solid #fde68a', borderRadius: 5, padding: '3px 6px', background: '#fffbeb', cursor: 'pointer' }}>
              {LockIcon}
            </button>
          )}
          {!!canWrite && (
            <button title={row.status === 'Active' ? 'Deactivate user' : 'Activate user'}
              onClick={() => toggleStatus({ userId: row.userId, status: row.status === 'Active' ? 'Inactive' : 'Active' })}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 5, cursor: 'pointer', border: `1px solid ${row.status === 'Active' ? '#fca5a5' : '#86efac'}`, background: row.status === 'Active' ? '#fff5f5' : '#f0fdf4', color: row.status === 'Active' ? '#dc2626' : '#16a34a' }}>
              {PowerIcon}
            </button>
          )}
          {!!canDelete && (
            <button className="wip-icon-btn" title="Delete user" onClick={() => setConfirmDel(row)}
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
        title="Users"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
        actions={!!canCreate && <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ Add User</button>}
      />

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: `1px solid ${filterRole ? '#0f7173' : 'var(--border2)'}`, background: filterRole ? '#e6f3f3' : 'var(--surface)', color: filterRole ? '#0f7173' : 'var(--text)', cursor: 'pointer' }}>
          <option value="">All Roles</option>
          {roles.map(r => <option key={r.roleCode} value={r.roleCode}>{r.roleName}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: `1px solid ${filterDept ? '#0369a1' : 'var(--border2)'}`, background: filterDept ? '#e0f2fe' : 'var(--surface)', color: filterDept ? '#0369a1' : 'var(--text)', cursor: 'pointer' }}>
          <option value="">All Departments</option>
          {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: `1px solid ${filterStatus ? '#7c3aed' : 'var(--border2)'}`, background: filterStatus ? '#ede9fe' : 'var(--surface)', color: filterStatus ? '#7c3aed' : 'var(--text)', cursor: 'pointer' }}>
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Locked">Locked</option>
        </select>
        {activeFilters > 0 && (
          <button onClick={() => { setFilterRole(''); setFilterDept(''); setFilterStatus(''); }}
            style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text3)' }}>
            Clear filters ({activeFilters})
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>{filtered.length} of {users.length} users</span>
      </div>

      {isError && (
        <div style={{ margin: '12px 0', padding: '10px 14px', background: '#fff1f1', border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)', fontSize: 12 }}>
          Failed to load users: {error?.response?.data?.message ?? error?.message}
        </div>
      )}

      <Table columns={columns} data={filtered} loading={isLoading} />

      {viewing    && <UserViewModal user={viewing} onClose={() => setViewing(null)} onEdit={u => { setViewing(null); setEditing(u); }} />}
      {editing    && <UserModal user={editing} onClose={() => setEditing(null)} />}
      {confirmDel && (
        <ConfirmDialog
          message={`Delete user "${confirmDel.displayName}" (${confirmDel.username})? This cannot be undone. Users with submitted timesheets cannot be deleted — deactivate them instead.`}
          onConfirm={() => deleteUser(confirmDel.userId)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
