import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';

function ShiftViewModal({ shift, onClose, onEdit }) {
  const isActive = shift.status === 'Active';
  return (
    <Modal title="Shift Details" onClose={onClose}>
      <div className="modal-banner">
        <div>
          <div className="modal-banner-title">{shift.shiftName ?? '—'}</div>
          <div className="modal-banner-sub">{shift.startTime ?? '—'} – {shift.endTime ?? '—'}</div>
        </div>
        <div className="modal-banner-right">
          <Badge variant={isActive ? 'active' : 'inactive'}>{shift.status ?? '—'}</Badge>
          <span className="wip-link" style={{ fontSize: 12 }}>{shift.shiftCode}</span>
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-row"><span>Shift Code</span><span className="wip-link">{shift.shiftCode ?? '—'}</span></div>
        <div className="detail-row"><span>Shift Name</span><span>{shift.shiftName ?? '—'}</span></div>
        <div className="detail-row"><span>Start Time</span><span>{shift.startTime ?? '—'}</span></div>
        <div className="detail-row"><span>End Time</span><span>{shift.endTime ?? '—'}</span></div>
        <div className="detail-row"><span>Grace Period</span><span>{shift.graceMinutes ?? 0} min</span></div>
        <div className="detail-row">
          <span>Status</span>
          <Badge variant={isActive ? 'active' : 'inactive'}>{shift.status ?? '—'}</Badge>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        <button type="button" className="btn btn-primary" onClick={() => { onClose(); onEdit(shift); }}>Edit</button>
      </div>
    </Modal>
  );
}

function ShiftForm({ initial, onSave, onClose, saving }) {
  const isEdit = Boolean(initial?.shiftCode);
  // Backend returns `status: 'Active'/'Inactive'` — map to boolean for the form
  const [form, setForm] = useState({
    shiftCode:    initial?.shiftCode    ?? '',
    shiftName:    initial?.shiftName    ?? '',
    startTime:    initial?.startTime    ?? '',
    endTime:      initial?.endTime      ?? '',
    graceMinutes: initial?.graceMinutes ?? 10,
    status:       initial?.status       ?? 'Active',
  });

  function handleSubmit(e) {
    e.preventDefault();
    // Night shifts (e.g. 22:00–06:00) are allowed — only validate if both values same-day
    if (form.startTime && form.endTime && form.startTime === form.endTime) {
      alert('Start time and end time cannot be the same.'); return;
    }
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit}>
      <span className="form-section-label">Shift Details</span>
      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label">Shift Code</label>
          <input className="form-control" type="text"
            value={form.shiftCode}
            readOnly={isEdit}
            style={isEdit ? { background: 'var(--bg2)', color: 'var(--text3)' } : {}}
            required={!isEdit}
            onChange={(e) => setForm((f) => ({ ...f, shiftCode: e.target.value.toUpperCase() }))}
            placeholder="e.g. SHIFT-A" />
        </div>
        <div className="form-group">
          <label className="form-label">Shift Name</label>
          <input className="form-control" type="text" required value={form.shiftName}
            onChange={(e) => setForm((f) => ({ ...f, shiftName: e.target.value }))}
            placeholder="e.g. Morning Shift" />
        </div>
        <div className="form-group">
          <label className="form-label">Start Time</label>
          <input className="form-control" type="time" required value={form.startTime}
            onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">End Time</label>
          <input className="form-control" type="time" required value={form.endTime}
            onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Grace Period (mins)</label>
          <input className="form-control" type="number" min="0" max="180" value={form.graceMinutes}
            onChange={(e) => setForm((f) => ({ ...f, graceMinutes: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-control"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Shift'}
        </button>
      </div>
    </form>
  );
}

export default function ShiftsPage() {
  const [viewing, setViewing]         = useState(null);
  const [editing, setEditing]         = useState(null);
  const [search, setSearch]           = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => api.get('/system-settings/shifts').then((r) => r.data),
  });

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload) =>
      editing.shiftCode
        ? api.patch(`/system-settings/shifts/${editing.shiftCode}`, payload).then((r) => r.data)
        : api.post('/system-settings/shifts', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast(editing.shiftCode ? 'Shift updated.' : 'Shift created.', 'success');
      setEditing(null);
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const filtered = shifts
    .filter((s) => showInactive || s.status === 'Active')
    .filter((s) =>
      !search ||
      s.shiftCode?.toLowerCase().includes(search.toLowerCase()) ||
      s.shiftName?.toLowerCase().includes(search.toLowerCase())
    );

  const columns = [
    { key: '#',           label: '#',           num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'shiftCode',   label: 'Shift Code',  sort: true, render: (r) => <span className="wip-link">{r.shiftCode}</span> },
    { key: 'shiftName',   label: 'Shift Name',  sort: true },
    { key: 'startTime',   label: 'Start',       sort: true },
    { key: 'endTime',     label: 'End',         sort: true },
    { key: 'graceMinutes',label: 'Grace',       sort: true, render: (r) => `${r.graceMinutes ?? 0} min` },
    {
      key: 'status', label: 'Status', sort: true,
      render: (row) => (
        <Badge variant={row.status === 'Active' ? 'active' : 'inactive'}>{row.status}</Badge>
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
        title="Shift Setup"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
            <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ Add Shift</button>
          </div>
        }
      />
      <Table columns={columns} data={filtered} loading={isLoading} />

      {viewing && (
        <ShiftViewModal shift={viewing} onClose={() => setViewing(null)} onEdit={setEditing} />
      )}
      {editing && (
        <Modal title={editing.shiftCode ? `Edit — ${editing.shiftCode}` : 'Add Shift'} onClose={() => setEditing(null)}>
          <ShiftForm initial={editing} onSave={save} onClose={() => setEditing(null)} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
