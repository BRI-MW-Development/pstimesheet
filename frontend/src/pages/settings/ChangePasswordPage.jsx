import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function ChangePasswordPage() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const { mutate, isPending } = useMutation({
    mutationFn: (payload) => api.post('/auth/change-password', payload).then((r) => r.data),
    onSuccess: () => {
      toast('Password changed successfully.', 'success');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Password change failed.', 'error'),
  });

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast('New passwords do not match.', 'error');
      return;
    }
    if (form.newPassword.length < 8) {
      toast('New password must be at least 8 characters.', 'error');
      return;
    }
    mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Change Password</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '420px' }}>
        <div className="form-section">
          <div className="form-group">
            <label>Current Password</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => set('currentPassword', e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => set('newPassword', e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Minimum 8 characters.
            </p>
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isPending}>
            {isPending ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </form>
    </div>
  );
}
