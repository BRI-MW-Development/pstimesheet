import { useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import SearchSelect from '../../components/ui/SearchSelect';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';
import { formatDate } from '../../utils/format';

const STATUS_VARIANT = { 'WO Completed': 'approved', 'Data Entry Completed': 'submitted', Draft: 'draft' };
const WOC_STATUSES   = ['WO Completed', 'Data Entry Completed'];

function fmt(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)      return `${bytes} B`;
  if (bytes < 1048576)   return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
function fileIcon(mime = '', name = '') {
  if (mime.includes('pdf')   || name.endsWith('.pdf'))                           return '📄';
  if (mime.includes('image'))                                                    return '🖼️';
  if (mime.includes('word')  || name.endsWith('.docx') || name.endsWith('.doc')) return '📝';
  if (mime.includes('sheet') || name.endsWith('.xlsx') || name.endsWith('.xls')) return '📊';
  return '📎';
}

// ── Filter panel ─────────────────────────────────────────────────────────────
function FilterPanel({ filters, setFilters, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const active = Object.values(filters).filter(Boolean).length;
  return (
    <div className="wip-filter-wrap" ref={ref}>
      <button className={`wip-filter-btn${active ? ' wip-filter-btn-active' : ''}`} onClick={() => setOpen(v => !v)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        {active > 0 && <span className="wip-filter-badge">{active}</span>}
      </button>
      {open && (
        <div className="wip-filter-panel">
          <div className="wip-filter-title">Filters</div>
          <div className="wip-filter-row"><label className="wip-filter-label">Date From</label>
            <input type="date" className="wip-filter-input" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} /></div>
          <div className="wip-filter-row"><label className="wip-filter-label">Date To</label>
            <input type="date" className="wip-filter-input" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} /></div>
          <div className="wip-filter-row"><label className="wip-filter-label">Status</label>
            <select className="wip-filter-input" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All Status</option>
              {WOC_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select></div>
          <div className="wip-filter-row"><label className="wip-filter-label">Department</label>
            <input className="wip-filter-input" value={filters.department} placeholder="Any"
              onChange={e => setFilters(f => ({ ...f, department: e.target.value }))} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { onClear(); setOpen(false); }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── WOC Form Modal ────────────────────────────────────────────────────────────
function WocFormModal({ initial, onClose, onSaved }) {
  const toast        = useToast();
  const queryClient  = useQueryClient();
  const user         = useAuthStore(s => s.user);
  const isEdit       = Boolean(initial?.id);

  const blankForm = {
    projectId:    '',
    customerName: '',
    department:   '',
    workOrderNumber: '',
    workOrderStatus: '',
    sourceType:   '',
    status:       '',
    completedDate: new Date().toISOString().slice(0, 10),
    enteredBy:    user?.displayName ?? user?.username ?? '',
    remarks:      '',
  };

  const [form, setForm]             = useState(isEdit ? { ...blankForm, ...initial } : blankForm);
  const [tab, setTab]               = useState('details');
  const [stagedFiles, setStagedFiles] = useState([]);
  const [savedFiles, setSavedFiles] = useState([]);
  const [dragging, setDragging]     = useState(false);
  const [tsRows, setTsRows]         = useState(null); // null = not loaded
  const fileRef                     = useRef();

  // Doc No preview
  const { data: preview } = useQuery({
    queryKey: ['woc-doc-preview'],
    queryFn: () => api.get('/wo-complete/preview-doc-no').then(r => r.data.docNo),
    enabled: !isEdit,
  });

  // Projects — only those that appear in at least one timesheet
  const { data: tsProjects = [] } = useQuery({
    queryKey: ['ts-project-codes'],
    queryFn: () => api.get('/timesheets/project-codes').then(r => r.data),
  });

  // Work orders
  const { data: allWorkOrders = [] } = useQuery({
    queryKey: ['work-orders-v2'],
    queryFn: () => api.get('/work-orders', { params: { subsidiaryIds: '1,3', statuses: 'In Process,Released' } }).then(r => r.data),
  });

  // Completed WO numbers (to exclude)
  const { data: completedWoNos = [] } = useQuery({
    queryKey: ['completed-wos'],
    queryFn: () => api.get('/wo-complete').then(r => r.data.map(w => w.workOrderNumber)),
  });

  // WOs that have a Full QC inspection (required before WO Complete)
  const { data: qcEligibleWos = [] } = useQuery({
    queryKey: ['qc-eligible-wos'],
    queryFn: () => api.get('/qc/eligible-wos').then(r => r.data),
  });

  // Existing attachments for edit
  useEffect(() => {
    if (isEdit && initial?.id) {
      api.get(`/wo-complete/${initial.id}/attachments`).then(r => setSavedFiles(r.data)).catch(() => {});
    }
  }, [isEdit, initial?.id]);

  // Load timesheets when WO changes
  useEffect(() => {
    const wo = form.workOrderNumber;
    if (!wo) { setTsRows(null); return; }
    setTsRows('loading');
    api.get('/timesheets', { params: { workOrderNo: wo } })
      .then(r => setTsRows(r.data))
      .catch(() => setTsRows([]));
  }, [form.workOrderNumber]);

  const depts = [...new Set(allWorkOrders
    .map(w => (w.departmentName || w.parentDepartmentName || '').trim())
    .filter(Boolean))].sort();

  const completedSet  = new Set(completedWoNos);
  const eligibleSet   = new Set(qcEligibleWos);
  const currentWoNo   = (initial?.workOrderNumber || '').trim();

  const isProductionDept = form.department?.toLowerCase().includes('production');

  const filteredWOs = !form.department ? [] : allWorkOrders.filter(w => {
    const woNo  = (w.workOrderNumber || '').trim();
    const wProj = w.projectCode || '';
    const wDept = (w.departmentName || w.parentDepartmentName || '').toLowerCase();
    if (form.projectId && wProj !== form.projectId) return false;
    if (!wDept.includes(form.department.toLowerCase())) return false;
    if (completedSet.has(woNo) && woNo !== currentWoNo) return false;
    // Full QC check only applies to Production department
    if (isProductionDept && woNo !== currentWoNo && !eligibleSet.has(woNo)) return false;
    return true;
  });
  const woOptions = filteredWOs.map(w => ({
    value: w.workOrderNumber,
    label: w.workOrderNumber,
  }));

  function onProjectChange(pid) {
    const proj = tsProjects.find(p => p.projectId === pid);
    const raw  = proj?.projectName ?? '';
    const customer = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw;
    setForm(f => ({ ...f, projectId: pid, customerName: customer, workOrderNumber: '', workOrderStatus: '', sourceType: '', department: '' }));
    setTsRows(null);
  }

  function onWoChange(wo) {
    const opt = allWorkOrders.find(w => w.workOrderNumber === wo);
    setForm(f => ({
      ...f,
      workOrderNumber: wo,
      workOrderStatus: opt?.netsuiteStatus ?? '',
      sourceType: opt?.sourceType ?? '',
    }));
  }

  // File handling
  function addFiles(files) {
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) { toast(`${file.name} exceeds 5 MB limit.`, 'error'); return; }
      const reader = new FileReader();
      reader.onload = e => {
        const base64 = e.target.result.split(',')[1];
        setStagedFiles(s => [...s, { name: file.name, type: file.type, size: file.size, data: base64 }]);
      };
      reader.readAsDataURL(file);
    });
  }

  const { mutate: deleteSaved } = useMutation({
    mutationFn: id => api.delete(`/wo-complete/attachments/${id}`).then(r => r.data),
    onSuccess: (_, id) => { setSavedFiles(s => s.filter(f => f.id !== id)); toast('Attachment removed.', 'success'); },
    onError: err => toast(err?.response?.data?.message ?? 'Delete failed.', 'error'),
  });

  // Save
  const [uploadProgress, setUploadProgress] = useState('');
  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: async (payload) => {
      let id;
      if (isEdit) {
        await api.put(`/wo-complete/${initial.id}`, payload);
        id = initial.id;
      } else {
        const res = await api.post('/wo-complete', payload);
        id = res.data.id;
      }
      if (stagedFiles.length > 0) {
        for (let i = 0; i < stagedFiles.length; i++) {
          const f = stagedFiles[i];
          setUploadProgress(`Uploading file ${i + 1} of ${stagedFiles.length}…`);
          await api.post(`/wo-complete/${id}/attachments`, {
            fileName: f.name, mimeType: f.type, fileData: f.data, fileSize: f.size,
          }).catch(() => {});
        }
        setUploadProgress('');
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['woc'] });
      queryClient.invalidateQueries({ queryKey: ['completed-wos'] });
      queryClient.invalidateQueries({ queryKey: ['woc-doc-preview'] });
      toast(isEdit ? 'Record updated.' : 'Work order marked complete.', 'success');
      onSaved();
    },
    onError: err => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.workOrderNumber) { toast('Please select a work order.', 'error'); return; }
    if (!form.status)          { toast('Please select a status.', 'error'); return; }
    save(form);
  }

  const projOptions = tsProjects.map(p => ({ value: p.projectId, label: p.projectId }));

  return (
    <Modal title="" onClose={onClose} size="lg">
      <div className="woc-modal-layout">
        {/* Header */}
        <div className="woc-modal-header">
          <div className="woc-modal-title-row">
            <div className="woc-modal-title">{isEdit ? `Edit — ${initial.docNo}` : 'Mark WO Complete'}</div>
            {!isEdit && preview && <span className="woc-docno-pill">{preview}</span>}
          </div>
          <div className="woc-modal-tabs">
            {[['details','Details'],['timesheets','Timesheets'],['attachments','Attachments']].map(([k, label]) => (
              <button key={k} className={`woc-modal-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
                {label}
                {k === 'timesheets' && Array.isArray(tsRows) && tsRows.length > 0 &&
                  <span className="woc-tab-badge">{tsRows.length}</span>}
                {k === 'attachments' && (savedFiles.length + stagedFiles.length) > 0 &&
                  <span className="woc-tab-badge">{savedFiles.length + stagedFiles.length}</span>}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ── Details tab ── */}
          {tab === 'details' && (
            <div className="woc-modal-body">
              <div className="woc-form-grid">
                <div className="form-group">
                  <label className="form-label">Project ID</label>
                  <SearchSelect options={projOptions} value={form.projectId}
                    onChange={onProjectChange} placeholder="Select project…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer / Project Name</label>
                  <input className="form-control" value={form.customerName} readOnly
                    placeholder="Auto-filled from project" />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-control" value={form.department}
                    onChange={e => { setForm(f => ({ ...f, department: e.target.value, workOrderNumber: '' })); setTsRows(null); }}>
                    <option value="">Select department…</option>
                    {depts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Work Order <span style={{ color: '#ef4444' }}>*</span></label>
                  <SearchSelect options={woOptions} value={form.workOrderNumber}
                    onChange={onWoChange}
                    placeholder={form.department ? 'Select work order…' : 'Select department first…'} />
                  {isProductionDept && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      Production: only Work Orders with a completed Full QC inspection are listed.
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Status <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="form-control" required value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="">Select status…</option>
                    {WOC_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Completion Date</label>
                  <input type="date" className="form-control" required value={form.completedDate}
                    onChange={e => setForm(f => ({ ...f, completedDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Entered By</label>
                  <input className="form-control" value={form.enteredBy} readOnly />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Remarks</label>
                  <textarea className="form-control" rows={2} value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    placeholder="Optional notes…" />
                </div>
              </div>
            </div>
          )}

          {/* ── Timesheets tab ── */}
          {tab === 'timesheets' && (
            <div className="woc-modal-body">
              {!form.workOrderNumber ? (
                <p className="woc-ts-empty">Select a work order to view related timesheet entries.</p>
              ) : tsRows === 'loading' ? (
                <p className="woc-ts-empty">Loading…</p>
              ) : !Array.isArray(tsRows) || tsRows.length === 0 ? (
                <p className="woc-ts-empty">No timesheet entries found for this work order.</p>
              ) : (
                <table className="woc-ts-table">
                  <thead><tr>
                    <th>#</th><th>Doc No</th><th>Date</th><th>Department</th><th>Entered By</th><th>Status</th>
                  </tr></thead>
                  <tbody>
                    {tsRows.map((r, i) => (
                      <tr key={r.tsDocNo ?? i}>
                        <td>{i + 1}</td>
                        <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.tsDocNo}</span></td>
                        <td>{formatDate(r.entryDate)}</td>
                        <td style={{ color: '#6b7280' }}>{r.department_code || '—'}</td>
                        <td>{r.entered_by_name || '—'}</td>
                        <td><Badge variant={({ Draft:'draft',Submitted:'submitted',Approved:'approved',Rejected:'rejected' })[r.status] ?? 'draft'}>{r.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Attachments tab ── */}
          {tab === 'attachments' && (
            <div className="woc-modal-body">
              {/* Dropzone */}
              <div
                className={`woc-dropzone${dragging ? ' woc-dropzone-hover' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>Drop files here or <strong>click to upload</strong></span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Max 5 MB per file</span>
                <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
                  onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              </div>

              {/* Staged files */}
              {stagedFiles.length > 0 && (
                <div className="woc-file-section">
                  <div className="woc-file-section-label">Pending upload ({stagedFiles.length})</div>
                  {stagedFiles.map((f, i) => (
                    <div key={i} className="woc-file-item">
                      <span style={{ fontSize: 18 }}>{fileIcon(f.type, f.name)}</span>
                      <span className="woc-file-item-name">{f.name}</span>
                      <span className="woc-file-item-size">{fmt(f.size)}</span>
                      <button type="button" className="woc-file-item-del"
                        onClick={() => setStagedFiles(s => s.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Saved files */}
              {savedFiles.length > 0 && (
                <div className="woc-file-section">
                  <div className="woc-file-section-label">Saved attachments ({savedFiles.length})</div>
                  {savedFiles.map(f => (
                    <div key={f.id} className="woc-file-item">
                      <span style={{ fontSize: 18 }}>{fileIcon(f.mimeType, f.fileName)}</span>
                      <span className="woc-file-item-name">{f.fileName}</span>
                      <span className="woc-file-item-size">{fmt(f.fileSize)}</span>
                      <button type="button" className="woc-file-item-del"
                        onClick={() => { if (confirm('Remove this attachment?')) deleteSaved(f.id); }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {stagedFiles.length === 0 && savedFiles.length === 0 && (
                <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 12 }}>No attachments yet.</p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="woc-modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.workOrderNumber || !form.status}>
              {uploadProgress || (saving ? 'Saving…' : isEdit ? '✏️ Save Changes' : '✅ Mark Complete')}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// ── View Modal ────────────────────────────────────────────────────────────────
function WocViewModal({ record, onClose }) {
  const toast       = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('details');

  const { data: attachments = [], isLoading: loadingAttach } = useQuery({
    queryKey: ['woc-attachments', record.id],
    queryFn: () => api.get(`/wo-complete/${record.id}/attachments`).then(r => r.data),
    enabled: tab === 'attachments',
  });

  const { data: tsRows = [] } = useQuery({
    queryKey: ['woc-timesheets', record.workOrderNumber],
    queryFn: () => api.get('/timesheets', { params: { workOrderNo: record.workOrderNumber } }).then(r => r.data),
    enabled: tab === 'timesheets' && Boolean(record.workOrderNumber),
  });

  const { mutate: deleteAttach } = useMutation({
    mutationFn: id => api.delete(`/wo-complete/attachments/${id}`).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['woc-attachments', record.id] }); toast('Removed.', 'success'); },
    onError: err => toast(err?.response?.data?.message ?? 'Delete failed.', 'error'),
  });

  return (
    <Modal title={`${record.docNo} — ${record.workOrderNumber ?? ''}`} onClose={onClose} size="lg">
      <div className="woc-modal-tabs" style={{ padding: '0 0 12px' }}>
        {[['details','Details'],['timesheets','Timesheets'],['attachments','Attachments']].map(([k, label]) => (
          <button key={k} className={`woc-modal-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="detail-grid">
          {[
            ['Doc No.',       record.docNo],
            ['Work Order',    record.workOrderNumber ?? '—'],
            ['Project ID',    record.projectId ?? '—'],
            ['Customer',      record.customerName ?? record.projectName ?? '—'],
            ['Department',    record.department ?? '—'],
            ['WO Status',     record.workOrderStatus ?? '—'],
            ['Status',        null],
            ['Completed Date',formatDate(record.completedDate)],
            ['Entered By',    record.enteredBy ?? '—'],
            ['Remarks',       record.remarks ?? '—'],
          ].map(([label, val]) => (
            <div className="detail-row" key={label}>
              <span>{label}</span>
              {label === 'Status'
                ? <Badge variant={STATUS_VARIANT[record.status] ?? 'default'}>{record.status ?? '—'}</Badge>
                : <span>{val}</span>}
            </div>
          ))}
        </div>
      )}

      {tab === 'timesheets' && (
        !record.workOrderNumber ? (
          <p className="woc-ts-empty">No work order linked.</p>
        ) : tsRows.length === 0 ? (
          <p className="woc-ts-empty">No timesheet entries found.</p>
        ) : (
          <table className="woc-ts-table">
            <thead><tr><th>#</th><th>Doc No</th><th>Date</th><th>Department</th><th>Entered By</th><th>Status</th></tr></thead>
            <tbody>
              {tsRows.map((r, i) => (
                <tr key={r.tsDocNo ?? i}>
                  <td>{i + 1}</td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.tsDocNo}</span></td>
                  <td>{formatDate(r.entryDate)}</td>
                  <td style={{ color: '#6b7280' }}>{r.department_code || '—'}</td>
                  <td>{r.entered_by_name || '—'}</td>
                  <td><Badge variant={({ Draft:'draft',Submitted:'submitted',Approved:'approved',Rejected:'rejected' })[r.status] ?? 'draft'}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'attachments' && (
        loadingAttach ? <p className="woc-ts-empty">Loading…</p> :
        attachments.length === 0 ? <p className="woc-ts-empty">No attachments.</p> : (
          <div className="woc-file-section">
            {attachments.map(f => (
              <div key={f.id} className="woc-file-item">
                <span style={{ fontSize: 18 }}>{fileIcon(f.mimeType, f.fileName)}</span>
                <span className="woc-file-item-name">{f.fileName}</span>
                <span className="woc-file-item-size">{fmt(f.fileSize)}</span>
                <button type="button" className="woc-file-item-del"
                  onClick={() => { if (confirm('Remove?')) deleteAttach(f.id); }}>✕</button>
              </div>
            ))}
          </div>
        )
      )}
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WocPage() {
  const [modal, setModal]   = useState(null); // null | 'create' | { edit: row } | { view: row }
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', status: '', department: '' });
  const toast        = useToast();
  const queryClient  = useQueryClient();
  const canCreate    = usePermission('WO_COMPLETE', 'canCreate');
  const canWrite     = usePermission('WO_COMPLETE', 'canWrite');
  const canDelete    = usePermission('WO_COMPLETE', 'canDelete');

  const { data: completions = [], isLoading } = useQuery({
    queryKey: ['woc', filters],
    queryFn: () => api.get('/wo-complete', { params: filters }).then(r => r.data),
  });

  const { mutate: remove } = useMutation({
    mutationFn: id => api.delete(`/wo-complete/${id}`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['woc'] });
      queryClient.invalidateQueries({ queryKey: ['completed-wos'] });
      toast('Record deleted.', 'success');
    },
    onError: err => toast(err?.response?.data?.message ?? 'Delete failed.', 'error'),
  });

  const clientFiltered = completions.filter(r =>
    !search ||
    r.docNo?.toLowerCase().includes(search.toLowerCase()) ||
    r.workOrderNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.projectId?.toLowerCase().includes(search.toLowerCase()) ||
    r.projectName?.toLowerCase().includes(search.toLowerCase()) ||
    r.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    r.department?.toLowerCase().includes(search.toLowerCase()) ||
    r.enteredBy?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: '#',              label: '#',          num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'docNo',          label: 'WOC No.',    sort: true, render: r => <span className="wip-link">{r.docNo}</span> },
    { key: 'workOrderNumber',label: 'Work Order', sort: true },
    { key: 'projectId',      label: 'Project ID', sort: true },
    { key: 'projectName',    label: 'Project',    sort: true, render: r => r.customerName || r.projectName || '—' },
    { key: 'department',     label: 'Department', sort: true },
    { key: 'completedDate',  label: 'Date',       sort: true, render: r => formatDate(r.completedDate) },
    { key: 'status',         label: 'Status',     sort: true,
      render: row => <Badge variant={STATUS_VARIANT[row.status] ?? 'draft'}>{row.status ?? '—'}</Badge> },
    { key: 'enteredBy',      label: 'Entered By', sort: true },
    {
      key: 'actions', label: '', sort: false,
      render: row => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="wip-icon-btn wip-icon-btn-view" title="View" onClick={() => setModal({ view: row })}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          {canWrite && (
            <button className="wip-icon-btn wip-icon-btn-edit" title="Edit" onClick={() => setModal({ edit: row })}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          {canDelete && (
            <button className="wip-icon-btn wip-icon-btn-delete" title="Delete"
              onClick={() => { if (confirm(`Delete ${row.docNo}?`)) remove(row.id); }}>
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
        title="WO Complete"
        count={clientFiltered.length}
        search={search}
        onSearch={setSearch}
        actions={
          <>
            <FilterPanel filters={filters} setFilters={setFilters}
              onClear={() => setFilters({ dateFrom: '', dateTo: '', status: '', department: '' })} />
            {canCreate && <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>+ Complete WO</button>}
          </>
        }
      />
      <Table columns={columns} data={clientFiltered} loading={isLoading} />

      {(modal === 'create' || modal?.edit) && (
        <WocFormModal
          initial={modal?.edit ?? null}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}

      {modal?.view && (
        <WocViewModal record={modal.view} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
