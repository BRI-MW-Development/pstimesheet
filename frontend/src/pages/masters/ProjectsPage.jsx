import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';

export default function ProjectsPage() {
  const [search, setSearch] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r) => r.data),
  });

  const filtered = projects.filter(
    (p) =>
      p.projectName?.toLowerCase().includes(search.toLowerCase()) ||
      p.projectCode?.toLowerCase().includes(search.toLowerCase()) ||
      p.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      p.salesperson?.toLowerCase().includes(search.toLowerCase()) ||
      p.businessUnit?.toLowerCase().includes(search.toLowerCase()) ||
      p.owner?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: '#',             label: '#',               num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'projectCode',   label: 'Project ID',      sort: true, render: (r) => <span className="wip-link">{r.projectCode}</span> },
    { key: 'projectName',   label: 'Project Name',    sort: true, render: (r) => <span className="wip-project-name">{r.projectName ?? '—'}</span> },
    { key: 'salesperson',   label: 'Salesperson',     sort: true, render: (r) => r.salesperson ?? '—' },
    { key: 'customerName',  label: 'Customer',        sort: true, render: (r) => r.customerName ?? '—' },
    { key: 'businessUnit',  label: 'Business Unit',   sort: true, render: (r) => r.businessUnit ?? '—' },
    { key: 'projectManager',label: 'Project Manager', sort: true, render: (r) => r.projectManager ?? '—' },
    { key: 'owner',         label: 'Owner',           sort: true, render: (r) => r.owner ?? '—' },
    {
      key: 'status', label: 'Status', sort: true,
      render: (row) => (
        <Badge variant={row.status === 'Active' ? 'active' : row.status === 'Closed' ? 'inactive' : 'pending'}>
          {row.status ?? '—'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="Project Master"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
      />
      <Table columns={columns} data={filtered} loading={isLoading} />
    </div>
  );
}
