import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';

const FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
      </svg>
    ),
    label: 'Live Dashboard',
    desc: 'KPI cards, utilisation metrics and alerts at a glance',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    label: 'Production & Installation',
    desc: 'Labour, materials and machinery tracked per work order',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
    label: 'Approval Workflow',
    desc: 'Submit → Approve → Reject with department routing',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    label: 'Quality Control',
    desc: '45-point QC checklists, photos and PDF print reports',
  },
];

export default function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const { mutate: login, isPending } = useLogin();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (token) navigate('/dashboard', { replace: true });
  }, [token, navigate]);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    login(form, {
      onSuccess: () => navigate('/dashboard', { replace: true }),
      onError: (err) => {
        const msg = err?.response?.data?.message ?? 'Invalid username or password.';
        setError(msg);
      },
    });
  }

  function setField(field, val) {
    setError('');
    setForm((f) => ({ ...f, [field]: val }));
  }

  const year = new Date().getFullYear();

  return (
    <div className={`lp-shell${mounted ? ' lp-mounted' : ''}`}>

      {/* ── Left brand panel ── */}
      <div className="lp-brand">
        {/* Grid texture overlay */}
        <svg className="lp-grid-bg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(196,125,40,0.12)" strokeWidth="0.7"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lp-grid)"/>
        </svg>

        {/* Glow orbs */}
        <div className="lp-orb lp-orb-1" />
        <div className="lp-orb lp-orb-2" />

        <div className="lp-brand-inner">
          {/* Logo + wordmark */}
          <div className="lp-logo-row">
            <div className="lp-logo-wrap">
              <img src="/BRI_PS_60x60.png" alt="BRI Professional Signs" className="lp-logo-img" />
            </div>
            <div>
              <div className="lp-wordmark">TimesheetPro</div>
              <div className="lp-wordmark-sub">BRI Professional Signs</div>
            </div>
          </div>

          {/* Hero text */}
          <div className="lp-hero">
            <div className="lp-hero-eyebrow">Operations Platform</div>
            <div className="lp-hero-title">
              Command<br /><em>Centre</em>
            </div>
            <div className="lp-hero-sub">
              A unified platform for production tracking, installation scheduling,
              QC inspections, and management reporting.
            </div>
          </div>

          {/* Feature list */}
          <ul className="lp-features">
            {FEATURES.map((f) => (
              <li key={f.label} className="lp-feature-item">
                <span className="lp-feature-icon">{f.icon}</span>
                <div>
                  <div className="lp-feature-label">{f.label}</div>
                  <div className="lp-feature-desc">{f.desc}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="lp-copy">&copy; {year} BRI Professional Signs &mdash; All rights reserved.</div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="lp-form-panel">
        <div className="lp-form-card">

          {/* Mobile-only logo */}
          <div className="lp-mobile-logo">
            <img src="/BRI_PS_60x60.png" alt="BRI Professional Signs" style={{ width: 36, height: 36, borderRadius: 8 }} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>TimesheetPro</span>
          </div>

          <div className="lp-form-header">
            <div className="lp-form-title">Welcome back</div>
            <div className="lp-form-sub">Sign in to your account to continue</div>
          </div>

          <form onSubmit={handleSubmit} className="lp-form">

            {/* Error banner */}
            {error && (
              <div className="lp-error-banner">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="lp-field">
              <label className="lp-label" htmlFor="username">Username</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
                <input
                  id="username"
                  type="text"
                  className="lp-input"
                  autoComplete="username"
                  autoFocus
                  required
                  placeholder="your.username"
                  value={form.username}
                  onChange={(e) => setField('username', e.target.value)}
                />
              </div>
            </div>

            <div className="lp-field">
              <label className="lp-label" htmlFor="password">Password</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="lp-input lp-input-pw"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                />
                <button
                  type="button"
                  className="lp-pw-toggle"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="lp-btn-submit" disabled={isPending}>
              {isPending ? (
                <><span className="lp-spinner" />Signing in…</>
              ) : (
                <>
                  Sign in
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="lp-divider" />
          <div className="lp-footer-note">
            Access is restricted to authorised personnel only.
            Contact your system administrator for assistance.
          </div>
        </div>
      </div>
    </div>
  );
}
