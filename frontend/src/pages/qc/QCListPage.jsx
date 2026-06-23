import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';
import { formatDate } from '../../utils/format';

const STATUS_VARIANT = {
  Draft:         'draft',
  'In Progress': 'submitted',
  Passed:        'approved',
  Failed:        'rejected',
  Closed:        'draft',
};

function FilterPanel({ filters, setFilters, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="wip-filter-wrap" ref={ref}>
      <button
        className={`wip-filter-btn${activeCount ? ' wip-filter-btn-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Filters"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        {activeCount > 0 && <span className="wip-filter-badge" style={{ display: 'inline-flex' }}>{activeCount}</span>}
      </button>
      {open && (
        <div className="wip-filter-panel">
          <div className="wip-filter-title">Filters</div>
          <div className="wip-filter-row">
            <label className="wip-filter-label">Date From</label>
            <input type="date" className="wip-filter-input" value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div className="wip-filter-row">
            <label className="wip-filter-label">Date To</label>
            <input type="date" className="wip-filter-input" value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
          </div>
          <div className="wip-filter-row">
            <label className="wip-filter-label">Status</label>
            <select className="wip-filter-input" value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All Status</option>
              <option>In Progress</option>
              <option>Passed</option>
              <option>Failed</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
              onClick={() => { onClear(); setOpen(false); }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QCListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canCreate = usePermission('QC', 'canCreate');
  const canWrite  = usePermission('QC', 'canWrite');
  const canDelete = usePermission('QC', 'canDelete');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', status: '' });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['qc-records', filters],
    queryFn: () => api.get('/qc', { params: filters }).then((r) => r.data),
  });

  const filtered = records.filter((r) =>
    !search ||
    r.docNo?.toLowerCase().includes(search.toLowerCase()) ||
    r.projectCode?.toLowerCase().includes(search.toLowerCase()) ||
    r.projectName?.toLowerCase().includes(search.toLowerCase()) ||
    r.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    r.workOrderNo?.toLowerCase().includes(search.toLowerCase()) ||
    r.qcInspector?.toLowerCase().includes(search.toLowerCase())
  );

  const { mutate: deleteQc } = useMutation({
    mutationFn: (id) => api.delete(`/qc/${id}`).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['qc-records'] }); toast('QC record deleted.', 'success'); },
    onError: (err) => toast(err?.response?.data?.message ?? 'Delete failed.', 'error'),
  });

  const isApprover = user?.canApprove || ['Admin', 'Manager', 'Supervisor'].includes(user?.roleCode);

  const columns = [
    { key: '#',            label: '#',            num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'docNo',        label: 'Document No',  sort: true,  render: (r) => <span className="wip-link">{r.docNo}</span> },
    { key: 'projectCode',  label: 'Project Code', sort: true },
    { key: 'customerName', label: 'Customer',     sort: true },
    { key: 'projectName',  label: 'Project Name', sort: true },
    { key: 'workOrderNo',  label: 'Work Order',   sort: true },
    { key: 'qcDate',       label: 'QC Date',      sort: true,  render: (r) => formatDate(r.qcDate) },
    { key: 'qcInspector',  label: 'QC Inspector', sort: true },
    {
      key: 'status', label: 'Status', sort: true, width: '110px',
      render: (row) => <Badge variant={STATUS_VARIANT[row.status] ?? 'draft'}>{row.status}</Badge>,
    },
    {
      key: 'actions', label: '', sort: false,
      render: (row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="wip-icon-btn wip-icon-btn-view" title="View"
            onClick={() => navigate(`/qc/${row.id}/view`)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button className="wip-icon-btn" title="Print / PDF"
            onClick={() => window.open(`/qc/${row.id}/print`, '_blank')}
            style={{ color: '#6b7280', borderColor: '#d1d5db' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          </button>
          {canWrite && (
            <button className="wip-icon-btn wip-icon-btn-edit" title="Edit"
              onClick={() => navigate(`/qc/${row.id}/edit`)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          {canDelete && (row.status === 'Draft' || isApprover) && (
            <button className="wip-icon-btn wip-icon-btn-delete" title="Delete"
              onClick={() => { if (confirm('Delete this QC record?')) deleteQc(row.id); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="QC Records"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
        actions={
          <>
            <FilterPanel
              filters={filters}
              setFilters={setFilters}
              onClear={() => setFilters({ dateFrom: '', dateTo: '', status: '' })}
            />
            {canCreate && (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/qc/new')}>
                + New QC
              </button>
            )}
          </>
        }
      />
      <Table columns={columns} data={filtered} loading={isLoading} />
    </div>
  );
}
