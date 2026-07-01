import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Badge from '../components/ui/Badge';
import { useToast } from '../context/ToastContext';

const LEVEL_VARIANT = { error: 'inactive', warning: 'warning', info: 'submitted', success: 'active' };
const LEVEL_COLOR   = { error: 'var(--red)', warning: 'var(--amber)', info: 'var(--blue)', success: 'var(--green)' };

function timeAgo(isoStr) {
  if (!isoStr) return null;
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoStr).toLocaleDateString();
}

export default function NotificationsPage() {
  const navigate      = useNavigate();
  const toast         = useToast();
  const queryClient   = useQueryClient();

  const { data: notifs = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data).catch(() => []),
    staleTime: 30_000,
  });

  const { mutate: markRead } = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: () => {},
  });

  const { mutate: markAllRead, isPending: markingAll } = useMutation({
    mutationFn: () => api.patch('/notifications/read-all').then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast('All notifications marked as read.', 'success');
    },
    onError: () => {},
  });

  function handleClick(n) {
    if (!n.isRead) markRead(encodeURIComponent(n.notifKey ?? n.id));
    if (n.link) navigate(n.link);
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="wip-list-header">
        <div>
          <div className="wip-list-title">
            Notifications
            {notifs.filter(n => !n.isRead).length > 0 && (
              <span className="wip-count">{notifs.filter(n => !n.isRead).length} unread</span>
            )}
          </div>
          <div className="wip-list-sub">System alerts, approvals and activity</div>
        </div>
        {notifs.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => markAllRead()} disabled={markingAll}>
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="table-loading">Loading notifications…</div>
      ) : notifs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>You're all caught up!</div>
          <div style={{ fontSize: 13 }}>No new notifications at this time.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {notifs.map((n, i) => (
            <div
              key={n.id ?? i}
              onClick={() => handleClick(n)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '14px 20px',
                borderBottom: i < notifs.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: n.link ? 'pointer' : 'default',
                background: n.isRead ? 'transparent' : 'var(--amber-bg, rgba(196,125,40,0.04))',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (n.link) e.currentTarget.style.background = 'var(--bg2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = n.isRead ? 'transparent' : 'var(--amber-bg, rgba(196,125,40,0.04))'; }}
            >
              {/* Level dot */}
              <div style={{
                width: 10, height: 10,
                borderRadius: '50%',
                background: LEVEL_COLOR[n.level] ?? 'var(--blue)',
                marginTop: 5,
                flexShrink: 0,
              }} />

              {/* Message body */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: n.isRead ? 400 : 600, lineHeight: 1.45 }}>
                  {n.message ?? n.title ?? '—'}
                </div>
                {n.detail && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{n.detail}</div>
                )}
                {n.time && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{timeAgo(n.time)}</div>
                )}
              </div>

              {/* Badge */}
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                <Badge variant={LEVEL_VARIANT[n.level] ?? 'submitted'}>
                  {n.level ?? 'info'}
                </Badge>
              </div>

              {/* Unread indicator */}
              {!n.isRead && (
                <div style={{
                  width: 7, height: 7,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  flexShrink: 0,
                  marginTop: 7,
                }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
