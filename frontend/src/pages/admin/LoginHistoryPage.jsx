import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../context/ToastContext';

const PAGE_SIZE = 50;

function LoginHistoryTab({ days, setDays }) {
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');

  // Reset to page 1 when the time window or search changes
  const handleDays   = (v) => { setDays(v);   setPage(1); };
  const handleSearch = (v) => { setSearch(v); setPage(1); };

  const { data: result = { data: [], total: 0, pages: 1 }, isLoading } = useQuery({
    queryKey: ['login-history', days, page],
    queryFn: () =>
      api.get('/auth/login-history', { params: { days, page, limit: PAGE_SIZE } }).then((r) => r.data),
    keepPreviousData: true,   // keeps last page visible while next page loads
  });

  // Client-side search filters the current page only (fast — only PAGE_SIZE rows)
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return result.data;
    return result.data.filter((r) =>
      (r.username   ?? '').toLowerCase().includes(q) ||
      (r.ipAddress  ?? '').toLowerCase().includes(q) ||
      (r.city       ?? '').toLowerCase().includes(q) ||
      (r.country    ?? '').toLowerCase().includes(q) ||
      (r.failReason ?? '').toLowerCase().includes(q),
    );
  }, [result.data, search]);

  const columns = [
    { key: '#',          label: '#',           num: true,  sort: false, render: (_, i) => (page - 1) * PAGE_SIZE + i + 1 },
    { key: 'attemptAt',  label: 'Date / Time', sort: true, render: (r) => r.attemptAt ? new Date(r.attemptAt).toLocaleString() : '—' },
    { key: 'username',   label: 'Username',    sort: true },
    { key: 'ipAddress',  label: 'IP Address',  sort: true },
    { key: 'city',       label: 'Location',    sort: true, render: (r) => [r.city, r.country].filter(Boolean).join(', ') || '—' },
    {
      key: 'success', label: 'Result', sort: true,
      render: (row) => (
        <Badge variant={row.success ? 'approved' : 'rejected'}>
          {row.success ? 'Success' : 'Failed'}
        </Badge>
      ),
    },
    { key: 'failReason', label: 'Fail Reason', sort: true, render: (r) => r.failReason ?? '—' },
  ];

  return (
    <>
      <WipListHeader
        title="Login History"
        count={result.total}
        search={search}
        onSearch={handleSearch}
        actions={
          <select value={days} onChange={(e) => handleDays(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid var(--border2)', borderRadius: '6px', fontSize: '13px', background: 'var(--surface)', color: 'var(--text)' }}>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        }
      />
      <Table columns={columns} data={rows} loading={isLoading} emptyText="No login records found." />

      {/* Server-side page controls */}
      {result.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px 2px', fontSize: 13, color: 'var(--text2)' }}>
          <span>
            Page {page} of {result.pages} &mdash; {result.total} total records
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <PageBtn onClick={() => setPage(1)}             disabled={page === 1}>«</PageBtn>
            <PageBtn onClick={() => setPage((p) => p - 1)} disabled={page === 1}>‹ Prev</PageBtn>
            <PageBtn onClick={() => setPage((p) => p + 1)} disabled={page === result.pages}>Next ›</PageBtn>
            <PageBtn onClick={() => setPage(result.pages)} disabled={page === result.pages}>»</PageBtn>
          </div>
        </div>
      )}
    </>
  );
}

function PageBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '4px 10px', fontSize: 12, borderRadius: 5,
      border: '1px solid var(--border2)', background: 'var(--surface)',
      color: disabled ? 'var(--text3, #bbb)' : 'var(--text)',
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
    }}>
      {children}
    </button>
  );
}

function ActiveSessionsTab() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['active-sessions'],
    queryFn: () => api.get('/auth/sessions').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { mutate: forceLogout } = useMutation({
    mutationFn: (userId) => api.delete(`/auth/sessions/user/${userId}`).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['active-sessions'] }); toast('Session terminated.', 'success'); },
    onError: (err) => toast(err?.response?.data?.message ?? 'Logout failed.', 'error'),
  });

  const columns = [
    { key: '#',           label: '#',           num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'username',    label: 'Username',    sort: true },
    { key: 'displayName', label: 'Name',        sort: true },
    { key: 'createdAt',   label: 'Login Time',  sort: true, render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleString() : '—' },
    { key: 'lastActiveAt',label: 'Last Active', sort: true, render: (r) => r.lastActiveAt ? new Date(r.lastActiveAt).toLocaleString() : '—' },
    { key: 'expiresAt',   label: 'Expires',     sort: true, render: (r) => r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '—' },
    { key: 'ipAddress',   label: 'IP',          sort: true },
    {
      key: 'actions', label: '', sort: false,
      render: (row) => {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {row.isCurrent && (
              <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#dcfce7', color: '#16a34a' }}>Current</span>
            )}
            {!row.isCurrent && (
              <button className="wip-action-btn wip-action-delete"
                onClick={() => { if (confirm(`Terminate session for ${row.username}?`)) forceLogout(row.userId); }}>
                Logout
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <WipListHeader
        title="Active Sessions"
        count={sessions.length}
      />
      <Table columns={columns} data={sessions} loading={isLoading} emptyText="No active sessions." />
    </>
  );
}

export default function LoginHistoryPage() {
  const [tab, setTab] = useState('history');
  const [days, setDays] = useState('30');

  return (
    <div className="page-content">
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'history',  label: 'Login History' },
          { key: 'sessions', label: 'Active Sessions' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: '6px 6px 0 0',
              cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              background: tab === t.key ? 'var(--surface)' : 'transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--text2)',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'history'  && <LoginHistoryTab  days={days} setDays={setDays} />}
      {tab === 'sessions' && <ActiveSessionsTab />}
    </div>
  );
}
