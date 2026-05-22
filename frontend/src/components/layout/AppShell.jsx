import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useLogout } from '../../hooks/useAuth';
import api from '../../api/client';

/* ─── Navigation config ─── */
const TOP_GROUPS = [
  {
    label: 'Dashboard',
    icon: '📊',
    links: [{ label: 'Dashboard', to: '/dashboard' }],
  },
  {
    label: 'Timesheets',
    icon: '📋',
    links: [
      { label: 'Production',       to: '/timesheets/prod' },
      { label: 'Installation',     to: '/timesheets/inst' },
      { label: 'Projects Team',    to: '/timesheets/project' },
      { label: 'Pending Approvals',to: '/timesheets/pending-approvals' },
      { label: 'WO Complete',      to: '/woc' },
    ],
  },
  {
    label: 'Master Data',
    icon: '🗂️',
    links: [
      { label: 'Employees',        to: '/masters/employees' },
      { label: 'Departments',      to: '/masters/departments' },
      { label: 'Items',            to: '/masters/items' },
      { label: 'Machinery',        to: '/masters/machinery' },
      { label: 'Vehicles',         to: '/masters/vehicles' },
      { label: 'Access Equipment', to: '/masters/access-equipment' },
      { label: 'Projects',         to: '/masters/projects' },
      { label: 'Work Orders',      to: '/masters/workorders' },
      { label: 'Task Types',       to: '/masters/tasktypes' },
    ],
  },
  {
    label: 'Access Control',
    icon: '🔐',
    links: [
      { label: 'Users',         to: '/admin/users' },
      { label: 'Roles',         to: '/admin/roles' },
      { label: 'Login History', to: '/admin/login-history' },
    ],
  },
  {
    label: 'Reports',
    icon: '📈',
    links: [
      { label: 'Reports',     to: '/reports' },
      { label: 'Audit Trail', to: '/reports/audit' },
    ],
  },
  {
    label: 'Settings',
    icon: '⚙️',
    links: [
      { label: 'Shift Setup',       to: '/admin/shifts' },
      { label: 'Doc Numbering',     to: '/admin/doc-numbering' },
      { label: 'Approval Settings', to: '/settings/approvals' },
      { label: 'Email Settings',    to: '/settings/email' },
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
  const navigate = useNavigate();

  const { data: notifs = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data).catch(() => []),
    staleTime: 60_000,
  });

  const levelColor = { error: 'var(--red)', warning: 'var(--amber)', info: 'var(--blue)', success: 'var(--green)' };

  return (
    <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
      <div className="notif-panel-head">
        <span className="notif-panel-title">Notifications</span>
        {notifs.length > 0 && (
          <span className="notif-panel-count">{notifs.length}</span>
        )}
        <button className="notif-panel-close" onClick={onClose}>✕</button>
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
            <div key={i} className="notif-panel-item" onClick={() => { n.link && navigate(n.link); onClose(); }}>
              <div className="notif-dot-lg" style={{ background: levelColor[n.level] ?? 'var(--blue)', marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="notif-msg" style={{ fontSize: 12.5 }}>{n.message}</div>
                {n.time && <div className="notif-time">{n.time}</div>}
              </div>
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
  const [openGroup,   setOpenGroup]   = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotif,   setShowNotif]   = useState(false);
  const [theme,       setTheme]       = useState(
    () => localStorage.getItem('ps.theme') || 'industrial'
  );

  const user    = useAuthStore((s) => s.user);
  const logout  = useLogout();
  const navigate = useNavigate();
  const now     = useClock();

  /* Theme */
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('ps.theme', theme);
  }, [theme]);

  /* Notification count */
  const { data: notifs = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data).catch(() => []),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const notifCount = notifs.length;

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
            <div className="avatar">{initials}</div>
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
                <div className="pm-avatar">{initials}</div>
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
        {TOP_GROUPS.map((group) => {
          const isSingle = group.links.length === 1;
          return (
            <div
              key={group.label}
              className={`top-group${openGroup === group.label ? ' open' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isSingle) { navigate(group.links[0].to); closeAll(); }
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
                  {group.links.map((link) => (
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
        <main className="main-content" onClick={(e) => e.stopPropagation()}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
