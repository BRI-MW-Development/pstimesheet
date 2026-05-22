import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';

function EquipmentDetail({ item, onClose }) {
  return (
    <Modal title="Equipment Details" onClose={onClose}>
      <div className="modal-banner">
        <div>
          <div className="modal-banner-title">{item.equipmentName ?? '—'}</div>
          <div className="modal-banner-sub">{item.departmentCode ?? 'No department'}</div>
        </div>
        <div className="modal-banner-right">
          <Badge variant={item.status === 'Active' ? 'active' : 'inactive'}>{item.status ?? '—'}</Badge>
          <span className={`master-source-badge${item.source === 'erp' ? ' source-erp' : ' source-ps'}`}>
            {item.source === 'erp' ? 'ERP' : 'PS'}
          </span>
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-row"><span>Equipment Name</span><span>{item.equipmentName ?? '—'}</span></div>
        <div className="detail-row"><span>Department</span><span>{item.departmentCode ?? '—'}</span></div>
        <div className="detail-row"><span>Status</span><Badge variant={item.status === 'Active' ? 'active' : 'inactive'}>{item.status ?? '—'}</Badge></div>
        <div className="detail-row">
          <span>Source</span>
          <span className={`master-source-badge${item.source === 'erp' ? ' source-erp' : ' source-ps'}`}>
            {item.source === 'erp' ? 'ERP' : 'PS'}
          </span>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

export default function AccessEquipmentPage() {
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['access-equipment'],
    queryFn: () => api.get('/access-equipment').then((r) => r.data),
  });

  const filtered = equipment.filter(
    (e) =>
      e.equipmentName?.toLowerCase().includes(search.toLowerCase()) ||
      e.departmentCode?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: '#',             label: '#',          num: true, sort: false, render: (_, i) => i + 1 },
    { key: 'equipmentName', label: 'Name',       sort: true },
    { key: 'departmentCode',label: 'Department', sort: true, render: (r) => r.departmentCode ?? '—' },
    {
      key: 'status', label: 'Status', sort: true,
      render: (row) => (
        <Badge variant={row.status === 'Active' ? 'active' : 'inactive'}>{row.status ?? '—'}</Badge>
      ),
    },
    {
      key: 'source', label: 'Source', sort: false,
      render: (row) => (
        <span className={`master-source-badge${row.source === 'erp' ? ' source-erp' : ' source-ps'}`}>
          {row.source === 'erp' ? 'ERP' : 'PS'}
        </span>
      ),
    },
    {
      key: 'actions', label: '', sort: false,
      render: (row) => (
        <button className="wip-icon-btn wip-icon-btn-view" title="View" onClick={() => setViewing(row)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      ),
    },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="Access Equipment Master"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
      />
      <Table columns={columns} data={filtered} loading={isLoading} />

      {viewing && <EquipmentDetail item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
