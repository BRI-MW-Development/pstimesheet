import { useState } from 'react';
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

export default function WorkOrdersPage() {
  const [search, setSearch] = useState('');

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['work-orders'],
    queryFn: () => api.get('/work-orders', { params: { subsidiaryIds: '1,3', statuses: 'In Process,Released' } }).then((r) => r.data),
  });

  const q = search.toLowerCase();
  const filtered = !q
    ? workOrders
    : workOrders.filter(
        (w) =>
          w.workOrderNumber?.toLowerCase().includes(q) ||
          w.projectCode?.toLowerCase().includes(q) ||
          w.projectName?.toLowerCase().includes(q) ||
          w.customerName?.toLowerCase().includes(q) ||
          w.departmentName?.toLowerCase().includes(q) ||
          w.netsuiteStatus?.toLowerCase().includes(q) ||
          w.signFamily?.toLowerCase().includes(q)
      );

  const columns = [
    { key: '#',              label: '#',           num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'workOrderNumber',label: 'WO ID',       sort: true, render: (r) => <span className="wip-link">{r.workOrderNumber}</span> },
    { key: 'projectCode',    label: 'Project ID',  sort: true, render: (r) => r.projectCode ?? '—' },
    { key: 'projectName',    label: 'Project Name',sort: true, render: (r) => <span className="wip-project-name">{r.projectName ?? '—'}</span> },
    { key: 'customerName',   label: 'Customer Name',sort: true, render: (r) => r.customerName ?? '—' },
    { key: 'sourceType',     label: 'Sign Type',   sort: true, render: (r) => r.sourceType ?? '—' },
    { key: 'signFamily',     label: 'Sign Family', sort: true, render: (r) => r.signFamily ?? '—' },
    {
      key: 'netsuiteStatus', label: 'Status', sort: true,
      render: (row) => {
        const s = (row.netsuiteStatus ?? '').toUpperCase();
        return <Badge variant={STATUS_MAP[s] ?? 'pending'}>{row.netsuiteStatus ?? '—'}</Badge>;
      },
    },
    { key: 'departmentName', label: 'Department',  sort: true, render: (r) => r.departmentName ?? '—' },
    { key: 'createdOn',      label: 'Date',        sort: true, render: (r) => r.createdOn ? new Date(r.createdOn).toLocaleDateString('en-GB') : '—' },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="Work Order Master"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
      />
      <Table columns={columns} data={filtered} loading={isLoading} />
    </div>
  );
}
