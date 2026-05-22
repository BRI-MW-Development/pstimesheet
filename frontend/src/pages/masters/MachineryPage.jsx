import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';

const STATUS_VARIANT = { Operational: 'active', 'Service Due': 'warning', 'Off-service': 'inactive', 'Cert. Due': 'warning' };

function MachineryViewModal({ item, onClose }) {
  return (
    <Modal title="Machinery Details" onClose={onClose}>
      <div className="modal-banner">
        <div>
          <div className="modal-banner-title">{item.machineName ?? '—'}</div>
          <div className="modal-banner-sub">{item.departmentCode ?? 'No department'}</div>
        </div>
        <div className="modal-banner-right">
          <Badge variant={STATUS_VARIANT[item.status] ?? 'pending'}>{item.status ?? '—'}</Badge>
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-row"><span>Machine ID</span><span className="wip-link">{item.machineId ?? '—'}</span></div>
        <div className="detail-row"><span>Machine Name</span><span>{item.machineName ?? '—'}</span></div>
        <div className="detail-row"><span>Department</span><span>{item.departmentCode ?? '—'}</span></div>
        <div className="detail-row">
          <span>Status</span>
          <Badge variant={STATUS_VARIANT[item.status] ?? 'pending'}>{item.status ?? '—'}</Badge>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

export default function MachineryPage() {
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);

  const { data: machines = [], isLoading } = useQuery({
    queryKey: ['machinery'],
    queryFn: () => api.get('/machinery').then((r) => r.data),
  });

  const filtered = machines.filter(
    (m) =>
      m.machineName?.toLowerCase().includes(search.toLowerCase()) ||
      m.departmentCode?.toLowerCase().includes(search.toLowerCase()) ||
      m.machineId?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: '#',             label: '#',            num: true, sort: false, render: (_, i) => i + 1 },
    { key: 'machineName',   label: 'Machine Name', sort: true },
    { key: 'departmentCode',label: 'Department',   sort: true, render: (r) => r.departmentCode ?? '—' },
    { key: 'machineId',     label: 'Machine ID',   sort: true, render: (r) => r.machineId ? <span className="doc-no">{r.machineId}</span> : '—' },
    {
      key: 'status', label: 'Status', sort: true,
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status] ?? 'pending'}>{row.status ?? '—'}</Badge>
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
        title="Machinery Master"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
      />
      <Table columns={columns} data={filtered} loading={isLoading} />

      {viewing && <MachineryViewModal item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
