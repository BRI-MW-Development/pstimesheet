import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import SearchSelect from '../../components/ui/SearchSelect';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Table, { WipListHeader } from '../../components/ui/Table';
import TimeInput from '../../components/ui/TimeInput';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';
import { formatDate } from '../../utils/format';

const STATUS_VARIANT = { Draft: 'draft', Submitted: 'submitted', Approved: 'approved', Rejected: 'rejected' };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isWithin24h(createdAt) {
  if (!createdAt) return false;
  return (Date.now() - new Date(createdAt).getTime()) < 24 * 60 * 60 * 1000;
}

function calcMins(start, end) {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  return String(Math.max(0, mins));
}

// ── Daily Form ─────────────────────────────────────────────────────────────────
function DailyForm({ editDocNo, readOnly, onBack, onSaved, onEdit }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const isAdmin = permissions.some((p) => p.module === 'USERS' && p.canWrite);
  const userEmployeeCode = user?.employeeCode ?? '';
  const entryPerson = user?.employeeCode ?? user?.username ?? '';

  const [form, setForm] = useState({
    employee: userEmployeeCode,
    date: new Date().toISOString().slice(0, 10),
    projectId: '',
    projectName: '',
    customer: '',
    taskType: '',
    startTime: '',
    endTime: '',
    duration: '',
    comments: '',
  });

  const { data: employees  = [] } = useQuery({ queryKey: ['employees'],  queryFn: () => api.get('/employees').then((r) => r.data) });
  const { data: projects   = [] } = useQuery({ queryKey: ['projects'],   queryFn: () => api.get('/projects').then((r) => r.data) });
  const { data: taskTypes  = [] } = useQuery({ queryKey: ['task-types'], queryFn: () => api.get('/task-types').then((r) => r.data) });

  const { data: existing } = useQuery({
    queryKey: ['timesheet', editDocNo],
    queryFn: () => api.get(`/timesheets/${editDocNo}`).then((r) => r.data),
    enabled: Boolean(editDocNo),
  });

  useEffect(() => {
    if (!existing) return;
    const proj = projects.find((p) => p.projectCode === (existing.projectId ?? existing.project_code));
    setForm((f) => ({
      ...f,
      employee: existing.labourLines?.[0]?.employeeCode ?? '',
      date: existing.entryDate?.slice(0, 10) ?? '',
      projectId: existing.projectId ?? existing.project_code ?? '',
      projectName: proj?.projectName ?? existing.projectName ?? '',
      customer: proj?.customerName ?? '',
      taskType: existing.shiftCode ?? '',
      startTime: existing.labourLines?.[0]?.startTime ?? '',
      endTime:   existing.labourLines?.[0]?.endTime   ?? '',
      comments: existing.remarks ?? '',
      duration: existing.labourLines?.[0]?.durationMinutes ? String(existing.labourLines[0].durationMinutes) : '',
    }));
  }, [existing, projects]);

  function onProjectChange(pid) {
    const proj = projects.find((p) => p.projectCode === pid);
    setForm((f) => ({ ...f, projectId: pid, projectName: proj?.projectName ?? '', customer: proj?.customerName ?? '' }));
  }

  function onTimeChange(field, val) {
    setForm((f) => {
      const updated = { ...f, [field]: val };
      return { ...updated, duration: calcMins(updated.startTime, updated.endTime) };
    });
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload) =>
      editDocNo
        ? api.put(`/timesheets/${editDocNo}`, payload).then((r) => r.data)
        : api.post('/timesheets', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['proj-timesheets'], type: 'active' });
      toast(editDocNo ? 'Timesheet updated.' : 'Timesheet saved.', 'success');
      onSaved();
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.projectId?.trim())  { toast('Project ID is required.',  'error'); return; }
    if (!form.taskType?.trim())   { toast('Task Type is required.',   'error'); return; }
    if (!form.employee?.trim() && !userEmployeeCode?.trim()) { toast('Employee is required.', 'error'); return; }
    save({
      tsType: 'PROJ',
      date: form.date,
      projectId: form.projectId,
      projectName: form.projectName,
      shift: form.taskType,
      entryPerson,
      remarks: form.comments,
      labourRows: [{
        employee: form.employee || userEmployeeCode,
        startTime: form.startTime || null,
        endTime:   form.endTime   || null,
        duration:  form.duration || '0',
      }],
    });
  }

  const empOptions  = employees.map((e) => ({ value: e.employeeNo, label: `${e.employeeNo} – ${[e.firstName, e.lastname].filter(Boolean).join(' ')}` }));
  const projOptions = projects.map((p) => ({ value: p.projectCode, label: `${p.projectCode} – ${p.projectName ?? ''}` }));
  const ttOptions   = taskTypes.map((t) => ({ value: t.taskTypeCode ?? t.name, label: t.taskTypeName ?? t.name }));

  const statusLabel = existing?.status;
  const canEdit = isWithin24h(existing?.createdAt);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header bar ── */}
      <div className="ts-modal-head" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div className="ts-modal-title">
              {readOnly ? `View ${editDocNo}` : editDocNo ? `Edit ${editDocNo}` : 'New Daily Timesheet'}
            </div>
            <div className="ts-modal-sub">
              {readOnly
                ? `${statusLabel ?? ''} — read-only`
                : editDocNo ? 'Edit timesheet details below' : 'Projects Team daily entry'}
            </div>
          </div>
          {editDocNo && <span className="ts-docno-pill">{editDocNo}</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
      </div>

      {/* ── Body ── */}
      <form
        id="pt-daily-form"
        onSubmit={handleSubmit}
        style={{ flex: 1, overflowY: 'auto', padding: '20px' }}
      >
        <div style={{ pointerEvents: readOnly ? 'none' : undefined }}>
        <div className="card">
          <div className="card-body">
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Entered By</label>
                <input className="form-control" value={entryPerson} readOnly />
              </div>

              <div className="form-group">
                <label className="form-label">Employee</label>
                {isAdmin ? (
                  <SearchSelect options={empOptions} value={form.employee}
                    onChange={(v) => setForm((f) => ({ ...f, employee: v }))} placeholder="Search employee…" />
                ) : (
                  <input className="form-control" value={form.employee || userEmployeeCode} readOnly
                    style={{ background: 'var(--bg2)', color: 'var(--text3)' }} />
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Project ID</label>
                <SearchSelect options={projOptions} value={form.projectId}
                  onChange={onProjectChange} placeholder="Type to search…" />
              </div>

              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input className="form-control" value={form.projectName} readOnly />
              </div>

              <div className="form-group">
                <label className="form-label">Customer</label>
                <input className="form-control" value={form.customer} readOnly />
              </div>

              <div className="form-group">
                <label className="form-label">Task Type</label>
                <select className="form-control" value={form.taskType}
                  onChange={(e) => setForm((f) => ({ ...f, taskType: e.target.value }))}>
                  <option value="">Select task type…</option>
                  {ttOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Start Time</label>
                <TimeInput value={form.startTime} onChange={(v) => onTimeChange('startTime', v)} />
              </div>

              <div className="form-group">
                <label className="form-label">End Time</label>
                <TimeInput value={form.endTime} onChange={(v) => onTimeChange('endTime', v)} />
              </div>

              <div className="form-group">
                <label className="form-label">Duration (mins)</label>
                <input className="form-control" value={form.duration} readOnly />
              </div>

              <div className="form-group">
                <label className="form-label">Comments</label>
                <input className="form-control" placeholder="—" value={form.comments}
                  onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>
        </div>{/* end pointer-events wrapper */}
      </form>

      {/* ── Footer ── */}
      <div className="ts-modal-footer">
        {readOnly ? (
          <>
            <button type="button" className="ts-footer-cancel" onClick={onBack}>← Back to List</button>
            {canEdit && onEdit && (
              <button type="button" className="ts-footer-save" onClick={onEdit}>Edit</button>
            )}
          </>
        ) : (
          <>
            <button type="button" className="ts-footer-cancel" onClick={onBack}>Cancel</button>
            <button type="submit" form="pt-daily-form" className="ts-footer-save" disabled={saving}>
              {saving ? 'Saving…' : 'Save Timesheet'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Weekly Form ────────────────────────────────────────────────────────────────
function WeeklyForm({ onBack, onSaved }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const entryPerson = user?.employeeCode ?? user?.username ?? '';

  const today = new Date();
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const defaultWeekStart = mon.toISOString().slice(0, 10);

  const [employee, setEmployee] = useState('');
  const [weekStart, setWeekStartState] = useState(defaultWeekStart);
  const [weekEnd, setWeekEnd] = useState('');
  const [rows, setRows] = useState([{ projectId: '', taskType: '', days: Array(7).fill({ s: '', e: '' }), comment: '' }]);

  const { data: employees = [] } = useQuery({ queryKey: ['employees'],  queryFn: () => api.get('/employees').then((r) => r.data) });
  const { data: projects  = [] } = useQuery({ queryKey: ['projects'],   queryFn: () => api.get('/projects').then((r) => r.data) });
  const { data: taskTypes = [] } = useQuery({ queryKey: ['task-types'], queryFn: () => api.get('/task-types').then((r) => r.data) });

  function onWeekStartChange(val) {
    setWeekStartState(val);
    if (val) {
      const end = new Date(val);
      end.setDate(end.getDate() + 6);
      setWeekEnd(end.toISOString().slice(0, 10));
    } else {
      setWeekEnd('');
    }
  }

  useEffect(() => { onWeekStartChange(defaultWeekStart); }, []);

  function weekDates() {
    if (!weekStart) return Array(7).fill('');
    return DAYS.map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }

  function setRow(idx, field, val) {
    setRows((rs) => rs.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }

  function setDay(rowIdx, dayIdx, field, val) {
    setRows((rs) => rs.map((r, i) => {
      if (i !== rowIdx) return r;
      const days = r.days.map((d, j) => j === dayIdx ? { ...d, [field]: val } : d);
      return { ...r, days };
    }));
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload) => api.post('/timesheets/weekly', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proj-timesheets'] });
      toast('Weekly timesheet saved.', 'success');
      onSaved();
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const dates = weekDates();
  const empOptions  = employees.map((e) => ({ value: e.employeeNo, label: `${e.employeeNo} – ${[e.firstName, e.lastname].filter(Boolean).join(' ')}` }));
  const projOptions = projects.map((p) => ({ value: p.projectCode, label: `${p.projectCode} – ${p.projectName ?? ''}` }));
  const ttOptions   = taskTypes.map((t) => ({ value: t.taskTypeCode ?? t.name, label: t.taskTypeName ?? t.name }));

  function handleSubmit(e) {
    e.preventDefault();
    save({ employee, weekStart, rows: rows.map((r) => ({ ...r, dates })) });
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-title">Weekly Timesheet Entry</div>
          <div className="page-sub">Each filled day is saved as an individual daily timesheet</div>
        </div>
        <div className="btn-row">
          <button className="btn btn-outline btn-sm" onClick={onBack}>← Back</button>
          <button className="btn btn-primary btn-sm" form="pt-weekly-form" type="submit" disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Weekly Entry'}
          </button>
        </div>
      </div>

      <form id="pt-weekly-form" onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-head"><div className="card-title">Header</div></div>
          <div className="card-body">
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Entered By</label>
                <input className="form-control" value={entryPerson} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Employee</label>
                <SearchSelect options={empOptions} value={employee} onChange={setEmployee} placeholder="Search employee…" />
              </div>
              <div className="form-group">
                <label className="form-label">Week Start (Mon)</label>
                <input type="date" className="form-control" value={weekStart}
                  onChange={(e) => onWeekStartChange(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Week End (Sun)</label>
                <input className="form-control" value={weekEnd} readOnly />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Daily Entries</div></div>
          <div className="card-body">
            <div style={{ overflowX: 'auto' }}>
              <table className="line-table" style={{ minWidth: 1400 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 140 }}>Project</th>
                    <th style={{ minWidth: 130 }}>Task Type</th>
                    {DAYS.map((day, i) => (
                      <th key={day} style={{ minWidth: 130 }}>
                        {day}
                        {dates[i] && <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text3)' }}>
                          {new Date(dates[i]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </div>}
                      </th>
                    ))}
                    <th style={{ minWidth: 140 }}>Comment</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri}>
                      <td>
                        <SearchSelect options={projOptions} value={row.projectId}
                          onChange={(v) => setRow(ri, 'projectId', v)} placeholder="Project…" />
                      </td>
                      <td>
                        <select className="line-input" value={row.taskType}
                          onChange={(e) => setRow(ri, 'taskType', e.target.value)}>
                          <option value="">Task type…</option>
                          {ttOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </td>
                      {DAYS.map((_, di) => (
                        <td key={di}>
                          <TimeInput value={row.days[di].s} onChange={(v) => setDay(ri, di, 's', v)}
                            className="line-input" />
                          <TimeInput value={row.days[di].e} onChange={(v) => setDay(ri, di, 'e', v)}
                            className="line-input" style={{ marginTop: 2 }} />
                        </td>
                      ))}
                      <td>
                        <input className="line-input" placeholder="Comment…" value={row.comment}
                          onChange={(e) => setRow(ri, 'comment', e.target.value)} />
                      </td>
                      <td>
                        {rows.length > 1 && (
                          <button type="button" className="del-row-btn"
                            onClick={() => setRows((rs) => rs.filter((_, j) => j !== ri))} title="Remove">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
              onClick={() => setRows((rs) => [...rs, { projectId: '', taskType: '', days: Array(7).fill({ s: '', e: '' }), comment: '' }])}>
              + Add Row
            </button>
            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
              Enter start and end times per day (e.g. <strong>8:30 AM</strong> / <strong>5:00 PM</strong>). Leave blank to skip that day.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Entry Type Modal ───────────────────────────────────────────────────────────
function EntryTypeModal({ onClose, onSelect }) {
  const [type, setType] = useState('daily');
  return (
    <Modal title="New Project Timesheet" onClose={onClose}>
      <div className="form-group">
        <label className="form-label">Entry Type</label>
        <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="daily">Daily Entry</option>
          <option value="weekly">Weekly Entry</option>
        </select>
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSelect(type)}>Continue</button>
      </div>
    </Modal>
  );
}

// ── Filter Panel ───────────────────────────────────────────────────────────────
function FilterPanel({ filters, setFilters, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="wip-filter-wrap" ref={ref}>
      <button
        className={`wip-filter-btn${activeCount ? ' wip-filter-btn-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Filters"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        {activeCount > 0 && <span className="wip-filter-badge" style={{ display: 'inline-flex' }}>{activeCount}</span>}
      </button>
      {open && (
        <div className="wip-filter-panel">
          <div className="wip-filter-title">Filters</div>
          <div className="wip-filter-row">
            <label className="wip-filter-label">Date From</label>
            <input type="date" className="wip-filter-input" value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div className="wip-filter-row">
            <label className="wip-filter-label">Date To</label>
            <input type="date" className="wip-filter-input" value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
          </div>
          <div className="wip-filter-row">
            <label className="wip-filter-label">Status</label>
            <select className="wip-filter-input" value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All Status</option>
              <option>Draft</option>
              <option>Submitted</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { onClear(); setOpen(false); }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── List Page ──────────────────────────────────────────────────────────────────
export default function ProjTimesheetPage() {
  const toast        = useToast();
  const queryClient  = useQueryClient();
  const canCreate    = usePermission('PROJ', 'canCreate');
  const canWrite     = usePermission('PROJ', 'canWrite');
  const canDelete    = usePermission('PROJ', 'canDelete');
  const [view, setView] = useState('list'); // 'list' | 'daily' | 'weekly'
  const [editDocNo, setEditDocNo] = useState(null);
  const [isReadonly, setIsReadonly] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', status: '' });

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['proj-timesheets', filters],
    queryFn: () => api.get('/timesheets', { params: { type: 'PROJ', ...filters } }).then((r) => r.data),
  });

  const { mutate: deleteTs } = useMutation({
    mutationFn: (docNo) => api.delete(`/timesheets/${docNo}`).then((r) => r.data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ['proj-timesheets'], type: 'active' }); toast('Timesheet deleted.', 'success'); },
    onError: (err) => toast(err?.response?.data?.message ?? 'Delete failed.', 'error'),
  });

  const { mutate: submitTs } = useMutation({
    mutationFn: (docNo) => api.post(`/timesheets/${docNo}/submit`).then((r) => r.data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ['proj-timesheets'], type: 'active' }); toast('Submitted for approval.', 'success'); },
    onError: (err) => toast(err?.response?.data?.message ?? 'Submit failed.', 'error'),
  });

  const filtered = timesheets.filter((r) =>
    !search ||
    r.docNo?.toLowerCase().includes(search.toLowerCase()) ||
    r.entered_by_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.projectId?.toLowerCase().includes(search.toLowerCase()) ||
    r.projectName?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: '#',              label: '#',            num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'docNo',          label: 'Document No',  sort: true, render: (r) => <span className="wip-link">{r.docNo}</span> },
    { key: 'entryDate',      label: 'Date',         sort: true, render: (r) => formatDate(r.entryDate) },
    { key: 'entered_by_name',label: 'Employee',     sort: true },
    { key: 'projectId',      label: 'Project ID',   sort: true },
    { key: 'projectName',    label: 'Project Name', sort: true },
    { key: 'shiftCode',      label: 'Task Type',    sort: true },
    { key: 'totalHours',     label: 'Duration',     sort: true, render: (r) => r.totalHours ? `${r.totalHours.toFixed(2)}h` : '—' },
    {
      key: 'actions', label: '', sort: false,
      render: (row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="wip-icon-btn wip-icon-btn-view" title="View"
            onClick={() => { setEditDocNo(row.docNo); setIsReadonly(true); setView('daily'); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          {canWrite && isWithin24h(row.createdAt) && (
            <button className="wip-icon-btn wip-icon-btn-edit" title="Edit"
              onClick={() => { setEditDocNo(row.docNo); setIsReadonly(false); setView('daily'); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          {canDelete && isWithin24h(row.createdAt) && (
            <button className="wip-icon-btn wip-icon-btn-delete" title="Delete"
              onClick={() => { if (confirm('Delete this timesheet?')) deleteTs(row.docNo); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  if (view === 'daily') {
    const goBack = () => { setView('list'); setEditDocNo(null); setIsReadonly(false); };
    return <DailyForm editDocNo={editDocNo} readOnly={isReadonly} onBack={goBack} onSaved={goBack} onEdit={() => setIsReadonly(false)} />;
  }
  if (view === 'weekly') {
    return <WeeklyForm onBack={() => setView('list')} onSaved={() => setView('list')} />;
  }

  return (
    <div className="page-content">
      <WipListHeader
        title="Projects Team Timesheets"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
        actions={
          <>
            <FilterPanel
              filters={filters}
              setFilters={setFilters}
              onClear={() => setFilters({ dateFrom: '', dateTo: '', status: '' })}
            />
            {canCreate && <button className="btn btn-primary btn-sm" onClick={() => setShowTypeModal(true)}>+ New</button>}
          </>
        }
      />
      <Table columns={columns} data={filtered} loading={isLoading} />

      {showTypeModal && (
        <EntryTypeModal
          onClose={() => setShowTypeModal(false)}
          onSelect={(type) => {
            setShowTypeModal(false);
            setEditDocNo(null);
            setView(type);
          }}
        />
      )}

    </div>
  );
}
