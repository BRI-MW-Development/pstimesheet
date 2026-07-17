import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useLogout } from '../../hooks/useAuth';
import api from '../../api/client';

const MAX_SNOOZE = 5;

function ChangePasswordPrompt({ userId }) {
  const clearMustChangePassword = useAuthStore((s) => s.clearMustChangePassword);

  const snoozeKey = `ps_pw_snooze_${userId}`;
  const snoozeCount = parseInt(localStorage.getItem(snoozeKey) || '0', 10);
  const forced = snoozeCount >= MAX_SNOOZE;

  const [visible, setVisible] = useState(true);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [strength, setStrength] = useState({ score: 0, rules: {} });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function calcStrength(pw) {
    if (!pw) return { score: 0, rules: {} };
    const rules = { len: pw.length >= 8, up: /[A-Z]/.test(pw), lo: /[a-z]/.test(pw), num: /[0-9]/.test(pw), sp: /[^A-Za-z0-9]/.test(pw), nsp: !/\s/.test(pw) };
    return { score: Object.values(rules).filter(Boolean).length, rules };
  }

  function snooze() {
    localStorage.setItem(snoozeKey, String(snoozeCount + 1));
    setVisible(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) { setError('New passwords do not match.'); return; }
    if (strength.score < 4) { setError('Password is too weak. Use at least 8 characters with uppercase, lowercase, and a number.'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      localStorage.removeItem(snoozeKey);
      clearMustChangePassword();
      setDone(true);
      setTimeout(() => setVisible(false), 2000);
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Password change failed. Check your current password.');
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  const strengthColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];
  const fill = Math.round((strength.score / 6) * 100);
  const strengthColor = strengthColors[Math.min(strength.score - 1, 4)] ?? '#e5e7eb';
  const remainingSnoozes = MAX_SNOOZE - snoozeCount;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,20,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '32px 32px 24px', maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid var(--border2)' }}>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Password changed successfully!</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: forced ? '#fee2e2' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {forced ? '🔒' : '🔑'}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
                  {forced ? 'Password change required' : 'Please update your password'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                  {forced
                    ? 'You must set a new password before continuing. This cannot be skipped.'
                    : `You are using a temporary password. Please set a new one. You can remind me later ${remainingSnoozes} more time${remainingSnoozes !== 1 ? 's' : ''}.`}
                </div>
              </div>
            </div>

            {forced && (
              <div style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 12, color: '#dc2626', marginBottom: 18, fontWeight: 600 }}>
                ⚠ You have reached the maximum number of reminders. Password change is now mandatory.
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 5 }}>Current Password</label>
                <input type="password" required autoComplete="current-password"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                  value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 5 }}>New Password</label>
                <input type="password" required autoComplete="new-password"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                  value={form.newPassword} onChange={e => { setForm(f => ({ ...f, newPassword: e.target.value })); setStrength(calcStrength(e.target.value)); }} />
                {form.newPassword && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${fill}%`, background: strengthColor, borderRadius: 2, transition: 'width .2s, background .2s' }} />
                    </div>
                    <div style={{ marginTop: 5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 11 }}>
                      {[['len', 'Min 8 chars'], ['up', 'Uppercase'], ['lo', 'Lowercase'], ['num', 'Number'], ['sp', 'Special char'], ['nsp', 'No spaces']].map(([k, lbl]) => (
                        <span key={k} style={{ color: strength.rules[k] ? '#16a34a' : 'var(--text3)' }}>{strength.rules[k] ? '✓' : '✗'} {lbl}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 5 }}>Confirm New Password</label>
                <input type="password" required autoComplete="new-password"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: `1px solid ${form.confirmPassword && form.confirmPassword !== form.newPassword ? '#fca5a5' : 'var(--border2)'}`, background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                  value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                  <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Passwords do not match</div>
                )}
              </div>

              {error && (
                <div style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 12, color: '#dc2626', marginBottom: 14 }}>{error}</div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: forced ? 'flex-end' : 'space-between', alignItems: 'center' }}>
                {!forced && (
                  <button type="button" onClick={snooze}
                    style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: '1px solid var(--border2)', borderRadius: 7, padding: '8px 14px', cursor: 'pointer' }}>
                    Remind me later ({remainingSnoozes} left)
                  </button>
                )}
                <button type="submit" disabled={saving}
                  style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: '#0f7173', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : 'Change Password'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Navigation config ─── */
/* ── Permission key attached to each nav link ──────────────────
   perm: { module, action } — link shown only when user has that permission
   No perm field = always visible to any authenticated user              */
const NAV_GROUPS = [
  {
    label: 'Dashboard', icon: '📊',
    links: [{ label: 'Dashboard', to: '/dashboard' }],
  },
  {
    label: 'Timesheets', icon: '📋',
    links: [
      { label: 'Production',        to: '/timesheets/prod',              perm: { module: 'PROD',        action: 'canRead' } },
      { label: 'Installation',      to: '/timesheets/inst',              perm: { module: 'INST',        action: 'canRead' } },
      { label: 'Projects Team',     to: '/timesheets/project',           perm: { module: 'PROJ',        action: 'canRead' } },
      { label: 'Pending Approvals', to: '/timesheets/pending-approvals', perm: { module: 'PENDING_APPROVALS', action: 'canRead' } },
      { label: 'Timeline', to: '/timesheets/timeline', perm: { module: 'TIMELINE', action: 'canRead' } },
      { label: 'WO Complete',       to: '/woc',                          perm: { module: 'WO_COMPLETE', action: 'canRead' } },
    ],
  },
  {
    label: 'QC', icon: '🔍',
    links: [
      { label: 'QC Records', to: '/qc', perm: { module: 'QC', action: 'canRead' } },
    ],
  },
  {
    label: 'Master Data', icon: '🗂️',
    links: [
      { label: 'Employees',        to: '/masters/employees',         perm: { module: 'EMPLOYEES',   action: 'canRead' } },
      { label: 'Departments',      to: '/masters/departments',       perm: { module: 'DEPARTMENTS', action: 'canRead' } },
      { label: 'Items',            to: '/masters/items',             perm: { module: 'ITEMS',       action: 'canRead' } },
      { label: 'Machinery',        to: '/masters/machinery',         perm: { module: 'MACHINERY',   action: 'canRead' } },
      { label: 'Vehicles',         to: '/masters/vehicles',          perm: { module: 'VEHICLES',    action: 'canRead' } },
      { label: 'Access Equipment', to: '/masters/access-equipment',  perm: { module: 'ACCESS_EQUIPMENT', action: 'canRead' } },
      { label: 'Projects',         to: '/masters/projects',          perm: { module: 'PROJECTS',    action: 'canRead' } },
      { label: 'Work Orders',      to: '/masters/workorders',        perm: { module: 'WORK_ORDERS', action: 'canRead' } },
      { label: 'Task Types',       to: '/masters/tasktypes',         perm: { module: 'TASK_TYPES',  action: 'canRead' } },
    ],
  },
  {
    label: 'Access Control', icon: '🔐',
    links: [
      { label: 'Users',         to: '/admin/users',         perm: { module: 'USERS', action: 'canRead' } },
      { label: 'Roles',         to: '/admin/roles',         perm: { module: 'ROLES', action: 'canRead' } },
      { label: 'HOD Teams',     to: '/admin/hod-teams',     perm: { module: 'HOD_TEAMS', action: 'canRead' } },
      { label: 'Login History', to: '/admin/login-history', perm: { module: 'USERS', action: 'canRead' } },
    ],
  },
  {
    label: 'Reports', icon: '📈',
    links: [
      { label: 'Reports',     to: '/reports',       perm: { module: 'REPORTS',     action: 'canReport' } },
      { label: 'Audit Trail', to: '/reports/audit', perm: { module: 'AUDIT_TRAIL', action: 'canRead'   } },
    ],
  },
  {
    label: 'Analytics', icon: '📊',
    links: [
      { label: 'Production',      to: '/analytics/prod', perm: { module: 'ANALYTICS', action: 'canReport' } },
      { label: 'Installation',    to: '/analytics/inst', perm: { module: 'ANALYTICS', action: 'canReport' } },
      { label: 'QC',              to: '/analytics/qc',   perm: { module: 'ANALYTICS', action: 'canReport' } },
      { label: 'WO Complete',     to: '/analytics/woc',  perm: { module: 'ANALYTICS', action: 'canReport' } },
    ],
  },
  {
    label: 'Settings', icon: '⚙️',
    links: [
      { label: 'Shift Setup',       to: '/admin/shifts',           perm: { module: 'SHIFTS',         action: 'canRead' } },
      { label: 'Doc Numbering',     to: '/admin/doc-numbering',    perm: { module: 'DOC_NUMBERING',   action: 'canRead' } },
      { label: 'Approval Settings', to: '/settings/approvals',     perm: { module: 'SETTINGS',        action: 'canRead' } },
      { label: 'Email Settings',    to: '/settings/email',         perm: { module: 'SETTINGS',        action: 'canRead' } },
      { label: 'Sessions',          to: '/settings/sessions',      perm: { module: 'USERS',           action: 'canRead' } },
      { label: 'Notifications',     to: '/settings/notifications', perm: { module: 'NOTIFICATIONS',   action: 'canRead' } },
      { label: 'User Manual',        to: '/admin/user-manual',      perm: { module: 'SETTINGS',        action: 'canRead' } },
    ],
  },
];

const THEMES = [
  { value: 'industrial', label: 'Industrial (Default)' },
  { value: 'ocean',      label: 'Ocean Blue' },
  { value: 'forest',     label: 'Forest Green' },
  { value: 'graphite',   label: 'Graphite Gray' },
  { value: 'light',      label: 'Light' },
  { value: 'dark',       label: 'Dark' },
  { value: 'glass',      label: 'Glass (Frosted)' },
];

/* ─── Live clock ─── */
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/* ─── Global search dropdown ─── */
function GlobalSearch({ onClose }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const navigate = useNavigate();

  const { data: results = null, isFetching } = useQuery({
    queryKey: ['global-search', q],
    queryFn: () => api.get('/search', { params: { q } }).then((r) => r.data),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  });

  // Click outside closes dropdown
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const groups = results
    ? [
        { label: 'Timesheets',   items: results.timesheets  ?? [], icon: '📋', path: (r) => r.type === 'PROJ' ? '/timesheets/project' : `/timesheets/${r.type?.toLowerCase() ?? 'prod'}/${r.docNo}/edit`, display: (r) => r.docNo, sub: (r) => [r.type, r.projectId, r.workOrderNo, r.status].filter(Boolean).join(' · ') },
        { label: 'QC Records',   items: results.qcRecords   ?? [], icon: '✅', path: (r) => `/qc/${r.id}/view`,                                              display: (r) => r.docNo,          sub: (r) => [r.workOrderNo, r.projectCode, r.partialFull].filter(Boolean).join(' · ') },
        { label: 'WO Complete',  items: results.wocRecords  ?? [], icon: '🏁', path: (r) => `/woc?open=${r.id}`,                                             display: (r) => r.docNo,          sub: (r) => [r.workOrderNo, r.projectId].filter(Boolean).join(' · ') },
        { label: 'Work Orders',  items: results.workOrders  ?? [], icon: '🔧', path: (r) => '/masters/workorders',                                            display: (r) => r.workOrderNumber, sub: (r) => r.projectName ?? '' },
        { label: 'Projects',     items: results.projects    ?? [], icon: '🏗️', path: (r) => '/masters/projects',                                              display: (r) => r.projectCode,    sub: (r) => r.projectName ?? '' },
        { label: 'Employees',    items: results.employees   ?? [], icon: '👷', path: (r) => '/masters/employees',                                             display: (r) => r.employeeNo,     sub: (r) => [r.firstName, r.lastname].filter(Boolean).join(' ') },
      ].filter((g) => g.items.length > 0)
    : [];

  const hasResults = groups.length > 0;
  const showDrop   = open && q.trim().length >= 2;

  function go(path) {
    navigate(path);
    setQ('');
    setOpen(false);
    onClose?.();
  }

  return (
    <div className="gs-wrap" ref={ref}>
      <div className="gs-input-wrap">
        <svg className="gs-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="search-bar gs-input"
          placeholder="Search Doc#, Work Order, Project, Employee…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        />
        {q && (
          <button className="gs-clear" onClick={() => { setQ(''); setOpen(false); }}>✕</button>
        )}
      </div>

      {showDrop && (
        <div className="gs-dropdown">
          {isFetching && !hasResults && (
            <div className="gs-state">Searching…</div>
          )}
          {!isFetching && !hasResults && q.trim().length >= 2 && (
            <div className="gs-state">No results for "<strong>{q}</strong>"</div>
          )}
          {groups.map((g) => (
            <div key={g.label} className="gs-group">
              <div className="gs-group-label">{g.icon} {g.label}</div>
              {g.items.slice(0, 5).map((item, i) => (
                <button key={i} className="gs-item" onClick={() => go(g.path(item))}>
                  <span className="gs-item-main">{g.display(item)}</span>
                  {g.sub(item) && <span className="gs-item-sub">{g.sub(item)}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(isoStr) {
  if (!isoStr) return null;
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoStr).toLocaleDateString();
}

/* ─── Notification panel ─── */
function NotifPanel({ onClose }) {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifs = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data).catch(() => []),
    staleTime: 60_000,
  });

  const levelColor = { error: 'var(--red)', warning: 'var(--amber)', info: 'var(--blue)', success: 'var(--green)' };
  const unreadCount = notifs.filter(n => !n.isRead).length;

  async function handleClick(n) {
    if (!n.isRead) {
      try {
        await api.patch(`/notifications/${encodeURIComponent(n.notifKey)}/read`);
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } catch {
        // If mark-read fails, don't invalidate — keeps the unread dot accurate
      }
    }
    if (n.link) navigate(n.link);
    onClose();
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      // silent — panel will still show unread state if request failed
    }
  }

  return (
    <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
      <div className="notif-panel-head">
        <span className="notif-panel-title">
          Notifications
          {unreadCount > 0 && <span className="notif-panel-count">{unreadCount} new</span>}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {unreadCount > 0 && (
            <button style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text3)', cursor: 'pointer', padding: 0 }}
              onClick={markAllRead}>
              Mark all read
            </button>
          )}
          <button className="notif-panel-close" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="notif-panel-body">
        {notifs.length === 0 ? (
          <div className="notif-panel-empty">
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
            <div>You're all caught up!</div>
            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text3)' }}>No new notifications</div>
          </div>
        ) : (
          notifs.map((n, i) => (
            <div key={i}
              className="notif-panel-item"
              style={{ background: n.isRead ? 'transparent' : 'var(--accent-glow)', cursor: n.link ? 'pointer' : 'default' }}
              onClick={() => handleClick(n)}>
              <div className="notif-dot-lg" style={{ background: levelColor[n.level] ?? 'var(--blue)', marginTop: 4, flexShrink: 0, opacity: n.isRead ? 0.4 : 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="notif-msg" style={{ fontSize: 12.5, fontWeight: n.isRead ? 400 : 600 }}>{n.message}</div>
                {n.detail && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.detail}</div>}
                {n.time && <div className="notif-time">{timeAgo(n.time)}</div>}
              </div>
              {!n.isRead && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} />}
            </div>
          ))
        )}
      </div>

      <div className="notif-panel-foot">
        <button className="btn btn-ghost btn-sm" style={{ width: '100%', fontSize: 12 }}
          onClick={() => { navigate('/notifications'); onClose(); }}>
          View all notifications →
        </button>
      </div>
    </div>
  );
}

/* ─── Main AppShell ─── */
export default function AppShell() {
  const location = useLocation();
  // Form pages fill the full content area.
  // Removing main-content padding + setting overflow:hidden fixes the height:100% chain
  // so inner scroll panels (ts-scroll-panel, qc-panel-*) get a finite height to scroll within.
  const isFullBleed = /^\/(qc\/(new|[^/]+(\/edit|\/view)?)|timesheets\/(prod|inst|project)\/(new|[^/]+(\/edit|\/view)?)|timesheets\/timeline|admin\/hod-teams)$/.test(location.pathname);
  const [openGroup,      setOpenGroup]      = useState(null);
  const [showProfile,    setShowProfile]    = useState(false);
  const [showNotif,      setShowNotif]      = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile,       setIsMobile]       = useState(() => window.innerWidth <= 768);
  const [theme,       setTheme]       = useState(
    () => localStorage.getItem('ps.theme') || 'industrial'
  );

  const user           = useAuthStore((s) => s.user);
  const setUser        = useAuthStore((s) => s.setUser);
  const permissions    = useAuthStore((s) => s.permissions);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const logout  = useLogout();
  const navigate = useNavigate();
  const now     = useClock();

  /* Refresh permissions on mount — picks up any new modules (e.g. QC) without requiring re-login */
  const { data: permData } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: () => api.get('/auth/permissions').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (permData?.permissions) setPermissions(permData.permissions, permData.dataScope ?? 'All');
  }, [permData]);

  /* Fetch profile image URL on mount and keep it fresh (onSuccess removed in RQ v5 — use useEffect) */
  const { data: profileData } = useQuery({
    queryKey: ['profile-image'],
    queryFn: () => api.get('/auth/profile').then(r => r.data),
    staleTime: 20 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (profileData?.profileImageUrl && profileData.profileImageUrl !== user?.profileImageUrl) {
      setUser({ ...user, profileImageUrl: profileData.profileImageUrl });
    }
  }, [profileData?.profileImageUrl]);

  /* Theme */
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('ps.theme', theme);
  }, [theme]);

  /* Notification count — badge shows only UNREAD */
  const { data: notifs = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data).catch(() => []),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const notifCount = notifs.filter(n => !n.isRead).length;

  /* Track viewport width for mobile detection */
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  /* Close mobile menu when switching to desktop */
  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  /* Close all panels on outside click */
  const closeAll = useCallback(() => {
    setOpenGroup(null);
    setShowProfile(false);
    setShowNotif(false);
    setMobileMenuOpen(false);
  }, []);

  /* Derived */
  const initials = (user?.displayName ?? user?.username ?? '?')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <>
      {/* ══ Password change prompt (mustChangePassword with snooze) ══ */}
      {!!user?.mustChangePassword && <ChangePasswordPrompt userId={user.userId} />}

      {/* ════════════════ TOPBAR ════════════════ */}
      <header className="topbar" onClick={closeAll}>

        {/* Logo */}
        <div className="logo" onClick={(e) => { e.stopPropagation(); navigate('/dashboard'); }} style={{ cursor: 'pointer' }}>
          <img src="/BRI_PS_60x60.png" alt="OpsDesk" className="brand-logo" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <span className="tb-brand-name">OpsDesk</span>
            <span className="tb-brand-sub">Professional Signs</span>
          </div>
        </div>

        {/* Centre: search + clock */}
        <div className="topbar-center" onClick={(e) => e.stopPropagation()} style={isMobile ? { display: 'none' } : undefined}>
          <GlobalSearch onClose={closeAll} />
          <div className="tb-clock">
            <div className="tb-clock-date">{dateStr}</div>
            <div className="tb-clock-time">{timeStr}</div>
          </div>
        </div>

        {/* Right: notifications + profile */}
        <div className="topbar-right" onClick={(e) => e.stopPropagation()}>

          {/* Notification bell */}
          <div className="icon-btn tb-notif-btn" title="Notifications"
            onClick={() => { setShowNotif((v) => !v); setShowProfile(false); setOpenGroup(null); }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {notifCount > 0 && (
              <div className="notif-dot tb-notif-badge">{notifCount > 9 ? '9+' : notifCount}</div>
            )}
          </div>

          {/* Avatar + user info */}
          <button className="profile-trigger"
            onClick={() => { setShowProfile((v) => !v); setShowNotif(false); setOpenGroup(null); }}>
            <div className="avatar" style={{ overflow: 'hidden', padding: 0 }}>
              {user?.profileImageUrl
                ? <img src={user.profileImageUrl} alt={initials}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '50%' }}
                    onError={e => { e.target.style.display = 'none'; e.target.parentNode.style.background = 'var(--accent)'; e.target.parentNode.textContent = initials; }} />
                : initials}
            </div>
          </button>
          <div className="user-info" style={{ cursor: 'pointer', ...(isMobile ? { display: 'none' } : {}) }}
            onClick={() => { setShowProfile((v) => !v); setShowNotif(false); setOpenGroup(null); }}>
            <div className="user-name">{user?.displayName ?? user?.username ?? '—'}</div>
            <div className="user-role">{user?.roleCode ?? user?.role ?? ''}</div>
          </div>

          {/* Notification panel */}
          {showNotif && <NotifPanel onClose={() => setShowNotif(false)} />}

          {/* Hamburger — mobile only */}
          {isMobile && (
            <button
              aria-label="Toggle navigation"
              onClick={(e) => { e.stopPropagation(); setMobileMenuOpen((v) => !v); setShowProfile(false); setShowNotif(false); }}
              style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 5,
                width: 40, height: 40, flexShrink: 0,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, cursor: 'pointer', padding: 0, marginRight: 10,
              }}
            >
              <span style={{ display: 'block', width: 18, height: 2, background: 'var(--header-text,#fff)', borderRadius: 1, transition: 'all .2s', transform: mobileMenuOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
              <span style={{ display: 'block', width: 18, height: 2, background: 'var(--header-text,#fff)', borderRadius: 1, transition: 'all .2s', opacity: mobileMenuOpen ? 0 : 1 }} />
              <span style={{ display: 'block', width: 18, height: 2, background: 'var(--header-text,#fff)', borderRadius: 1, transition: 'all .2s', transform: mobileMenuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
            </button>
          )}

          {/* Profile dropdown */}
          {showProfile && (
            <div className="profile-menu" onClick={(e) => e.stopPropagation()}>
              {/* User summary */}
              <div className="pm-user-row">
                <div className="pm-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                  {user?.profileImageUrl
                    ? <img src={user.profileImageUrl} alt={initials}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '50%' }}
                        onError={e => { e.target.style.display = 'none'; e.target.parentNode.style.background = 'var(--accent)'; e.target.parentNode.textContent = initials; }} />
                    : initials}
                </div>
                <div>
                  <div className="pm-name">{user?.displayName ?? user?.username}</div>
                  <div className="pm-role">{user?.roleCode ?? user?.role ?? ''}</div>
                  {user?.email && <div className="pm-email">{user.email}</div>}
                </div>
              </div>
              <div className="pm-divider" />

              <button className="profile-menu-item"
                onClick={() => { closeAll(); navigate('/profile'); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                My Profile
              </button>
              <button className="profile-menu-item"
                onClick={() => { closeAll(); navigate('/settings/change-password'); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Change Password
              </button>
              <button className="profile-menu-item"
                onClick={() => { closeAll(); navigate('/notifications'); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                Notifications {notifCount > 0 && <span className="pm-badge">{notifCount}</span>}
              </button>

              <div className="pm-divider" />
              <div className="profile-menu-label">Theme</div>
              <select className="profile-menu-select" value={theme}
                onChange={(e) => setTheme(e.target.value)}>
                {THEMES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              <div className="pm-divider" />
              <button className="profile-menu-item pm-logout" onClick={logout}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile backdrop */}
      {isMobile && mobileMenuOpen && (
        <div onClick={closeAll} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 94 }} />
      )}

      {/* ════════════════ TOP GROUP NAV ════════════════ */}
      <div
        className="top-group-menu"
        onClick={closeAll}
        style={isMobile ? {
          display: mobileMenuOpen ? 'flex' : 'none',
          flexDirection: 'column',
          position: 'fixed',
          top: 'var(--header-h, 52px)',
          left: 0, right: 0,
          zIndex: 95,
          maxHeight: 'calc(100vh - 52px)',
          overflowY: 'auto',
          background: 'var(--sidebar-bg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          borderBottom: '2px solid var(--top-menu-border, rgba(255,255,255,0.1))',
        } : undefined}
      >
        {NAV_GROUPS.map((group) => {
          // Filter links by permission — show only links the user can access
          const visibleLinks = group.links.filter(link => {
            if (!link.perm) return true;
            return permissions.some(p => p.module === link.perm.module && p[link.perm.action]);
          });
          if (visibleLinks.length === 0) return null; // hide entire group if no visible links
          const isSingle = visibleLinks.length === 1;
          return (
            <div
              key={group.label}
              className={`top-group${openGroup === group.label ? ' open' : ''}`}
              style={isMobile ? {
                flexDirection: 'column', alignItems: 'stretch', width: '100%',
                padding: 0, borderRight: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              } : undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (isSingle) { navigate(visibleLinks[0].to); closeAll(); return; }
                setOpenGroup((cur) => cur === group.label ? null : group.label);
                setShowProfile(false);
                setShowNotif(false);
              }}
            >
              <div className="top-group-heading" style={isMobile ? { padding: '14px 18px', fontSize: 13, fontWeight: 600, justifyContent: 'space-between' } : undefined}>
                <span className="tg-icon">{group.icon}</span>
                {group.label}
                {!isSingle && <span className="top-group-arrow">▾</span>}
              </div>
              {!isSingle && (
                <div className="top-group-dropdown" style={isMobile && openGroup === group.label ? {
                  display: 'flex', flexDirection: 'column',
                  position: 'static', boxShadow: 'none', borderRadius: 0,
                  background: 'rgba(0,0,0,0.18)', padding: '4px 8px 8px 32px',
                  minWidth: 'unset',
                } : isMobile ? { display: 'none' } : undefined}>
                  {visibleLinks.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) => `top-menu-link${isActive ? ' active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); closeAll(); }}
                    >
                      {link.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ════════════════ MAIN CONTENT ════════════════ */}
      <div className="app-shell" onClick={closeAll}>
        <main className="main-content" style={isFullBleed ? { padding: 0, overflow: 'hidden', minHeight: 0 } : undefined}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
