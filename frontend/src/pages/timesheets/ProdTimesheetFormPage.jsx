import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import SearchSelect from '../../components/ui/SearchSelect';
import TimeInput from '../../components/ui/TimeInput';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../store/authStore';

const EMPTY_LABOUR   = { employee: '', employeeName: '', startTime: '', endTime: '', durationMinutes: 0 };
const EMPTY_MATERIAL = { itemCode: '', description: '', uom: '', qty: '' };
const EMPTY_MACH     = { machineName: '', minutes: '' };

function calcDuration(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  return Math.max(0, mins);
}

function minsToHm(mins) {
  if (!mins) return '0h 0m';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const QUICK_REASONS = ['Incorrect work order','Missing labour details','Duplicate entry','Wrong date / shift','Incomplete information'];

export default function ProdTimesheetFormPage() {
  const { id: docNo } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(docNo);
  const isView = useLocation().pathname.endsWith('/view');
  const fromApprovals = searchParams.get('from') === 'approvals';
  const isApprover = fromApprovals || permissions.some((p) => p.module === 'PROD' && p.canWrite && p.canReport);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [mobTab, setMobTab] = useState('details');
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [header, setHeader] = useState({
    projectId: '',
    projectName: '',
    workOrder: '',
    department: '',
    date: new Date().toISOString().slice(0, 10),
    shift: '',
    entryPerson: user?.displayName ?? user?.username ?? '',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [wocWarning, setWocWarning] = useState('');
  const [labourRows, setLabourRows]   = useState([{ ...EMPTY_LABOUR }]);
  const [materialRows, setMaterialRows] = useState([]);
  const [machRows, setMachRows]       = useState([]);

  const STALE_5M = 5 * 60 * 1000;
  const { data: employees = [] }   = useQuery({ queryKey: ['employees', 'prod-inst'], queryFn: () => api.get('/employees', { params: { deptFilter: 'prod-inst' } }).then((r) => r.data), staleTime: STALE_5M });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments').then((r) => r.data), staleTime: STALE_5M });
  const { data: projects = [] }    = useQuery({ queryKey: ['projects'],    queryFn: () => api.get('/projects').then((r) => r.data), staleTime: STALE_5M });
  const { data: workOrders = [] }  = useQuery({ queryKey: ['work-orders', 'prod'], queryFn: () => api.get('/work-orders', { params: { subsidiaryIds: '1,3', statuses: 'In Process,Released' } }).then((r) => r.data), staleTime: STALE_5M });
  const { data: items = [] }       = useQuery({ queryKey: ['items'],       queryFn: () => api.get('/items').then((r) => r.data), staleTime: STALE_5M });
  const { data: machinery = [] }   = useQuery({ queryKey: ['machinery'],   queryFn: () => api.get('/machinery').then((r) => r.data), staleTime: STALE_5M });
  const { data: shifts = [] }      = useQuery({ queryKey: ['shifts'],      queryFn: () => api.get('/system-settings/shifts').then((r) => r.data), staleTime: STALE_5M });
  const { data: completedWos = [] } = useQuery({ queryKey: ['completed-wos'], queryFn: () => api.get('/wo-complete').then((r) => r.data.map((w) => w.workOrderNumber)), staleTime: STALE_5M });

  const { data: existing } = useQuery({
    queryKey: ['timesheet', docNo],
    queryFn: () => api.get(`/timesheets/${docNo}`).then((r) => r.data),
    enabled: isEdit,
    staleTime: Infinity,      // prevent background refetch from overwriting in-progress edits
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!existing) return;
    setHeader({
      projectId:   existing.projectId   ?? '',
      projectName: existing.projectName ?? '',
      workOrder:   existing.workOrderNo ?? '',
      department:  existing.department_code ?? '',
      date:        existing.entryDate?.slice(0, 10) ?? '',
      shift:       existing.shiftCode ?? '',
      entryPerson: existing.entered_by ?? existing.entered_by_name ?? '',
    });
    setLabourRows(existing.labourLines?.length
      ? existing.labourLines.map((l) => ({ employee: l.employeeCode ?? '', employeeName: l.employeeName ?? '', startTime: l.startTime ?? '', endTime: l.endTime ?? '', durationMinutes: l.durationMinutes ?? 0 }))
      : [{ ...EMPTY_LABOUR }]);
    setMaterialRows(existing.materialLines?.map((m) => ({ itemCode: m.itemCode ?? '', description: m.itemName ?? m.itemDescription ?? m.description ?? '', qty: m.qty ?? '', uom: m.uom ?? '' })) ?? []);
    setMachRows(existing.equipmentLines?.map((e) => ({ machineName: e.equipmentName ?? e.machineName ?? '', minutes: e.hoursUsed ?? e.durationMinutes ?? e.minutes ?? '' })) ?? []);
    setIsDirty(false);
  }, [existing]);

  // Filter work orders: production department only, matching project, exclude completed
  const completedSet = new Set(completedWos ?? []);
  const filteredWOs = workOrders.filter((w) => {
    const woNo      = (w.workOrderNumber ?? '').trim();
    const dept      = (w.departmentName       ?? '').toLowerCase();
    const parentDept= (w.parentDepartmentName ?? '').toLowerCase();
    const isProd    = dept === 'production' || parentDept === 'production';
    if (!isProd) return false;
    if (completedSet.has(woNo)) return false;
    if (header.projectId) return w.projectCode === header.projectId;
    return true;
  });

  // #27 — warn on browser close/refresh when dirty
  useEffect(() => {
    if (!isDirty) return;
    const fn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [isDirty]);

  // #27 — guard Cancel/Back navigation when dirty
  function confirmLeave(destination) {
    if (!isDirty || window.confirm('You have unsaved changes. Leave without saving?')) {
      navigate(destination);
    }
  }

  // WOC check when work order changes
  useEffect(() => {
    if (header.workOrder && completedSet.has(header.workOrder.trim())) {
      setWocWarning(`⚠ Work Order ${header.workOrder} has already been marked as Complete. You cannot save a timesheet against it.`);
    } else {
      setWocWarning('');
    }
  }, [header.workOrder, completedWos]);

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload) =>
      isEdit
        ? api.put(`/timesheets/${docNo}`, payload).then((r) => r.data)
        : api.post('/timesheets', payload).then((r) => r.data),
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['prod-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['timesheet', docNo] });
      toast(isEdit ? 'Timesheet updated.' : 'Timesheet saved.', 'success');
      navigate(fromApprovals ? '/timesheets/pending-approvals' : '/timesheets/prod');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: () => api.post(`/timesheets/${docNo}/approve`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['prod-timesheets'] });
      toast('Timesheet approved.', 'success');
      navigate('/timesheets/pending-approvals');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Approve failed.', 'error'),
  });

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: (reason) => api.post(`/timesheets/${docNo}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['prod-timesheets'] });
      toast('Timesheet rejected.', 'success');
      navigate('/timesheets/pending-approvals');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Reject failed.', 'error'),
  });

  function setHdr(field, val) { setIsDirty(true); setHeader((h) => ({ ...h, [field]: val })); }

  function setLabour(idx, field, val) {
    setLabourRows((rows) => rows.map((r, i) => {
      if (i !== idx) return r;
      const u = { ...r, [field]: val };
      if (field === 'startTime' || field === 'endTime')
        u.durationMinutes = calcDuration(field === 'startTime' ? val : r.startTime, field === 'endTime' ? val : r.endTime);
      return u;
    }));
  }

  function submit(e) {
    e.preventDefault();
    if (wocWarning) { toast('Cannot save: work order is already complete.', 'error'); return; }
    if (!header.projectId?.trim())  { toast('Project ID is required.',  'error'); return; }
    if (!header.workOrder?.trim())  { toast('Work Order is required.',  'error'); return; }
    if (!header.department?.trim()) { toast('Department is required.',  'error'); return; }
    if (!header.shift?.trim())      { toast('Shift is required.',       'error'); return; }

    // #15 — date validation (no future dates, must be set)
    if (!header.date) { toast('Date is required.', 'error'); return; }
    const today = new Date().toISOString().slice(0, 10);
    if (header.date > today) { toast('Date cannot be in the future.', 'error'); return; }

    // #10 — at least one filled labour row
    const filledLabour = labourRows.filter((r) => r.employee);
    if (filledLabour.length === 0) { toast('At least one employee entry is required.', 'error'); return; }

    // #12 — duplicate employee + time combination
    const seen = new Set();
    for (const r of filledLabour) {
      const key = `${r.employee}|${r.startTime}|${r.endTime}`;
      if (seen.has(key)) { toast(`Duplicate entry: ${r.employee} with the same time already added.`, 'error'); return; }
      seen.add(key);
    }

    // same start & end time = zero duration
    for (const r of filledLabour) {
      if (r.startTime && r.endTime && r.startTime === r.endTime) {
        toast(`Start time and end time cannot be the same for employee ${r.employee || r.employeeName}.`, 'error'); return;
      }
    }

    // #13 — overlapping times for the same employee
    const byEmp = {};
    for (const r of filledLabour) {
      if (!r.startTime || !r.endTime) continue;
      (byEmp[r.employee] = byEmp[r.employee] || []).push({ s: r.startTime, e: r.endTime });
    }
    for (const [emp, slots] of Object.entries(byEmp)) {
      slots.sort((a, b) => a.s.localeCompare(b.s));
      for (let i = 1; i < slots.length; i++) {
        if (slots[i].s < slots[i - 1].e) {
          toast(`Overlapping time entries for employee ${emp}.`, 'error'); return;
        }
      }
    }

    // TS-001 — start time and end time required for each filled labour row
    for (const r of filledLabour) {
      if (!r.startTime) { toast(`Start time is required for employee ${r.employee}.`, 'error'); return; }
      if (!r.endTime)   { toast(`End time is required for employee ${r.employee}.`, 'error'); return; }
    }

    // material qty required
    const filledMaterial = materialRows.filter((r) => r.itemCode);
    for (const r of filledMaterial) {
      if (!r.qty || Number(r.qty) <= 0) {
        toast(`Qty is required for material item ${r.itemCode}.`, 'error'); return;
      }
    }

    // TS-002 — minutes required for each filled machinery row
    const filledMach = machRows.filter((r) => r.machineName);
    for (const r of filledMach) {
      if (!r.minutes || Number(r.minutes) <= 0) {
        toast(`Minutes is required for machine ${r.machineName}.`, 'error'); return;
      }
    }

    // shift time window validation
    const selectedShift = shifts.find((s) => s.shiftCode === header.shift);
    for (const r of filledLabour) {
      if (!r.startTime || !r.endTime) continue;
      const isOvernightEntry = r.endTime < r.startTime;
      if (isOvernightEntry && !selectedShift?.allowOvernight) {
        toast(`Overnight entries (end before start) require Open Shift. Select Open Shift or correct the times for employee ${r.employee || r.employeeName}.`, 'error'); return;
      }
    }
    if (selectedShift?.startTime && selectedShift?.endTime && !selectedShift?.allowOvernight) {
      const sStart = selectedShift.startTime;
      const sEnd   = selectedShift.endTime;
      const shiftOvernight = sEnd < sStart;
      const inWindow = (t) => shiftOvernight ? (t >= sStart || t <= sEnd) : (t >= sStart && t <= sEnd);
      for (const r of filledLabour) {
        if (!r.startTime || !r.endTime) continue;
        if (!inWindow(r.startTime) || !inWindow(r.endTime)) {
          toast(`Employee ${r.employee || r.employeeName} times (${r.startTime}–${r.endTime}) are outside the ${selectedShift.shiftName} shift window (${sStart}–${sEnd}).`, 'error'); return;
        }
      }
    }

    save({
      tsType: 'PROD',
      projectId:   header.projectId,
      projectName: header.projectName,
      workOrder:   header.workOrder,
      department:  header.department,
      date:        header.date,
      shift:       header.shift,
      entryPerson: header.entryPerson,
      labourRows:   labourRows.filter((r) => r.employee),
      materialRows: materialRows.filter((r) => r.itemCode),
      machineryRows: machRows.filter((r) => r.machineName),
    });
  }

  const projOptions  = useMemo(() => projects.map((p) => { const code = p.projectCode ?? p.projectId; return { value: code, label: code, search: `${code} ${p.projectName ?? ''}` }; }), [projects]);
  const woOptions    = useMemo(() => filteredWOs.map((w) => ({ value: w.workOrderNumber, label: w.workOrderNumber, search: `${w.workOrderNumber} ${w.projectName ?? ''}` })), [filteredWOs]);
  const deptOptions  = useMemo(() => departments
    .filter((d) => {
      if (d.isActive === false || d.isActive === 0) return false;
      const md = (d.mainDepartment ?? '').toLowerCase();
      const dc = (d.departmentCode ?? '').toLowerCase();
      return md.includes('produc') || dc.includes('produc');
    })
    .map((d) => ({ value: d.departmentCode ?? String(d.departmentId), label: d.departmentCode ?? String(d.departmentId) })), [departments]);
  const shiftOptions = useMemo(() => shifts
    .filter((s) => s.status === 'Active')
    .map((s) => ({ value: s.shiftCode, label: s.shiftName })), [shifts]);
  const prodInstDepts = ['production', 'installation'];
  const empOptions   = useMemo(() => employees
    .filter((e) => prodInstDepts.includes((e.departmentCode ?? '').toLowerCase()))
    .map((e) => ({ value: e.employeeNo, label: `${e.employeeNo} – ${[e.firstName, e.lastname].filter(Boolean).join(' ')}` })), [employees]);
  const itemOptions  = useMemo(() => items.map((i, idx) => ({
    value:        i.itemcode ?? `~${idx}`,
    label:        `${i.itemcode ? i.itemcode + ' – ' : ''}${i.itemName ?? i.description ?? i.itemcode ?? ''}`,
    triggerLabel: i.itemcode ?? i.itemName ?? '',
  })), [items]);
  const machOptions  = useMemo(() => machinery.map((m) => ({ value: m.machineName, label: m.machineName })), [machinery]);

  const totalLabour = labourRows.reduce((s, r) => s + (r.durationMinutes || 0), 0);
  const tsStatus = existing?.status ?? null;
  const isReadonly = isView || tsStatus === 'Approved' || tsStatus === 'Rejected' || (tsStatus === 'Submitted' && !isApprover);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* ── Header bar ── */}
      <div className="ts-modal-head" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div className="ts-modal-title">{isReadonly && isEdit ? `View ${docNo}` : isEdit ? `Edit ${docNo}` : 'New Production Timesheet'}</div>
            <div className="ts-modal-sub">{isReadonly ? (tsStatus === 'Approved' ? 'Approved — read-only' : tsStatus === 'Rejected' ? 'Rejected — read-only' : tsStatus === 'Submitted' ? 'Submitted — read-only' : 'Read-only view') : 'Fill in the details below and save'}</div>
          </div>
          {isEdit && <span className="ts-docno-pill">{docNo}</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => confirmLeave(fromApprovals ? '/timesheets/pending-approvals' : '/timesheets/prod')}>← Back</button>
      </div>

      {isMobile && (
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
          {[{ key: 'details', label: 'Details' }, { key: 'entries', label: 'Entries' }].map(({ key, label }) => (
            <button key={key} type="button" onClick={() => setMobTab(key)}
              style={{ flex: 1, padding: '11px 8px', fontSize: 13, fontWeight: 600, background: 'transparent', border: 'none',
                borderBottom: `3px solid ${mobTab === key ? 'var(--accent)' : 'transparent'}`,
                color: mobTab === key ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer', marginBottom: -2 }}>
              {label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} onChange={() => !isDirty && setIsDirty(true)} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="ts-modal-body" style={{ flex: 1, overflow: 'hidden', flexDirection: isMobile ? 'column' : undefined }}>

          {/* ── Left panel: header fields ── */}
          <div className="ts-form-panel" style={{ pointerEvents: isReadonly ? 'none' : undefined, display: isMobile && mobTab === 'entries' ? 'none' : undefined }}>
            <div className="ts-field-group">
              <label className="ts-field-label">Project ID <span style={{ color: 'var(--red)' }}>*</span></label>
              <SearchSelect
                options={projOptions}
                value={header.projectId}
                onChange={(v) => {
                  setIsDirty(true);
                  const proj = projects.find((p) => (p.projectCode ?? p.projectId) === v);
                  const rawName = proj?.projectName ?? '';
                  const projectName = rawName.includes(':') ? rawName.split(':').slice(1).join(':').trim() : rawName;
                  setHeader((h) => ({ ...h, projectId: v, projectName, workOrder: '' }));
                }}
                placeholder="Type to search…"
              />
            </div>
            <div className="ts-field-group">
              <label className="ts-field-label">Project Name</label>
              <input className="form-control ts-input ts-readonly" readOnly value={header.projectName} placeholder="Auto-filled" />
            </div>
            <div className="ts-field-group">
              <label className="ts-field-label">Work Order <span style={{ color: 'var(--red)' }}>*</span></label>
              <SearchSelect options={woOptions} value={header.workOrder}
                onChange={(v) => setHdr('workOrder', v)} placeholder="Select work order…" />
            </div>
            <div className="ts-field-group">
              <label className="ts-field-label">Department <span style={{ color: 'var(--red)' }}>*</span></label>
              <SearchSelect options={deptOptions} value={header.department}
                onChange={(v) => setHdr('department', v)} placeholder="Select department…" />
            </div>
            <div className="ts-field-group">
              <label className="ts-field-label">Date</label>
              <input type="date" className="form-control ts-input" value={header.date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setHdr('date', e.target.value)} />
            </div>
            <div className="ts-field-group">
              <label className="ts-field-label">Shift <span style={{ color: 'var(--red)' }}>*</span></label>
              <SearchSelect options={shiftOptions} value={header.shift}
                onChange={(v) => setHdr('shift', v)} placeholder="Select shift…" />
            </div>
            <div className="ts-field-group">
              <label className="ts-field-label">Entry Person</label>
              <input className="form-control ts-input ts-readonly" readOnly value={header.entryPerson} />
            </div>

            <div className="ts-divider" />
            <div className="ts-summary">
              <div className="ts-summary-row"><span>Labour rows</span><span>{labourRows.filter((r) => r.employee).length}</span></div>
              <div className="ts-summary-row"><span>Material rows</span><span>{materialRows.filter((r) => r.itemCode).length}</span></div>
              <div className="ts-summary-row"><span>Machinery rows</span><span>{machRows.filter((r) => r.machineName).length}</span></div>
              <div className="ts-summary-row"><span>Total Labour</span><span>{minsToHm(totalLabour)}</span></div>
            </div>
          </div>

          {/* ── Right panel: lines ── */}
          <div className="ts-lines-panel" style={{ display: isMobile && mobTab === 'details' ? 'none' : undefined }}>
            <div className="ts-scroll-panel">
              <div style={{ display: 'contents', pointerEvents: isReadonly ? 'none' : undefined }}>

              {/* Labour */}
              <div className="ts-section">
                <div className="ts-section-head">
                  Labour Time
                  <span className="ts-section-badge">{labourRows.filter((r) => r.employee).length || undefined}</span>
                </div>
                <table className="ts-line-table">
                  <thead><tr>
                    <th>Employee</th>
                    <th style={{ width: 108 }}>Start Time</th>
                    <th style={{ width: 108 }}>End Time</th>
                    <th style={{ width: 108 }}>Duration (min)</th>
                    <th style={{ width: 34 }}></th>
                  </tr></thead>
                  <tbody>
                    {labourRows.map((row, i) => {
                      const selectedShiftForRow = shifts.find((s) => s.shiftCode === header.shift);
                      const isOvernightRow = row.startTime && row.endTime && row.endTime < row.startTime;
                      const showMidnightBadge = isOvernightRow && selectedShiftForRow?.allowOvernight;
                      return (
                      <tr key={i}>
                        <td>
                          <SearchSelect options={empOptions} value={row.employee}
                            onChange={(v) => {
                              setIsDirty(true);
                              const emp = employees.find((e) => e.employeeNo === v);
                              setLabourRows((p) => p.map((r, j) => j === i ? { ...r, employee: v, employeeName: [emp?.firstName, emp?.lastname].filter(Boolean).join(' ') } : r));
                            }} placeholder="Employee…" />
                        </td>
                        <td><TimeInput value={row.startTime} onChange={(v) => setLabour(i, 'startTime', v)} /></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <TimeInput value={row.endTime} onChange={(v) => setLabour(i, 'endTime', v)} />
                            {showMidnightBadge && (
                              <span title="This entry spans midnight to the next day" style={{ fontSize: 10, color: '#7c5ab8', background: 'rgba(124,90,184,0.12)', border: '1px solid rgba(124,90,184,0.3)', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                🌙 +1 day
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text2)' }}>{row.durationMinutes || ''}</td>
                        <td>
                          {labourRows.length > 1 && (
                            <button type="button" className="btn-icon" onClick={() => setLabourRows((p) => p.filter((_, j) => j !== i))}>✕</button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="ts-section-footer">
                  <button type="button" className="ts-add-btn" onClick={() => setLabourRows((p) => [...p, { ...EMPTY_LABOUR }])}>
                    + Add Employee
                  </button>
                </div>
              </div>

              {/* Material */}
              <div className="ts-section">
                <div className="ts-section-head">
                  Consumed Material
                  <span className="ts-section-badge">{materialRows.filter((r) => r.itemCode).length || undefined}</span>
                </div>
                <table className="ts-line-table">
                  <thead><tr>
                    <th style={{ width: 160 }}>Item Code</th>
                    <th>Description</th>
                    <th style={{ width: 72 }}>UOM</th>
                    <th style={{ width: 100 }}>Qty</th>
                    <th style={{ width: 34 }}></th>
                  </tr></thead>
                  <tbody>
                    {materialRows.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <SearchSelect options={itemOptions} value={row.itemCode}
                            onChange={(v) => {
                              setIsDirty(true);
                              const it = String(v).startsWith('~') ? items[parseInt(v.slice(1))] : items.find((x) => x.itemcode === v);
                              setMaterialRows((p) => p.map((r, j) => j === i ? { ...r, itemCode: it?.itemcode ?? v, description: it?.description ?? it?.itemName ?? '', uom: it?.UOM ?? '' } : r));
                            }} placeholder="Item…" />
                        </td>
                        <td><input type="text" value={row.description} onChange={(e) => setMaterialRows((p) => p.map((r, j) => j === i ? { ...r, description: e.target.value } : r))} /></td>
                        <td><input type="text" value={row.uom} onChange={(e) => setMaterialRows((p) => p.map((r, j) => j === i ? { ...r, uom: e.target.value } : r))} /></td>
                        <td><input type="number" min="0" step="0.01" value={row.qty} onChange={(e) => setMaterialRows((p) => p.map((r, j) => j === i ? { ...r, qty: e.target.value } : r))} /></td>
                        <td><button type="button" className="btn-icon" onClick={() => setMaterialRows((p) => p.filter((_, j) => j !== i))}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="ts-section-footer">
                  <button type="button" className="ts-add-btn" onClick={() => setMaterialRows((p) => [...p, { ...EMPTY_MATERIAL }])}>
                    + Add Material
                  </button>
                </div>
              </div>

              {/* Machinery */}
              <div className="ts-section">
                <div className="ts-section-head">
                  Machinery
                  <span className="ts-section-badge">{machRows.filter((r) => r.machineName).length || undefined}</span>
                </div>
                <table className="ts-line-table">
                  <thead><tr>
                    <th>Machine</th>
                    <th style={{ width: 120 }}>Minutes</th>
                    <th style={{ width: 34 }}></th>
                  </tr></thead>
                  <tbody>
                    {machRows.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <SearchSelect options={machOptions} value={row.machineName}
                            onChange={(v) => { setIsDirty(true); setMachRows((p) => p.map((r, j) => j === i ? { ...r, machineName: v } : r)); }}
                            placeholder="Machine…" />
                        </td>
                        <td><input type="number" min="0" value={row.minutes} onChange={(e) => setMachRows((p) => p.map((r, j) => j === i ? { ...r, minutes: e.target.value } : r))} /></td>
                        <td><button type="button" className="btn-icon" onClick={() => setMachRows((p) => p.filter((_, j) => j !== i))}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="ts-section-footer">
                  <button type="button" className="ts-add-btn" onClick={() => setMachRows((p) => [...p, { ...EMPTY_MACH }])}>
                    + Add Machinery
                  </button>
                </div>
              </div>

              </div>{/* end pointer-events wrapper */}
            </div>
          </div>
        </div>

        {/* WOC warning block */}
        {wocWarning && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', margin: '0 20px', fontSize: 13, color: '#b91c1c', fontWeight: 500, lineHeight: 1.4 }}>
            {wocWarning}
          </div>
        )}

        {/* Footer */}
        <div className="ts-modal-footer">
          {isReadonly ? (
            <>
              <button type="button" className="ts-footer-cancel" onClick={() => navigate(fromApprovals ? '/timesheets/pending-approvals' : '/timesheets/prod')}>← Back</button>
              {fromApprovals && (
                <>
                  <button type="button" className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={() => navigate(`/timesheets/prod/${docNo}/edit?from=approvals`)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                  <button type="button" disabled={approving || rejecting}
                    onClick={() => { setRejectReason(''); setShowReject(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff1f1', color: '#dc2626', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    Reject
                  </button>
                  <button type="button" disabled={approving || rejecting}
                    onClick={() => approve()}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: approving ? 0.6 : 1 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {approving ? 'Approving…' : 'Approve'}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button type="button" className="ts-footer-cancel" onClick={() => confirmLeave('/timesheets/prod')}>Cancel</button>
              <button type="submit" className="ts-footer-save" disabled={saving || Boolean(wocWarning)}>
                {saving ? 'Saving…' : 'Save Timesheet'}
              </button>
            </>
          )}
        </div>
      </form>

      {/* Inline reject modal */}
      {showReject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: 420, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Reject Timesheet</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{docNo}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Quick reasons</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {QUICK_REASONS.map((r) => (
                <button key={r} type="button"
                  onClick={() => setRejectReason(rejectReason === r ? '' : r)}
                  style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: rejectReason === r ? '1.5px solid #dc2626' : '1px solid #e5e7eb', background: rejectReason === r ? '#fee2e2' : '#f9fafb', color: rejectReason === r ? '#dc2626' : '#374151' }}>
                  {r}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Or write a custom reason <span style={{ color: '#9ca3af', fontWeight: 400 }}>(required)</span>
            </div>
            <textarea rows={4} maxLength={300} value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Describe the issue clearly so the employee can correct and resubmit…"
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 13, resize: 'vertical' }}
            />
            <div style={{ fontSize: 12, color: 300 - rejectReason.length < 30 ? '#ef4444' : '#9ca3af', textAlign: 'right', marginBottom: 16 }}>
              {300 - rejectReason.length} characters remaining
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowReject(false)} disabled={rejecting}>Cancel</button>
              <button type="button" disabled={rejecting || rejectReason.trim().length < 5}
                onClick={() => reject(rejectReason)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: rejecting || rejectReason.trim().length < 5 ? 0.5 : 1 }}>
                {rejecting ? 'Rejecting…' : 'Reject Timesheet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
