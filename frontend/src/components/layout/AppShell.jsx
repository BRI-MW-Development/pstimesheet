import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useLogout } from '../../hooks/useAuth';
import api from '../../api/client';

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
      { label: 'Pending Approvals', to: '/timesheets/pending-approvals', perm: { module: 'PROD',        action: 'canWrite' } },
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
      { label: 'Access Equipment', to: '/masters/access-equipment',  perm: { module: 'ITEMS',       action: 'canRead' } },
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
      { label: 'Login History', to: '/admin/login-history', perm: { module: 'USERS', action: 'canRead' } },
    ],
  },
  {
    label: 'Reports', icon: '📈',
    links: [
      { label: 'Reports',     to: '/reports',           perm: { module: 'REPORTS', action: 'canRead' } },
      { label: 'Analytics',   to: '/reports/analytics', perm: { module: 'REPORTS', action: 'canRead' } },
      { label: 'Audit Trail', to: '/reports/audit',     perm: { module: 'REPORTS', action: 'canRead' } },
    ],
  },
  {
    label: 'Settings', icon: '⚙️',
    links: [
      { label: 'Shift Setup',       to: '/admin/shifts',       perm: { module: 'SHIFTS',       action: 'canRead' } },
      { label: 'Doc Numbering',     to: '/admin/doc-numbering',perm: { module: 'DOC_NUMBERING', action: 'canRead' } },
      { label: 'Approval Settings', to: '/settings/approvals', perm: { module: 'SETTINGS',     action: 'canRead' } },
      { label: 'Email Settings',    to: '/settings/email',     perm: { module: 'SETTINGS',     action: 'canRead' } },
    ],
  },
];

const THEMES = [
  { value: 'industrial', label: 'Industrial (Default)' },
  { value: 'ocean',      label: 'Ocean Blue' },
  { value: 'forest',     label: 'Forest Green' },
  { value: 'graphite',   label: 'Graphite Gray' },
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
        { label: 'Timesheets',  items: results.timesheets  ?? [], icon: '📋', path: (r) => `/timesheets/${r.type?.toLowerCase() ?? 'prod'}/${r.docNo}/edit`, display: (r) => r.docNo, sub: (r) => r.projectName ?? '' },
        { label: 'Work Orders', items: results.workOrders  ?? [], icon: '🔧', path: (r) => '/masters/workorders',                                           display: (r) => r.workOrderNumber, sub: (r) => r.projectName ?? '' },
        { label: 'Projects',    items: results.projects    ?? [], icon: '🏗️', path: (r) => '/masters/projects',                                              display: (r) => r.projectCode,    sub: (r) => r.projectName ?? '' },
        { label: 'Employees',   items: results.employees   ?? [], icon: '👷', path: (r) => '/masters/employees',                                             display: (r) => r.employeeNo,     sub: (r) => [r.firstName, r.lastname].filter(Boolean).join(' ') },
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
    // Mark as read
    if (!n.isRead) {
      await api.patch(`/notifications/${encodeURIComponent(n.notifKey)}/read`).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (n.link) navigate(n.link);
    onClose();
  }

  async function markAllRead() {
    await api.patch('/notifications/read-all').catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
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
                {n.time && <div className="notif-time">{n.time}</div>}
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
  // QC form pages fill the full content area — remove main-content padding for them
  const isFullBleed = /^\/qc\/(new|[^/]+(\/edit|\/view)?)$/.test(location.pathname);
  const [openGroup,   setOpenGroup]   = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotif,   setShowNotif]   = useState(false);
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

  /* Close all panels on outside click */
  const closeAll = useCallback(() => {
    setOpenGroup(null);
    setShowProfile(false);
    setShowNotif(false);
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
      {/* ════════════════ TOPBAR ════════════════ */}
      <header className="topbar" onClick={closeAll}>

        {/* Logo */}
        <div className="logo" onClick={(e) => { e.stopPropagation(); navigate('/dashboard'); }} style={{ cursor: 'pointer' }}>
          <img src="/BRI_PS_60x60.png" alt="PS TimeSheet Pro" className="brand-logo" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <span className="tb-brand-name">PS TimeSheet Pro</span>
            <span className="tb-brand-sub">BRI Professional Signs</span>
          </div>
        </div>

        {/* Centre: search + clock */}
        <div className="topbar-center" onClick={(e) => e.stopPropagation()}>
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
          <div className="user-info" style={{ cursor: 'pointer' }}
            onClick={() => { setShowProfile((v) => !v); setShowNotif(false); setOpenGroup(null); }}>
            <div className="user-name">{user?.displayName ?? user?.username ?? '—'}</div>
            <div className="user-role">{user?.roleCode ?? user?.role ?? ''}</div>
          </div>

          {/* Notification panel */}
          {showNotif && <NotifPanel onClose={() => setShowNotif(false)} />}

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

      {/* ════════════════ TOP GROUP NAV ════════════════ */}
      <div className="top-group-menu" onClick={closeAll}>
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
              onClick={(e) => {
                e.stopPropagation();
                if (isSingle) { navigate(visibleLinks[0].to); closeAll(); }
                else setOpenGroup((cur) => cur === group.label ? null : group.label);
                setShowProfile(false);
                setShowNotif(false);
              }}
            >
              <div className="top-group-heading">
                <span className="tg-icon">{group.icon}</span>
                {group.label}
                {!isSingle && <span className="top-group-arrow">▾</span>}
              </div>
              {!isSingle && (
                <div className="top-group-dropdown">
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
        <main className="main-content" style={isFullBleed ? { padding: 0, overflow: 'hidden' } : undefined} onClick={(e) => e.stopPropagation()}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
