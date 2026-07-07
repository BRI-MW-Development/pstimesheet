import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import SearchSelect from '../../components/ui/SearchSelect';
import TimeInput from '../../components/ui/TimeInput';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../store/authStore';

const EMPTY_LABOUR   = { employee: '', startTime: '', endTime: '', durationMinutes: 0 };
const EMPTY_MATERIAL = { itemCode: '', description: '', uom: '', qty: '' };
const EMPTY_VEHICLE  = { vehicle: '', km: '' };
const EMPTY_ACCESS   = { equipment: '', hours: '' };

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

export default function InstTimesheetFormPage() {
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
  const isApprover = fromApprovals || permissions.some((p) => p.module === 'INST' && p.canWrite && p.canReport);
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
    tsType: 'INST',
    projectId: '',
    projectName: '',
    workOrder: '',
    department: '',
    date: new Date().toISOString().slice(0, 10),
    shift: '',
    digitalTech: '',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [wocWarning, setWocWarning] = useState('');
  const [labourRows,   setLabourRows]   = useState([{ ...EMPTY_LABOUR }]);
  const [materialRows, setMaterialRows] = useState([]);   // consistent with ProdTimesheetFormPage
  const [vehicleRows,  setVehicleRows]  = useState([]);
  const [accessRows,   setAccessRows]   = useState([]);

  const entryPerson = (isEdit && existing?.entered_by_name) ? existing.entered_by_name : (user?.displayName ?? user?.username ?? '');

  const STALE_5M = 5 * 60 * 1000;
  const { data: employees        = [] } = useQuery({ queryKey: ['employees', 'inst'],      queryFn: () => api.get('/employees', { params: { deptFilter: 'inst' } }).then((r) => r.data), staleTime: STALE_5M });
  const { data: departments      = [] } = useQuery({ queryKey: ['departments'],      queryFn: () => api.get('/departments').then((r) => r.data), staleTime: STALE_5M });
  const { data: allWorkOrders    = [] } = useQuery({ queryKey: ['work-orders', 'inst'], queryFn: () => api.get('/work-orders', { params: { subsidiaryIds: '1,3', statuses: 'In Process,Released' } }).then((r) => r.data), staleTime: STALE_5M });
  const { data: vehicles         = [] } = useQuery({ queryKey: ['vehicles'],         queryFn: () => api.get('/vehicles').then((r) => r.data), staleTime: STALE_5M });
  const { data: accessEquipment  = [] } = useQuery({ queryKey: ['access-equipment'], queryFn: () => api.get('/access-equipment').then((r) => r.data), staleTime: STALE_5M });
  const { data: shifts           = [] } = useQuery({ queryKey: ['shifts'],           queryFn: () => api.get('/system-settings/shifts').then((r) => r.data), staleTime: STALE_5M });
  const { data: projects         = [] } = useQuery({ queryKey: ['projects'],         queryFn: () => api.get('/projects').then((r) => r.data), staleTime: STALE_5M });
  const { data: items            = [] } = useQuery({ queryKey: ['items'],            queryFn: () => api.get('/items').then((r) => r.data), staleTime: STALE_5M });
  const { data: completedWos     = [] } = useQuery({ queryKey: ['wo-complete-list'], queryFn: () => api.get('/wo-complete').then((r) => r.data.map((w) => w.workOrderNumber)), staleTime: STALE_5M });

  const completedSet = new Set(completedWos);

  const { data: existing } = useQuery({
    queryKey: ['timesheet', docNo],
    queryFn: () => api.get(`/timesheets/${docNo}`).then((r) => r.data),
    enabled: isEdit,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!existing) return;
    const pid = existing.projectId ?? existing.project_code ?? '';
    const proj = projects.find((p) => p.projectCode === pid);
    setHeader({
      tsType: 'INST',
      projectId: pid,
      projectName: (() => { const r = proj?.projectName ?? existing.projectName ?? ''; return r.includes(':') ? r.split(':').slice(1).join(':').trim() : r; })(),
      workOrder: existing.workOrderNo ?? existing.workOrder ?? '',
      department: existing.department_code ?? existing.department ?? '',
      date: existing.entryDate?.slice(0, 10) ?? '',
      shift: existing.shiftCode ?? existing.shift ?? '',
      digitalTech: existing.digitalTech ?? '',
    });
    setLabourRows(
      existing.labourLines?.length
        ? existing.labourLines.map((l) => ({ employee: l.employeeCode ?? '', startTime: l.startTime ?? '', endTime: l.endTime ?? '', durationMinutes: l.durationMinutes ?? 0 }))
        : [{ ...EMPTY_LABOUR }]
    );
    setMaterialRows(
      existing.materialLines?.length
        ? existing.materialLines.map((m) => ({ itemCode: m.itemCode ?? '', description: m.itemName ?? m.description ?? '', uom: m.uom ?? '', qty: m.qty ?? '' }))
        : []
    );
    setVehicleRows(
      existing.vehicleLines?.map((v) => ({ vehicle: v.equipmentName ?? v.vehicleCode ?? v.vehicle ?? '', km: String(v.hoursUsed ?? v.km ?? '') })) ?? []
    );
    setAccessRows(
      existing.accessLines?.map((a) => ({ equipment: a.equipmentName ?? a.equipment ?? '', hours: String(a.hoursUsed ?? a.hours ?? '') })) ?? []
    );
    setIsDirty(false);
  }, [existing, projects]);

  function onProjectChange(pid) {
    setIsDirty(true);
    const proj = projects.find((p) => p.projectCode === pid);
    const rawName = proj?.projectName ?? '';
    const projectName = rawName.includes(':') ? rawName.split(':').slice(1).join(':').trim() : rawName;
    setHeader((h) => ({ ...h, projectId: pid, projectName, workOrder: '' }));
    setWocWarning('');
  }

  function onWorkOrderChange(wo) {
    setIsDirty(true);
    setHeader((h) => ({ ...h, workOrder: wo }));
    if (wo && completedSet.has(wo)) {
      setWocWarning(`Work order ${wo} has already been marked as complete. Please select a different work order.`);
    } else {
      setWocWarning('');
    }
    const matched = allWorkOrders.find((w) => w.workOrderNumber === wo);
    if (matched?.departmentCode && !header.department) {
      setHeader((h) => ({ ...h, workOrder: wo, department: matched.departmentCode }));
    }
  }

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

  const filteredWOs = allWorkOrders.filter((w) => {
    const woNo      = (w.workOrderNumber ?? '').trim();
    const dept      = (w.departmentName       ?? '').toLowerCase();
    const parentDept= (w.parentDepartmentName ?? '').toLowerCase();
    const isInst    = dept === 'installation' || parentDept === 'installation';
    if (!isInst) return false;
    if (completedSet.has(woNo)) return false;
    if (header.projectId && w.projectCode !== header.projectId) return false;
    return true;
  });

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload) =>
      isEdit
        ? api.put(`/timesheets/${docNo}`, payload).then((r) => r.data)
        : api.post('/timesheets', payload).then((r) => r.data),
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['inst-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['timesheet', docNo] });
      toast(isEdit ? 'Timesheet updated.' : 'Timesheet created.', 'success');
      navigate(fromApprovals ? '/timesheets/pending-approvals' : '/timesheets/inst');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: () => api.post(`/timesheets/${docNo}/approve`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['inst-timesheets'] });
      toast('Timesheet approved.', 'success');
      navigate('/timesheets/pending-approvals');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Approve failed.', 'error'),
  });

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: (reason) => api.post(`/timesheets/${docNo}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['inst-timesheets'] });
      toast('Timesheet rejected.', 'success');
      navigate('/timesheets/pending-approvals');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Reject failed.', 'error'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (wocWarning) { toast('Cannot save: work order is already complete.', 'error'); return; }
    if (!header.projectId?.trim())  { toast('Project ID is required.',  'error'); return; }
    if (!header.workOrder?.trim())  { toast('Work Order is required.',  'error'); return; }
    if (!header.department?.trim()) { toast('Department is required.',  'error'); return; }
    if (!header.shift?.trim())      { toast('Shift is required.',       'error'); return; }
    if (isDigitalDept && !header.digitalTech) { toast('Digital Tech is required for Digital department.', 'error'); return; }

    // #15 — no future dates
    if (!header.date) { toast('Date is required.', 'error'); return; }
    const today = new Date().toISOString().slice(0, 10);
    if (header.date > today) { toast('Date cannot be in the future.', 'error'); return; }

    // #10 — at least one filled labour row
    const filledLabour = labourRows.filter((r) => r.employee);
    if (filledLabour.length === 0) { toast('At least one employee entry is required.', 'error'); return; }

    // #12 — duplicate employee + time
    const seen = new Set();
    for (const r of filledLabour) {
      const key = `${r.employee}|${r.startTime}|${r.endTime}`;
      if (seen.has(key)) { toast(`Duplicate entry: ${r.employee} with the same time already added.`, 'error'); return; }
      seen.add(key);
    }

    // same start & end time = zero duration
    for (const r of filledLabour) {
      if (r.startTime && r.endTime && r.startTime === r.endTime) {
        toast(`Start time and end time cannot be the same for employee ${r.employee}.`, 'error'); return;
      }
    }

    // #13 — overlapping times for same employee
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

    // TS-004 — start time and end time required for each filled labour row
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

    // TS-005 — KM required for vehicle rows, Hours required for access equipment rows
    const filledVehicle = vehicleRows.filter((r) => r.vehicle);
    for (const r of filledVehicle) {
      if (!r.km && r.km !== 0) { toast(`KM is required for vehicle ${r.vehicle}.`, 'error'); return; }
    }
    const filledAccess = accessRows.filter((r) => r.equipment);
    for (const r of filledAccess) {
      if (!r.hours && r.hours !== 0) { toast(`Hours is required for equipment ${r.equipment}.`, 'error'); return; }
    }

    // shift time window validation
    const selectedShift = shifts.find((s) => s.shiftCode === header.shift);
    if (selectedShift?.startTime && selectedShift?.endTime) {
      const sStart = selectedShift.startTime;
      const sEnd   = selectedShift.endTime;
      const overnight = sEnd < sStart;
      const inWindow  = (t) => overnight ? (t >= sStart || t <= sEnd) : (t >= sStart && t <= sEnd);
      for (const r of filledLabour) {
        if (!r.startTime || !r.endTime) continue;
        if (!inWindow(r.startTime) || !inWindow(r.endTime)) {
          toast(`Employee ${r.employee} times (${r.startTime}–${r.endTime}) are outside the ${selectedShift.shiftName} shift window (${sStart}–${sEnd}).`, 'error'); return;
        }
      }
    }

    save({
      tsType: 'INST',
      projectId: header.projectId,
      projectName: header.projectName,
      workOrder: header.workOrder,
      department: header.department,
      date: header.date,
      shift: header.shift,
      digitalTech: isDigitalDept ? header.digitalTech : null,
      entryPerson,
      labourRows,
      materialRows,
      vehicleRows,
      accessRows,
    });
  }

  function setLabour(idx, field, val) {
    setLabourRows((rows) => rows.map((r, i) => {
      if (i !== idx) return r;
      const u = { ...r, [field]: val };
      if (field === 'startTime' || field === 'endTime')
        u.durationMinutes = calcDuration(field === 'startTime' ? val : r.startTime, field === 'endTime' ? val : r.endTime);
      return u;
    }));
  }

  function setMaterial(idx, field, val) {
    setMaterialRows((rows) => rows.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }

  function onItemSelect(idx, code) {
    const item = String(code).startsWith('~') ? items[parseInt(code.slice(1))] : items.find((it) => it.itemcode === code);
    setMaterialRows((rows) => rows.map((r, i) => i === idx
      ? { ...r, itemCode: item?.itemcode ?? code, description: item?.description ?? item?.itemName ?? r.description, uom: item?.UOM ?? r.uom }
      : r));
  }

  const projOptions  = useMemo(() => projects.map((p) => ({ value: p.projectCode, label: p.projectCode, search: `${p.projectCode} ${p.projectName ?? ''}` })), [projects]);
  const woOptions    = useMemo(() => filteredWOs.map((w) => ({ value: w.workOrderNumber, label: w.workOrderNumber, search: `${w.workOrderNumber} ${w.projectName ?? ''}` })), [filteredWOs]);
  const deptOptions  = useMemo(() => departments
    .filter((d) => {
      if (d.isActive === false || d.isActive === 0) return false;
      const md = (d.mainDepartment ?? '').toLowerCase();
      const dc = (d.departmentCode ?? '').toLowerCase();
      return md.includes('install') || dc.includes('install');
    })
    .map((d) => ({ value: d.departmentCode ?? String(d.departmentId), label: d.departmentCode ?? String(d.departmentId) })), [departments]);
  const shiftOptions = useMemo(() => shifts
    .filter((s) => s.status === 'Active')
    .map((s) => ({ value: s.shiftCode, label: `${s.shiftCode} — ${s.shiftName ?? ''}` })), [shifts]);
  const instDepts  = ['production', 'installation', 'digital'];
  const empOptions = useMemo(() => employees
    .filter((e) => instDepts.includes((e.departmentCode ?? '').toLowerCase()))
    .map((e) => ({ value: e.employeeNo, label: `${e.employeeNo} – ${[e.firstName, e.lastname].filter(Boolean).join(' ')}` })), [employees]);
  const itemOptions  = useMemo(() => items.map((it, idx) => ({
    value:        it.itemcode ?? `~${idx}`,
    label:        `${it.itemcode ? it.itemcode + ' – ' : ''}${it.itemName ?? it.description ?? it.itemcode ?? ''}`,
    triggerLabel: it.itemcode ?? it.itemName ?? '',
  })), [items]);
  const vehOptions   = useMemo(() => vehicles.map((v) => ({ value: v.vehicleId ?? v.plateNo, label: `${v.plateNo} – ${v.vehicleType ?? ''}` })), [vehicles]);
  const accOptions   = useMemo(() => accessEquipment.map((a) => ({ value: a.equipmentName ?? a.name, label: a.equipmentName ?? a.name })), [accessEquipment]);

  const isDigitalDept = (header.department ?? '').toLowerCase().includes('digital');

  const tsStatus = existing?.status ?? null;
  const isReadonly = isView || tsStatus === 'Approved' || tsStatus === 'Rejected' || (tsStatus === 'Submitted' && !isApprover);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <form onSubmit={handleSubmit} onChange={() => !isDirty && setIsDirty(true)} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="ts-modal-head" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div className="ts-modal-title">{isReadonly && isEdit ? `View ${docNo}` : isEdit ? `Edit ${docNo}` : 'New Installation Timesheet'}</div>
              <div className="ts-modal-sub">{isReadonly ? (tsStatus === 'Approved' ? 'Approved — read-only' : tsStatus === 'Rejected' ? 'Rejected — read-only' : tsStatus === 'Submitted' ? 'Submitted — read-only' : 'Read-only view') : 'Fill in the details below and save'}</div>
            </div>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => confirmLeave(fromApprovals ? '/timesheets/pending-approvals' : '/timesheets/inst')}>← Back</button>
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

        <div className="ts-modal-body" style={{ flex: 1, overflow: 'hidden', flexDirection: isMobile ? 'column' : undefined }}>
          {/* Left panel — header fields */}
          <div className="ts-form-panel" style={{ pointerEvents: isReadonly ? 'none' : undefined, display: isMobile && mobTab === 'entries' ? 'none' : undefined }}>
            <div className="ts-field-group">
              <label className="ts-field-label">Project ID <span style={{ color: 'var(--red)' }}>*</span></label>
              <SearchSelect
                options={projOptions}
                value={header.projectId}
                onChange={onProjectChange}
                placeholder="Type to search…"
              />
            </div>

            <div className="ts-field-group">
              <label className="ts-field-label">Project Name</label>
              <input className="form-control ts-input ts-readonly" value={header.projectName} readOnly />
            </div>

            <div className="ts-field-group">
              <label className="ts-field-label">Work Order <span style={{ color: 'var(--red)' }}>*</span></label>
              <SearchSelect
                options={woOptions}
                value={header.workOrder}
                onChange={onWorkOrderChange}
                placeholder="Select work order…"
              />
            </div>

            <div className="ts-field-group">
              <label className="ts-field-label">Department <span style={{ color: 'var(--red)' }}>*</span></label>
              <SearchSelect
                options={deptOptions}
                value={header.department}
                onChange={(v) => { setIsDirty(true); setHeader((h) => ({ ...h, department: v, digitalTech: '' })); }}
                placeholder="Select department…"
              />
            </div>

            <div className="ts-field-group">
              <label className="ts-field-label">Date</label>
              <input type="date" className="form-control ts-input" value={header.date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))} />
            </div>
            <div className="ts-field-group">
              <label className="ts-field-label">Shift <span style={{ color: 'var(--red)' }}>*</span></label>
              <SearchSelect
                options={shiftOptions}
                value={header.shift}
                onChange={(v) => { setIsDirty(true); setHeader((h) => ({ ...h, shift: v })); }}
                placeholder="Select shift…"
              />
            </div>

            {isDigitalDept && (
              <div className="ts-field-group">
                <label className="ts-field-label">Digital Tech <span style={{ color: 'var(--red)' }}>*</span></label>
                <select
                  className="form-control ts-input"
                  value={header.digitalTech}
                  onChange={(e) => { setIsDirty(true); setHeader((h) => ({ ...h, digitalTech: e.target.value })); }}
                >
                  <option value="">Select…</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            )}

            <div className="ts-field-group">
              <label className="ts-field-label">Entry Person</label>
              <input className="form-control ts-input ts-readonly" value={entryPerson} readOnly />
            </div>

            <div className="ts-divider"></div>

            <div className="ts-summary">
              <div className="ts-summary-row"><span>Labour rows</span><span>{labourRows.filter((r) => r.employee).length}</span></div>
              <div className="ts-summary-row"><span>Total Labour</span><span>{minsToHm(labourRows.reduce((s, r) => s + (r.durationMinutes || 0), 0))}</span></div>
              <div className="ts-summary-row"><span>Material rows</span><span>{materialRows.filter((r) => r.itemCode).length}</span></div>
              <div className="ts-summary-row"><span>Vehicle rows</span><span>{vehicleRows.filter((r) => r.vehicle).length}</span></div>
              <div className="ts-summary-row"><span>Access Equipment</span><span>{accessRows.filter((r) => r.equipment).length}</span></div>
            </div>
          </div>

          {/* Right panel — line sections */}
          <div className="ts-lines-panel" style={{ display: isMobile && mobTab === 'details' ? 'none' : undefined }}>
            <div className="ts-scroll-panel">
              <div style={{ display: 'contents', pointerEvents: isReadonly ? 'none' : undefined }}>

              {/* Labour Time */}
              <div className="ts-section">
                <div className="ts-section-head">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  Labour Time
                  <span className="ts-section-badge">{labourRows.length}</span>
                </div>
                <table className="ts-line-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th style={{ width: 108 }}>Start Time</th>
                      <th style={{ width: 108 }}>End Time</th>
                      <th style={{ width: 108 }}>Duration (min)</th>
                      <th style={{ width: 34 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {labourRows.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <SearchSelect options={empOptions} value={row.employee}
                            onChange={(v) => { setIsDirty(true); setLabour(i, 'employee', v); }} placeholder="Employee…" />
                        </td>
                        <td>
                          <TimeInput value={row.startTime} onChange={(v) => setLabour(i, 'startTime', v)} className="line-input" />
                        </td>
                        <td>
                          <TimeInput value={row.endTime}   onChange={(v) => setLabour(i, 'endTime',   v)} className="line-input" />
                        </td>
                        <td>
                          <input className="line-input" value={row.durationMinutes || ''} readOnly />
                        </td>
                        <td>
                          {labourRows.length > 1 && (
                            <button type="button" className="del-row-btn"
                              onClick={() => setLabourRows((p) => p.filter((_, j) => j !== i))} title="Remove">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="ts-section-footer">
                  <button type="button" className="ts-add-btn"
                    onClick={() => setLabourRows((p) => [...p, { ...EMPTY_LABOUR }])}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Employee
                  </button>
                </div>
              </div>

              {/* Consumed Material */}
              <div className="ts-section">
                <div className="ts-section-head">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                  Consumed Material
                  <span className="ts-section-badge">{materialRows.length}</span>
                </div>
                <table className="ts-line-table">
                  <thead>
                    <tr>
                      <th style={{ width: 160 }}>Item Code</th>
                      <th>Description</th>
                      <th style={{ width: 72 }}>UOM</th>
                      <th style={{ width: 100 }}>Qty</th>
                      <th style={{ width: 34 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialRows.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <SearchSelect options={itemOptions} value={row.itemCode}
                            onChange={(v) => { setIsDirty(true); onItemSelect(i, v); }} placeholder="Item code…" />
                        </td>
                        <td>
                          <input className="line-input" value={row.description}
                            onChange={(e) => setMaterial(i, 'description', e.target.value)} />
                        </td>
                        <td>
                          <input className="line-input" value={row.uom}
                            onChange={(e) => setMaterial(i, 'uom', e.target.value)} />
                        </td>
                        <td>
                          <input type="number" className="line-input" value={row.qty} min="0" step="0.01"
                            onChange={(e) => setMaterial(i, 'qty', e.target.value)} />
                        </td>
                        <td>
                          <button type="button" className="del-row-btn"
                            onClick={() => setMaterialRows((p) => p.filter((_, j) => j !== i))} title="Remove">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="ts-section-footer">
                  <button type="button" className="ts-add-btn"
                    onClick={() => setMaterialRows((p) => [...p, { ...EMPTY_MATERIAL }])}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Material
                  </button>
                </div>
              </div>

              {/* Vehicle */}
              <div className="ts-section">
                <div className="ts-section-head">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  Vehicle
                  <span className="ts-section-badge">{vehicleRows.length}</span>
                </div>
                <table className="ts-line-table">
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th style={{ width: 120 }}>KM</th>
                      <th style={{ width: 34 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleRows.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <SearchSelect options={vehOptions} value={row.vehicle}
                            onChange={(v) => { setIsDirty(true); setVehicleRows((p) => p.map((r, j) => j === i ? { ...r, vehicle: v } : r)); }}
                            placeholder="Select vehicle…" />
                        </td>
                        <td>
                          <input type="number" className="line-input" value={row.km} min="0" step="1"
                            onChange={(e) => setVehicleRows((p) => p.map((r, j) => j === i ? { ...r, km: e.target.value } : r))} />
                        </td>
                        <td>
                          <button type="button" className="del-row-btn"
                            onClick={() => setVehicleRows((p) => p.filter((_, j) => j !== i))} title="Remove">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="ts-section-footer">
                  <button type="button" className="ts-add-btn"
                    onClick={() => setVehicleRows((p) => [...p, { ...EMPTY_VEHICLE }])}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Vehicle
                  </button>
                </div>
              </div>

              {/* Access Equipment */}
              <div className="ts-section">
                <div className="ts-section-head">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  Access Equipment
                  <span className="ts-section-badge">{accessRows.length}</span>
                </div>
                <table className="ts-line-table">
                  <thead>
                    <tr>
                      <th>Equipment</th>
                      <th style={{ width: 120 }}>Hours</th>
                      <th style={{ width: 34 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessRows.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <SearchSelect options={accOptions} value={row.equipment}
                            onChange={(v) => { setIsDirty(true); setAccessRows((p) => p.map((r, j) => j === i ? { ...r, equipment: v } : r)); }}
                            placeholder="Select equipment…" />
                        </td>
                        <td>
                          <input type="number" className="line-input" value={row.hours} min="0" step="0.5"
                            onChange={(e) => setAccessRows((p) => p.map((r, j) => j === i ? { ...r, hours: e.target.value } : r))} />
                        </td>
                        <td>
                          <button type="button" className="del-row-btn"
                            onClick={() => setAccessRows((p) => p.filter((_, j) => j !== i))} title="Remove">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="ts-section-footer">
                  <button type="button" className="ts-add-btn"
                    onClick={() => setAccessRows((p) => [...p, { ...EMPTY_ACCESS }])}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Access Equipment
                  </button>
                </div>
              </div>

              </div>{/* end pointer-events wrapper */}
            </div>
          </div>
        </div>

        {wocWarning && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', margin: '0 20px', fontSize: 13, color: '#b91c1c', fontWeight: 500, lineHeight: 1.4 }}>
            {wocWarning}
          </div>
        )}

        <div className="ts-modal-footer">
          {isReadonly ? (
            <>
              <button type="button" className="ts-footer-cancel" onClick={() => navigate(fromApprovals ? '/timesheets/pending-approvals' : '/timesheets/inst')}>← Back</button>
              {fromApprovals && (
                <>
                  <button type="button" className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={() => navigate(`/timesheets/inst/${docNo}/edit?from=approvals`)}>
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
              <button type="button" className="ts-footer-cancel" onClick={() => confirmLeave('/timesheets/inst')}>Cancel</button>
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
