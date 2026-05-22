import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../context/ToastContext';
import Badge from '../components/ui/Badge';

export default function ProfilePage() {
  const toast       = useToast();
  const queryClient = useQueryClient();
  const authUser    = useAuthStore((s) => s.user);
  const setUser     = useAuthStore((s) => s.setUser);

  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({
    displayName: '',
    email:       '',
    phone:       '',
  });

  /* Fetch full profile */
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/auth/profile').then((r) => r.data).catch(() => authUser),
    staleTime: 60_000,
  });

  /* Seed form when profile loads */
  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName ?? '',
        email:       profile.email       ?? '',
        phone:       profile.phone       ?? '',
      });
    }
  }, [profile]);

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (body) => api.patch('/auth/profile', body).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      if (setUser && data) setUser({ ...authUser, ...data });
      toast('Profile updated.', 'success');
      setEditing(false);
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Update failed.', 'error'),
  });

  const user = profile ?? authUser;
  const initials = (user?.displayName ?? user?.username ?? '?')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  if (isLoading) return <div className="table-loading">Loading profile…</div>;

  return (
    <div className="page-content">
      <div className="wip-list-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="wip-list-title">My Profile</div>
          <div className="wip-list-sub">View and update your account details</div>
        </div>
        {!editing && (
          <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
            Edit Profile
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: avatar card */}
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            fontSize: 28, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontFamily: 'var(--font-mono)',
            boxShadow: '0 0 0 4px var(--amber-bg)',
          }}>
            {initials}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {user?.displayName ?? user?.username ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
            @{user?.username ?? '—'}
          </div>
          {user?.roleCode && (
            <Badge variant="active">{user.roleCode}</Badge>
          )}
          {user?.departmentCode && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10, fontFamily: 'var(--font-mono)' }}>
              {user.departmentCode}
            </div>
          )}
          <div style={{
            marginTop: 20, paddingTop: 16,
            borderTop: '1px solid var(--border)',
            fontSize: 11, color: 'var(--text3)',
            fontFamily: 'var(--font-mono)',
          }}>
            User ID: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{user?.userId ?? '—'}</span>
          </div>
        </div>

        {/* Right: detail / edit form */}
        <div className="card" style={{ padding: 28 }}>
          {editing ? (
            <>
              <div className="form-section-title" style={{ marginBottom: 20 }}>Edit Profile</div>
              <form
                onSubmit={(e) => { e.preventDefault(); save(form); }}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}
              >
                <div className="form-group">
                  <label>Display Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="Full name"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+971 50 000 0000"
                  />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input type="text" className="form-control" value={user?.username ?? ''} readOnly />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="form-section-title" style={{ marginBottom: 20 }}>Account Details</div>
              <div className="detail-grid">
                {[
                  ['Username',    user?.username    ?? '—'],
                  ['Display Name',user?.displayName ?? '—'],
                  ['Email',       user?.email       ?? '—'],
                  ['Phone',       user?.phone       ?? '—'],
                  ['Role',        user?.roleCode    ?? user?.role ?? '—'],
                  ['Department',  user?.departmentCode ?? '—'],
                  ['Status',      user?.status      ?? 'Active'],
                ].map(([label, val]) => (
                  <div key={label} className="detail-row">
                    <span>{label}</span>
                    <span>{val}</span>
                  </div>
                ))}
              </div>

              {(user?.lastLogin || user?.lastLoginAt) && (
                <div style={{
                  marginTop: 20, paddingTop: 16,
                  borderTop: '1px solid var(--border)',
                  fontSize: 11.5, color: 'var(--text3)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  Last login: {new Date(user.lastLogin ?? user.lastLoginAt).toLocaleString('en-GB')}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
