import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';

function Avatar({ imageUrl, name, size = 32 }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: 'var(--accent)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function EmployeeDetail({ emp, onClose, onEdit }) {
  const fullName = [emp.firstName, emp.lastname].filter(Boolean).join(' ');
  return (
    <Modal title={fullName || emp.employeeNo} onClose={onClose}>
      <div className="modal-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar imageUrl={emp.imageUrl} name={fullName} size={52} />
          <div>
            <div className="modal-banner-title">{fullName || '—'}</div>
            <div className="modal-banner-sub">{[emp.designation, emp.departmentCode].filter(Boolean).join(' · ') || '—'}</div>
          </div>
        </div>
        <div className="modal-banner-right">
          <Badge variant={emp.status === 'Active' ? 'active' : 'inactive'}>{emp.status ?? '—'}</Badge>
          <span className="wip-link" style={{ fontSize: 12 }}>{emp.employeeNo}</span>
        </div>
      </div>
      <div className="detail-grid-2col">
        <div className="detail-row"><span>Employee No.</span><span className="wip-link">{emp.employeeNo ?? '—'}</span></div>
        <div className="detail-row"><span>Department</span><span>{emp.departmentCode ?? '—'}</span></div>
        <div className="detail-row"><span>Sub-Department</span><span>{emp.subDepartment ?? '—'}</span></div>
        <div className="detail-row"><span>Category</span><span>{emp.category ?? '—'}</span></div>
        <div className="detail-row"><span>Email</span><span>{emp.emailId ?? '—'}</span></div>
        <div className="detail-row"><span>Subsidiary</span><span>{emp.subsidiaryCode ?? '—'}</span></div>
        <div className="detail-row"><span>Location</span><span>{[emp.city, emp.emiratesOrState].filter(Boolean).join(', ') || '—'}</span></div>
        <div className="detail-row"><span>Status</span><Badge variant={emp.status === 'Active' ? 'active' : 'inactive'}>{emp.status ?? '—'}</Badge></div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        <button type="button" className="btn btn-primary" onClick={() => { onClose(); onEdit(emp); }}>Edit</button>
      </div>
    </Modal>
  );
}

function EmployeeEditModal({ emp, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fullName = [emp.firstName, emp.lastname].filter(Boolean).join(' ');

  const [form, setForm] = useState({
    emailId:       emp.emailId       ?? '',
    subDepartment: emp.subDepartment ?? '',
    category:      emp.category      ?? '',
    imageUrl:      emp.imageUrl      ?? '',
  });

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload) => api.patch(`/employees/${emp.employeeNo}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast('Employee updated.', 'success');
      onClose();
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    save(form);
  }

  return (
    <Modal title={`Edit — ${fullName || emp.employeeNo}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Avatar imageUrl={form.imageUrl || emp.imageUrl} name={fullName} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{fullName || emp.employeeNo}</div>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>{emp.designation ?? '—'} · {emp.departmentCode ?? '—'}</div>
          </div>
        </div>

        <span className="form-section-label">Editable Fields</span>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" placeholder="employee@company.com"
              value={form.emailId}
              onChange={(e) => setForm((f) => ({ ...f, emailId: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Sub-Department</label>
            <input className="form-control" placeholder="e.g. Fabrication"
              value={form.subDepartment}
              onChange={(e) => setForm((f) => ({ ...f, subDepartment: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <input className="form-control" placeholder="e.g. Skilled"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Image URL</label>
            <input className="form-control" placeholder="https://..."
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} />
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function EmployeesPage() {
  const [viewing, setViewing]   = useState(null);
  const [editing, setEditing]   = useState(null);
  const [search, setSearch]     = useState('');

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then((r) => r.data),
  });

  const filtered = employees.filter((e) => {
    const name = [e.firstName, e.lastname].join(' ').toLowerCase();
    const q = search.toLowerCase();
    return (
      name.includes(q) ||
      e.employeeNo?.toLowerCase().includes(q) ||
      e.departmentCode?.toLowerCase().includes(q) ||
      e.designation?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q)
    );
  });

  const columns = [
    { key: '#',             label: '#',                num: true,  sort: false, render: (_, i) => i + 1 },
    {
      key: 'employeeNo', label: 'Employee Code', sort: true,
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar imageUrl={r.imageUrl} name={[r.firstName, r.lastname].filter(Boolean).join(' ')} size={28} />
          <span className="doc-no">{r.employeeNo ?? '—'}</span>
        </div>
      ),
    },
    { key: 'fullName',       label: 'Employee Name',   sort: true,  sortValue: (r) => [r.firstName, r.lastname].join(' ').toLowerCase(), render: (r) => [r.firstName, r.lastname].filter(Boolean).join(' ') || '—' },
    { key: 'departmentCode', label: 'Department',      sort: true,  render: (r) => r.departmentCode ?? '—' },
    { key: 'subDepartment',  label: 'Sub-Dept',        sort: true,  render: (r) => r.subDepartment ?? '—' },
    { key: 'category',       label: 'Category',        sort: true,  render: (r) => r.category ?? '—' },
    { key: 'emailId',        label: 'Email',           sort: true,  render: (r) => r.emailId ?? '—' },
    {
      key: 'status', label: 'Status', sort: true,
      render: (row) => (
        <Badge variant={row.status === 'Active' ? 'active' : 'inactive'}>{row.status ?? '—'}</Badge>
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
        title="Employee Master"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
      />
      <Table columns={columns} data={filtered} loading={isLoading} />
      {viewing && <EmployeeDetail emp={viewing} onClose={() => setViewing(null)} onEdit={setEditing} />}
      {editing && <EmployeeEditModal emp={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
