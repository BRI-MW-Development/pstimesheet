import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

const EyeIcon = ({ open }) =>
  open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

function PasswordInput({ value, onChange, autoComplete, id }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        style={{ paddingRight: '36px', width: '100%', boxSizing: 'border-box' }}
        required
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
        }}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}

function policyRules(pw) {
  return [
    { label: 'At least 8 characters', ok: pw.length >= 8 },
    { label: 'Uppercase letter (A–Z)', ok: /[A-Z]/.test(pw) },
    { label: 'Lowercase letter (a–z)', ok: /[a-z]/.test(pw) },
    { label: 'Number (0–9)', ok: /[0-9]/.test(pw) },
    { label: 'Special character (!@#$…)', ok: /[^A-Za-z0-9\s]/.test(pw) },
    { label: 'No spaces', ok: pw.length > 0 && !/\s/.test(pw) },
  ];
}

export default function ChangePasswordPage() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);

  const rules = policyRules(form.newPassword);
  const allRulesMet = rules.every((r) => r.ok);
  const passwordsMatch = form.newPassword !== '' && form.confirmPassword !== '' && form.newPassword === form.confirmPassword;
  const passwordsMismatch = form.confirmPassword !== '' && form.newPassword !== form.confirmPassword;

  const { mutate, isPending } = useMutation({
    mutationFn: (payload) => api.post('/auth/change-password', payload).then((r) => r.data),
    onSuccess: () => {
      toast('Password changed successfully.', 'success');
      setForm(EMPTY_FORM);
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Password change failed.', 'error'),
  });

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  function handleReset() {
    setForm(EMPTY_FORM);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!allRulesMet) {
      toast('New password does not meet all policy requirements.', 'error');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast('New passwords do not match.', 'error');
      return;
    }
    mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Change Password</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '460px', margin: '0 auto' }}>
        <div
          className="form-section"
          style={{
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <div className="form-group">
            <label htmlFor="currentPassword">
              Current Password <span style={{ color: 'red' }}>*</span>
            </label>
            <PasswordInput
              id="currentPassword"
              value={form.currentPassword}
              onChange={(e) => set('currentPassword', e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">
              New Password <span style={{ color: 'red' }}>*</span>
            </label>
            <PasswordInput
              id="newPassword"
              value={form.newPassword}
              onChange={(e) => set('newPassword', e.target.value)}
              autoComplete="new-password"
            />
            <div
              style={{
                marginTop: '8px',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: '6px',
                padding: '10px 12px',
                fontSize: '13px',
                lineHeight: '1.7',
                background: 'var(--surface-subtle, #f8fafc)',
              }}
            >
              {rules.map((r) => (
                <div key={r.label} style={{ color: r.ok ? 'var(--success, #16a34a)' : 'var(--text-muted, #64748b)' }}>
                  {r.ok ? '✅' : '⬜'} {r.label}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              Confirm New Password <span style={{ color: 'red' }}>*</span>
            </label>
            <PasswordInput
              id="confirmPassword"
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              autoComplete="new-password"
            />
            {passwordsMatch && (
              <p style={{ fontSize: '13px', color: 'var(--success, #16a34a)', marginTop: '4px' }}>
                ✓ Passwords match
              </p>
            )}
            {passwordsMismatch && (
              <p style={{ fontSize: '13px', color: 'var(--danger, #dc2626)', marginTop: '4px' }}>
                ✗ Passwords do not match
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button type="button" className="btn btn-ghost" onClick={handleReset} disabled={isPending}>
              Reset
            </button>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
