import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';

const filterStyle = { padding: '4px 8px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', height: 30 };

export default function AuditPage() {
  const [search, setSearch]   = useState('');
  const [filters, setFilters] = useState({ docType: '', action: '', dateFrom: '', dateTo: '' });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['audit', filters],
    queryFn: () => api.get('/audit', { params: filters }).then((r) => r.data?.rows ?? r.data),
  });

  const filtered = rows.filter((r) =>
    !search ||
    r.docRef?.toLowerCase().includes(search.toLowerCase()) ||
    r.performedByName?.toLowerCase().includes(search.toLowerCase()) ||
    r.details?.toLowerCase().includes(search.toLowerCase())
  );

  function exportCSV() {
    const headers = ['#', 'Timestamp', 'Type', 'Reference', 'Action', 'Performed By', 'Details'];
    const csvRows = filtered.map((r, i) => [
      i + 1,
      r.loggedAt ? new Date(r.loggedAt).toLocaleString() : '',
      r.docType ?? '',
      r.docRef ?? '',
      r.action ?? '',
      r.performedByName ?? '',
      (r.details ?? '').replace(/"/g, '""'),
    ].map((v) => `"${v}"`).join(','));
    const blob = new Blob([headers.join(',') + '\n' + csvRows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const columns = [
    { key: '#',              label: '#',            num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'loggedAt',       label: 'Timestamp',    sort: true, render: (r) => r.loggedAt ? new Date(r.loggedAt).toLocaleString() : '—' },
    { key: 'docType',        label: 'Type',         sort: true },
    { key: 'docRef',         label: 'Reference',    sort: true },
    { key: 'action',         label: 'Action',       sort: true },
    { key: 'performedByName',label: 'Performed By', sort: true },
    { key: 'details',        label: 'Details',      sort: false },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="Audit Trail"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
        actions={
          <button className="btn btn-outline btn-sm" style={{ height: 28, padding: '0 12px', fontSize: 12 }}
            onClick={exportCSV}>↓ CSV</button>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <select style={filterStyle} value={filters.docType}
          onChange={(e) => setFilters((f) => ({ ...f, docType: e.target.value }))}>
          <option value="">All Types</option>
          <option value="TIMESHEET-PROD">Timesheet Production</option>
          <option value="TIMESHEET-INST">Timesheet Installation</option>
          <option value="TIMESHEET-PROJ">Timesheet Project</option>
          <option value="WO-COMPLETE">WO Complete</option>
          <option value="USER">User</option>
          <option value="ROLE">Role</option>
        </select>
        <select style={filterStyle} value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}>
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="RESET-PWD">Reset Password</option>
          <option value="PERMISSIONS">Permissions</option>
        </select>
        <input type="date" style={filterStyle} value={filters.dateFrom}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} placeholder="From" />
        <input type="date" style={filterStyle} value={filters.dateTo}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} placeholder="To" />
        <button className="btn btn-ghost btn-sm" style={{ height: 30 }}
          onClick={() => setFilters({ docType: '', action: '', dateFrom: '', dateTo: '' })}>
          Clear
        </button>
      </div>

      <Table columns={columns} data={filtered} loading={isLoading} emptyText="No audit records found." />
    </div>
  );
}
