import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';

export default function ItemsPage() {
  const [search, setSearch] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: () => api.get('/items').then((r) => r.data),
  });

  const filtered = items.filter(
    (i) =>
      i.itemcode?.toLowerCase().includes(search.toLowerCase()) ||
      i.itemName?.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: '#',             label: '#',           num: true, sort: false, render: (_, i) => i + 1 },
    { key: 'itemcode',      label: 'Item Code',   sort: true },
    { key: 'itemName',      label: 'Item Name',   sort: true },
    { key: 'UOM',           label: 'UOM',         sort: true, render: (r) => r.UOM ?? '—' },
    { key: 'masterCode',    label: 'Master Code', sort: true, render: (r) => r.masterCode ?? '—' },
    { key: 'subsidiaryCode',label: 'Subsidiary',  sort: true, render: (r) => r.subsidiaryCode ?? '—' },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="Item Master"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
      />
      <Table columns={columns} data={filtered} loading={isLoading} />
    </div>
  );
}
