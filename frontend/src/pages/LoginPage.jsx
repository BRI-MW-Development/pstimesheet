import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';

const FEATURES = [
  { icon: '🏭', label: 'Production Timesheets',  desc: 'Track labour, materials & machinery in real-time' },
  { icon: '🔧', label: 'Installation Tracking',  desc: 'Field teams, vehicles & access equipment logs' },
  { icon: '📊', label: 'Live Dashboard',          desc: 'KPI cards, utilisation metrics & alerts' },
  { icon: '✅', label: 'Approval Workflow',       desc: 'Multi-level submit → approve → reject flow' },
];

export default function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const { mutate: login, isPending } = useLogin();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

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

  // Clear error when user starts typing
  function setField(field, val) {
    setError('');
    setForm((f) => ({ ...f, [field]: val }));
  }

  const year = new Date().getFullYear();

  return (
    <div className="lp-shell">
      {/* ── Left brand panel ── */}
      <div className="lp-brand">
        <div className="lp-brand-inner">
          {/* Logo + wordmark */}
          <div className="lp-logo-row">
            <img src="/BRI_PS_60x60.png" alt="BRI Professional Signs" className="lp-logo-img" />
            <div>
              <div className="lp-wordmark">TimesheetPro</div>
              <div className="lp-wordmark-sub">BRI Professional Signs</div>
            </div>
          </div>

          {/* Hero text */}
          <div className="lp-hero">
            <div className="lp-hero-title">Operations<br />Command Centre</div>
            <div className="lp-hero-sub">
              A unified platform for production tracking, installation scheduling,
              and management reporting.
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

          <div className="lp-copy">&copy; {year} BRI Professional Signs. All rights reserved.</div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="lp-form-panel">
        <div className="lp-form-card">
          <div className="lp-form-header">
            <div className="lp-form-title">Welcome back</div>
            <div className="lp-form-sub">Sign in to your account to continue</div>
          </div>

          <form onSubmit={handleSubmit} className="lp-form">

            {/* Inline error banner */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px', borderRadius: 8, marginBottom: 4,
                background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
                fontSize: 13, lineHeight: 1.5,
              }}>
                <svg style={{ flexShrink: 0, marginTop: 1 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <>
                  <span className="lp-spinner" />
                  Signing in…
                </>
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
