import { useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';

const STATUS_MAP = {
  'IN PROGRESS': 'info',
  'OPEN':        'info',
  'CLOSED':      'active',
  'COMPLETED':   'active',
  'CANCELLED':   'inactive',
  'CANCELED':    'inactive',
  'PENDING':     'warning',
};

/* ── Department filter dropdown ───────────────────────── */
function DeptFilter({ department, setDepartment, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const active = !!department;

  return (
    <div className="wip-filter-wrap" ref={ref}>
      <button
        className={`wip-filter-btn${active ? ' wip-filter-btn-active' : ''}`}
        onClick={() => setOpen(v => !v)}
        title="Filter by Department"
        style={{ display: 'flex', alignItems: 'center', gap: 5 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        {active ? <span className="wip-filter-badge" style={{ display: 'inline-flex' }}>1</span> : null}
      </button>
      {open && (
        <div className="wip-filter-panel" style={{ minWidth: 220 }}>
          <div className="wip-filter-title">Filter by Department</div>
          <div className="wip-filter-row">
            <label className="wip-filter-label">Department</label>
            <select
              className="wip-filter-input"
              value={department}
              onChange={e => setDepartment(e.target.value)}
            >
              <option value="">All Departments</option>
              {options.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          {active && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11 }}
                onClick={() => { setDepartment(''); setOpen(false); }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkOrdersPage() {
  const [search,     setSearch]     = useState('');
  const [department, setDepartment] = useState('');

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['work-orders'],
    queryFn: () => api.get('/work-orders', { params: { subsidiaryIds: '1,3', statuses: 'In Process,Released' } }).then((r) => r.data),
  });

  /* Unique department list from the data (sorted) */
  const deptOptions = [...new Set(
    workOrders
      .map(w => w.departmentName || w.parentDepartmentName)
      .filter(Boolean)
  )].sort();

  const q = search.toLowerCase();
  const filtered = workOrders.filter(w => {
    /* Department filter */
    if (department) {
      const wDept = w.departmentName || w.parentDepartmentName || '';
      if (wDept !== department) return false;
    }
    /* Search filter */
    if (!q) return true;
    return (
      w.workOrderNumber?.toLowerCase().includes(q) ||
      w.projectCode?.toLowerCase().includes(q)     ||
      w.projectName?.toLowerCase().includes(q)     ||
      w.customerName?.toLowerCase().includes(q)    ||
      w.departmentName?.toLowerCase().includes(q)  ||
      w.netsuiteStatus?.toLowerCase().includes(q)  ||
      w.signFamily?.toLowerCase().includes(q)
    );
  });

  const columns = [
    { key: '#',               label: '#',            num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'workOrderNumber', label: 'WO ID',        sort: true,  render: (r) => <span className="wip-link">{r.workOrderNumber}</span> },
    { key: 'projectCode',     label: 'Project ID',   sort: true,  render: (r) => r.projectCode ?? '—' },
    { key: 'projectName',     label: 'Project Name', sort: true,  render: (r) => <span className="wip-project-name">{r.projectName ?? '—'}</span> },
    { key: 'customerName',    label: 'Customer',     sort: true,  render: (r) => r.customerName ?? '—' },
    { key: 'sourceType',      label: 'Sign Type',    sort: true,  render: (r) => r.sourceType ?? '—' },
    { key: 'signFamily',      label: 'Sign Family',  sort: true,  render: (r) => r.signFamily ?? '—' },
    {
      key: 'netsuiteStatus', label: 'Status', sort: true,
      render: (row) => {
        const s = (row.netsuiteStatus ?? '').toUpperCase();
        return <Badge variant={STATUS_MAP[s] ?? 'pending'}>{row.netsuiteStatus ?? '—'}</Badge>;
      },
    },
    { key: 'departmentName',  label: 'Department',   sort: true,  render: (r) => r.departmentName ?? r.parentDepartmentName ?? '—' },
    { key: 'createdOn',       label: 'Date',         sort: true,  render: (r) => r.createdOn ? new Date(r.createdOn).toLocaleDateString('en-GB') : '—' },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="Work Order Master"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
        actions={
          <DeptFilter
            department={department}
            setDepartment={setDepartment}
            options={deptOptions}
          />
        }
      />
      <Table columns={columns} data={filtered} loading={isLoading} />
    </div>
  );
}
