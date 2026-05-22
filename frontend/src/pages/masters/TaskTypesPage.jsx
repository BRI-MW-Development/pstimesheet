import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';

function TaskTypeViewModal({ item, onClose }) {
  return (
    <Modal title="Task Type Details" onClose={onClose}>
      <div className="modal-banner">
        <div>
          <div className="modal-banner-title">{item.taskTypeName ?? '—'}</div>
        </div>
        <div className="modal-banner-right">
          <Badge variant={item.isActive ? 'active' : 'inactive'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
          <span className={`master-source-badge${item.source === 'erp' ? ' source-erp' : ' source-ps'}`}>
            {item.source === 'erp' ? 'ERP' : 'PS'}
          </span>
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-row"><span>Task Type Name</span><span>{item.taskTypeName ?? '—'}</span></div>
        <div className="detail-row">
          <span>Source</span>
          <span className={`master-source-badge${item.source === 'erp' ? ' source-erp' : ' source-ps'}`}>
            {item.source === 'erp' ? 'ERP' : 'PS'}
          </span>
        </div>
        <div className="detail-row">
          <span>Status</span>
          <Badge variant={item.isActive ? 'active' : 'inactive'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

export default function TaskTypesPage() {
  const [viewing, setViewing] = useState(null);
  const [search, setSearch]   = useState('');

  const { data: taskTypes = [], isLoading } = useQuery({
    queryKey: ['task-types'],
    queryFn: () => api.get('/task-types').then((r) => r.data),
  });

  const filtered = taskTypes.filter(
    (t) => t.taskTypeName?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: '#',            label: '#',              num: true, sort: false, render: (_, i) => i + 1 },
    { key: 'taskTypeName', label: 'Task Type Name', sort: true },
    {
      key: 'source', label: 'Source', sort: false,
      render: (r) => (
        <span className={`master-source-badge${r.source === 'erp' ? ' source-erp' : ' source-ps'}`}>
          {r.source === 'erp' ? 'ERP' : 'PS'}
        </span>
      ),
    },
    {
      key: 'isActive', label: 'Status', sort: true,
      render: (row) => (
        <Badge variant={row.isActive ? 'active' : 'inactive'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
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
        title="Task Type Master"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
      />
      <Table columns={columns} data={filtered} loading={isLoading} />

      {viewing && <TaskTypeViewModal item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
