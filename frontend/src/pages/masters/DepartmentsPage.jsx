import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';

function DeptViewModal({ dept, onClose, onEdit }) {
  return (
    <Modal title="Department Details" onClose={onClose}>
      <div className="modal-banner">
        <div>
          <div className="modal-banner-title">{dept.departmentCode ?? '—'}</div>
          <div className="modal-banner-sub">{dept.mainDepartment ?? 'No main department'}</div>
        </div>
        <div className="modal-banner-right">
          <Badge variant={dept.isActive ? 'active' : 'inactive'}>{dept.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-row"><span>Department Code</span><span className="wip-link">{dept.departmentCode ?? '—'}</span></div>
        <div className="detail-row"><span>Main Department</span><span>{dept.mainDepartment ?? '—'}</span></div>
        <div className="detail-row">
          <span>Status</span>
          <Badge variant={dept.isActive ? 'active' : 'inactive'}>{dept.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        <button type="button" className="btn btn-primary" onClick={() => { onClose(); onEdit(dept); }}>Edit</button>
      </div>
    </Modal>
  );
}

function DeptEditForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    mainDepartmentOverride: initial?.mainDepartment ?? '',
    isActive: initial?.isActive ?? true,
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="detail-grid" style={{ marginBottom: 16 }}>
        <div className="detail-row">
          <span>Department Code</span>
          <span style={{ fontWeight: 600 }}>{initial?.departmentCode ?? '—'}</span>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Main Department (override)</label>
        <input
          className="form-control"
          placeholder={initial?.mainDepartment ?? 'e.g. Operations'}
          value={form.mainDepartmentOverride}
          onChange={(e) => setForm((f) => ({ ...f, mainDepartmentOverride: e.target.value }))}
        />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
          Leave blank to use the ERP default: <em>{initial?.mainDepartment || 'none'}</em>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Status</label>
        <div className="toggle-row">
          <input
            id="dept-active" type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          <label htmlFor="dept-active">{form.isActive ? 'Active' : 'Inactive'}</label>
        </div>
      </div>

      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export default function DepartmentsPage() {
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch]   = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
  });

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload) =>
      api.put(`/departments/${editing.departmentId}/profile`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast('Department updated.', 'success');
      setEditing(null);
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const filtered = departments.filter((d) =>
    d.departmentCode?.toLowerCase().includes(search.toLowerCase()) ||
    d.mainDepartment?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: '#',              label: '#',               num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'departmentCode', label: 'Department Code', sort: true },
    { key: 'mainDepartment', label: 'Main Department', sort: true, render: (r) => r.mainDepartment ?? '—' },
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
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="wip-icon-btn wip-icon-btn-view" title="View" onClick={() => setViewing(row)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button className="wip-icon-btn wip-icon-btn-edit" title="Edit" onClick={() => setEditing(row)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="Department Master"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
      />
      <Table columns={columns} data={filtered} loading={isLoading} />

      {viewing && (
        <DeptViewModal dept={viewing} onClose={() => setViewing(null)} onEdit={setEditing} />
      )}
      {editing && (
        <Modal title={`Edit — ${editing.departmentCode}`} onClose={() => setEditing(null)}>
          <DeptEditForm
            initial={editing}
            onSave={save}
            onClose={() => setEditing(null)}
            saving={saving}
          />
        </Modal>
      )}
    </div>
  );
}
