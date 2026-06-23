import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { usePermission } from '../../hooks/usePermission';

const VEHICLE_TYPES = ['Car', 'Van', 'Truck', 'Pickup', 'Bus', 'Heavy Machinery', 'Other'];
const BLANK = { plateNo: '', vehicleType: '', status: 'Active' };

function VehicleForm({ initial, onSave, onClose, saving, title }) {
  const [form, setForm] = useState(initial ?? BLANK);
  function set(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <span className="form-section-label">Vehicle Details</span>
        <div className="form-group">
          <label className="form-label">Plate Number <span style={{ color: 'var(--red)' }}>*</span></label>
          <input type="text" required className="form-control" value={form.plateNo}
            onChange={(e) => set('plateNo', e.target.value.toUpperCase())}
            placeholder="e.g. ABC-1234" />
        </div>
        <div className="form-group">
          <label className="form-label">Vehicle Type <span style={{ color: 'var(--red)' }}>*</span></label>
          <select required className="form-control" value={form.vehicleType} onChange={(e) => set('vehicleType', e.target.value)}>
            <option value="">Select…</option>
            {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-control" value={form.status ?? 'Active'} onChange={(e) => set('status', e.target.value)}>
            <option>Active</option>
            <option>Inactive</option>
            <option>Under Maintenance</option>
          </select>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function VehicleDetail({ vehicle, onClose, onEdit }) {
  return (
    <Modal title="Vehicle Details" onClose={onClose}>
      <div className="modal-banner">
        <div>
          <div className="modal-banner-title">{vehicle.plateNo ?? '—'}</div>
          <div className="modal-banner-sub">{vehicle.vehicleType ?? 'Unknown type'}</div>
        </div>
        <div className="modal-banner-right">
          <Badge variant={vehicle.status === 'Active' ? 'active' : vehicle.status === 'Under Maintenance' ? 'warning' : 'inactive'}>
            {vehicle.status ?? '—'}
          </Badge>
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-row"><span>Vehicle ID</span><span className="wip-link">{vehicle.vehicleId ?? '—'}</span></div>
        <div className="detail-row"><span>Plate Number</span><span>{vehicle.plateNo ?? '—'}</span></div>
        <div className="detail-row"><span>Type</span><span>{vehicle.vehicleType ?? '—'}</span></div>
        <div className="detail-row">
          <span>Status</span>
          <Badge variant={vehicle.status === 'Active' ? 'active' : vehicle.status === 'Under Maintenance' ? 'warning' : 'inactive'}>
            {vehicle.status ?? '—'}
          </Badge>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        <button type="button" className="btn btn-primary" onClick={() => { onClose(); onEdit(vehicle); }}>Edit</button>
      </div>
    </Modal>
  );
}

export default function VehiclesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canCreate = usePermission('VEHICLES', 'canCreate');
  const canWrite  = usePermission('VEHICLES', 'canWrite');
  const canDelete = usePermission('VEHICLES', 'canDelete');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => api.get('/vehicles').then((r) => r.data),
  });

  const { mutate: create, isPending: creating_ } = useMutation({
    mutationFn: (body) => api.post('/vehicles', body).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vehicles'] }); toast('Vehicle created.', 'success'); setCreating(false); },
    onError: (err) => toast(err?.response?.data?.message ?? 'Create failed.', 'error'),
  });

  const { mutate: update, isPending: updating } = useMutation({
    mutationFn: ({ vehicleId, ...body }) => api.patch(`/vehicles/${vehicleId}`, body).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vehicles'] }); toast('Vehicle updated.', 'success'); setEditing(null); },
    onError: (err) => toast(err?.response?.data?.message ?? 'Update failed.', 'error'),
  });

  const { mutate: remove } = useMutation({
    mutationFn: (vehicleId) => api.delete(`/vehicles/${vehicleId}`).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vehicles'] }); toast('Vehicle deleted.', 'success'); },
    onError: (err) => toast(err?.response?.data?.message ?? 'Delete failed.', 'error'),
  });

  const filtered = vehicles.filter(
    (v) =>
      v.plateNo?.toLowerCase().includes(search.toLowerCase()) ||
      v.vehicleType?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: '#',           label: '#',           num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'vehicleId',   label: 'ID',          sort: true },
    { key: 'plateNo',     label: 'Plate No.',   sort: true },
    { key: 'vehicleType', label: 'Type',        sort: true },
    {
      key: 'status', label: 'Status', sort: true,
      render: (row) => (
        <Badge variant={row.status === 'Active' ? 'active' : row.status === 'Under Maintenance' ? 'warning' : 'inactive'}>
          {row.status}
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
          {canWrite && (
            <button className="wip-icon-btn wip-icon-btn-edit" title="Edit" onClick={() => setEditing(row)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          {canDelete && (
            <button className="wip-icon-btn wip-icon-btn-delete" title="Delete"
              onClick={() => { if (confirm(`Delete vehicle ${row.plateNo}?`)) remove(row.vehicleId); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="Vehicle Master"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
        actions={
          {canCreate && <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Add Vehicle</button>}
        }
      />
      <Table columns={columns} data={filtered} loading={isLoading} />

      {viewing && (
        <VehicleDetail
          vehicle={viewing}
          onClose={() => setViewing(null)}
          onEdit={setEditing}
        />
      )}
      {creating && (
        <VehicleForm title="Add Vehicle" onSave={create} onClose={() => setCreating(false)} saving={creating_} />
      )}
      {editing && (
        <VehicleForm
          title={`Edit ${editing.plateNo}`}
          initial={editing}
          onSave={(form) => update({ ...form, vehicleId: editing.vehicleId })}
          onClose={() => setEditing(null)}
          saving={updating}
        />
      )}
    </div>
  );
}
