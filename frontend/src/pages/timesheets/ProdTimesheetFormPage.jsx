import { useEffect, useState } from 'react';
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
  const isApprover = fromApprovals || permissions.some((p) => p.module === 'Production Timesheets' && p.canReport === true);

  const [header, setHeader] = useState({
    projectId: '',
    projectName: '',
    workOrder: '',
    department: '',
    date: new Date().toISOString().slice(0, 10),
    shift: '',
    entryPerson: user?.employeeCode ?? user?.username ?? '',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [wocWarning, setWocWarning] = useState('');
  const [labourRows, setLabourRows]   = useState([{ ...EMPTY_LABOUR }]);
  const [materialRows, setMaterialRows] = useState([]);
  const [machRows, setMachRows]       = useState([]);

  const { data: employees = [] }   = useQuery({ queryKey: ['employees', 'prod-inst'], queryFn: () => api.get('/employees', { params: { deptFilter: 'prod-inst' } }).then((r) => r.data) });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments').then((r) => r.data) });
  const { data: projects = [] }    = useQuery({ queryKey: ['projects'],    queryFn: () => api.get('/projects').then((r) => r.data) });
  const { data: workOrders = [] }  = useQuery({ queryKey: ['work-orders', 'prod'], queryFn: () => api.get('/work-orders', { params: { subsidiaryIds: '1,3', statuses: 'In Process,Released' } }).then((r) => r.data) });
  const { data: items = [] }       = useQuery({ queryKey: ['items'],       queryFn: () => api.get('/items').then((r) => r.data) });
  const { data: machinery = [] }   = useQuery({ queryKey: ['machinery'],   queryFn: () => api.get('/machinery').then((r) => r.data) });
  const { data: shifts = [] }      = useQuery({ queryKey: ['shifts'],      queryFn: () => api.get('/system-settings/shifts').then((r) => r.data) });
  const { data: completedWos = [] } = useQuery({ queryKey: ['completed-wos'], queryFn: () => api.get('/wo-complete').then((r) => r.data.map((w) => w.workOrderNumber)) });

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
      toast(isEdit ? 'Timesheet updated.' : 'Timesheet saved.', 'success');
      navigate(fromApprovals ? '/timesheets/pending-approvals' : '/timesheets/prod');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
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

    // material qty required
    const filledMaterial = materialRows.filter((r) => r.itemCode);
    for (const r of filledMaterial) {
      if (!r.qty || Number(r.qty) <= 0) {
        toast(`Qty is required for material item ${r.itemCode}.`, 'error'); return;
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

  const projOptions  = projects.map((p) => { const code = p.projectCode ?? p.projectId; return { value: code, label: code, search: `${code} ${p.projectName ?? ''}` }; });
  const woOptions    = filteredWOs.map((w) => ({ value: w.workOrderNumber, label: w.workOrderNumber, search: `${w.workOrderNumber} ${w.projectName ?? ''}` }));
  const deptOptions  = departments
    .filter((d) => {
      if (!d.mainDepartment || d.isActive === false || d.isActive === 0) return false;
      const md = d.mainDepartment.toLowerCase();
      return md.includes('production');
    })
    .map((d) => ({ value: d.departmentCode ?? String(d.departmentId), label: d.departmentCode ?? String(d.departmentId) }));
  const shiftOptions = shifts.map((s) => ({ value: s.shiftCode, label: s.shiftName }));
  const prodInstDepts = ['production', 'installation'];
  const empOptions   = employees
    .filter((e) => prodInstDepts.includes((e.departmentCode ?? '').toLowerCase()))
    .map((e) => ({ value: e.employeeNo, label: `${e.employeeNo} – ${[e.firstName, e.lastname].filter(Boolean).join(' ')}` }));
  const itemOptions  = items.map((i, idx) => ({
    value:        i.itemcode ?? `~${idx}`,
    label:        `${i.itemcode ? i.itemcode + ' – ' : ''}${i.itemName ?? i.description ?? i.itemcode ?? ''}`,
    triggerLabel: i.itemcode ?? i.itemName ?? '',   // short code shown in the trigger cell
  }));
  const machOptions  = machinery.map((m) => ({ value: m.machineName, label: m.machineName }));

  const totalLabour = labourRows.reduce((s, r) => s + (r.durationMinutes || 0), 0);
  const tsStatus = existing?.status ?? null;
  const isReadonly = isView || tsStatus === 'Approved' || tsStatus === 'Rejected' || (tsStatus === 'Submitted' && !isApprover);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header bar ── */}
      <div className="ts-modal-head" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div className="ts-modal-title">{isReadonly && isEdit ? `View ${docNo}` : isEdit ? `Edit ${docNo}` : 'New Production Timesheet'}</div>
            <div className="ts-modal-sub">{isReadonly ? (tsStatus === 'Approved' ? 'Approved — read-only' : tsStatus === 'Rejected' ? 'Rejected — read-only' : tsStatus === 'Submitted' ? 'Submitted — read-only' : 'Read-only view') : 'Fill in the details below and save'}</div>
          </div>
          {isEdit && <span className="ts-docno-pill">{docNo}</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => confirmLeave('/timesheets/prod')}>← Back</button>
      </div>

      <form onSubmit={submit} onChange={() => !isDirty && setIsDirty(true)} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="ts-modal-body" style={{ flex: 1, overflow: 'hidden' }}>

          {/* ── Left panel: header fields ── */}
          <div className="ts-form-panel" style={{ pointerEvents: isReadonly ? 'none' : undefined }}>
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
          <div className="ts-lines-panel">
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
                    {labourRows.map((row, i) => (
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
                        <td><TimeInput value={row.endTime}   onChange={(v) => setLabour(i, 'endTime',   v)} /></td>
                        <td style={{ textAlign: 'center', color: 'var(--text2)' }}>{row.durationMinutes || ''}</td>
                        <td>
                          {labourRows.length > 1 && (
                            <button type="button" className="btn-icon" onClick={() => setLabourRows((p) => p.filter((_, j) => j !== i))}>✕</button>
                          )}
                        </td>
                      </tr>
                    ))}
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
            <button type="button" className="ts-footer-cancel" onClick={() => navigate('/timesheets/prod')}>← Back to List</button>
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
    </div>
  );
}
