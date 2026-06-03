import { useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../context/ToastContext';
import Badge from '../components/ui/Badge';
import CameraCapture from '../components/ui/CameraCapture';

export default function ProfilePage() {
  const toast       = useToast();
  const queryClient = useQueryClient();
  const authUser    = useAuthStore((s) => s.user);
  const setUser     = useAuthStore((s) => s.setUser);

  const [editing, setEditing]   = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({ displayName: '', email: '', phone: '' });

  /* Fetch full profile */
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/auth/profile').then((r) => r.data).catch(() => authUser),
    staleTime: 60_000,
  });

  /* Fetch login audit — previousLogin is the session BEFORE the current one */
  const { data: audit } = useQuery({
    queryKey: ['login-audit'],
    queryFn: () => api.get('/auth/login-audit').then(r => r.data).catch(() => null),
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

  const { mutate: uploadImage, isPending: uploadingImg } = useMutation({
    mutationFn: ({ fileData, mimeType, fileName }) =>
      api.post('/auth/profile/image', { fileData, mimeType, fileName }).then(r => r.data),
    onSuccess: (data) => {
      // Push new URL into authStore so topbar avatar updates immediately
      if (data?.profileImageUrl && setUser)
        setUser({ ...authUser, profileImageUrl: data.profileImageUrl });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile-image'] });
      toast('Profile photo updated.', 'success');
    },
    onError: () => toast('Photo upload failed.', 'error'),
  });

  function handleImageFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) { toast('Please select an image file.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => uploadImage({ fileData: reader.result, mimeType: file.type, fileName: file.name });
    reader.readAsDataURL(file);
  }

  function handleCameraCapture(dataUrl, mimeType, fileName) {
    uploadImage({ fileData: dataUrl, mimeType, fileName });
  }

  const user = profile ?? authUser;
  const initials = (user?.displayName ?? user?.username ?? '?')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const profileImageUrl = profile?.profileImageUrl ?? null;

  if (isLoading) return <div className="table-loading">Loading profile…</div>;

  return (<>
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
          {/* Avatar with upload overlay */}
          <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 16px' }}>
            {profileImageUrl ? (
              <img src={profileImageUrl} alt="Profile" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)', boxShadow: '0 0 0 3px var(--amber-bg)' }} />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 30, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', boxShadow: '0 0 0 4px var(--amber-bg)' }}>
                {uploadingImg ? '…' : initials}
              </div>
            )}
            {/* Camera overlay buttons — disabled while uploading */}
            {uploadingImg && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 20, height: 20, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}
            {!uploadingImg && (
              <div style={{ position: 'absolute', bottom: 0, right: 0, display: 'flex', gap: 3 }}>
                <button type="button" title="Upload photo" onClick={() => fileInputRef.current?.click()}
                  style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: '2px solid var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                  📁
                </button>
                <button type="button" title="Take photo" onClick={() => setShowCamera(true)}
                  style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--blue)', color: '#fff', border: '2px solid var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                  📷
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
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

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {audit?.previousLogin && (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Previous login</span>
                    <span>{new Date(audit.previousLogin).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                  </div>
                )}
                {audit?.successfulToday !== undefined && (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Logins today</span>
                    <span style={{ color: 'var(--green)' }}>{audit.successfulToday}</span>
                  </div>
                )}
                {(audit?.failuresToday ?? 0) > 0 && (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Failed attempts today</span>
                    <span style={{ color: 'var(--red)', fontWeight: 700 }}>{audit.failuresToday}</span>
                  </div>
                )}
                {!audit?.previousLogin && !isLoading && (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    First login — no previous session recorded
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    {showCamera && <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}
  </>);
}
