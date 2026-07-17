import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import Badge from '../../components/ui/Badge';
import { formatDate } from '../../utils/format';

const STATUS_VARIANT = { Draft: 'draft', Submitted: 'submitted', Approved: 'approved', Rejected: 'rejected' };

// ── Helpers ────────────────────────────────────────────────────────────────────
function exportCSV(headers, rows, filename) {
  const csv = [headers, ...rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ── Employee searchable multi-select dropdown ─────────────────────────────────
function EmployeeMultiSelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const filtered = options.filter((e) => e.toLowerCase().includes(search.toLowerCase()));
  const label = value.length === 0 ? 'All Employees'
              : value.length === 1 ? value[0]
              : `${value.length} selected`;

  const openDropdown = () => {
    if (containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 2, left: r.left, width: r.width });
    }
    setOpen(true);
    setSearch('');
    setTimeout(() => searchRef.current?.focus(), 10);
  };

  return (
    <div ref={containerRef}>
      <div className="form-control form-control-sm"
           style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
           onClick={() => (open ? setOpen(false) : openDropdown())}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {options.length === 0 ? <span style={{ color: 'var(--text3)', fontSize: 12 }}>Run report first</span> : label}
        </span>
        <span style={{ flexShrink: 0, fontSize: 10, marginLeft: 6 }}>▾</span>
      </div>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.25)' }} onMouseDown={() => setOpen(false)} />
          <div
            style={{ position: 'fixed', zIndex: 1001, top: pos.top, left: pos.left, width: Math.max(pos.width, 240), background: 'var(--surface)', border: '2px solid var(--accent)', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.28)', overflow: 'hidden' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
              <input ref={searchRef} className="form-control form-control-sm" placeholder="Search…"
                     value={search} onChange={(e) => setSearch(e.target.value)}
                     style={{ margin: 0 }} />
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {filtered.length === 0
                ? <div style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 12 }}>No matches</div>
                : filtered.map((emp) => (
                    <label key={emp} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={value.includes(emp)}
                             onChange={(e) => onChange(e.target.checked ? [...value, emp] : value.filter((s) => s !== emp))} />
                      {emp}
                    </label>
                  ))
              }
            </div>
            {value.length > 0 && (
              <div style={{ padding: '5px 10px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => onChange([])}>Clear</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Filter bar shared by both reports ─────────────────────────────────────────
function FilterBar({ filters, setFilters, onRun, showType = true, tsType = '', employeeOptions = [], selectedEmps = [], onEmpsChange, projIdFilter = '', onProjIdChange }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-body" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div>
            <label className="form-label">Date From</label>
            <input type="date" className="form-control form-control-sm" value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Date To</label>
            <input type="date" className="form-control form-control-sm" value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
          </div>
          {showType && (
            <div>
              <label className="form-label">Type</label>
              <select className="form-control form-control-sm" value={filters.type ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
                <option value="">All Types</option>
                <option value="PROD">Production</option>
                <option value="INST">Installation</option>
                <option value="PROJ">Project</option>
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Status</label>
            <select className="form-control form-control-sm" value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All Statuses</option>
              <option>Draft</option>
              <option>Submitted</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </div>
          {tsType === 'PROJ' ? (
            <>
              <div>
                <label className="form-label">Employee</label>
                <EmployeeMultiSelect options={employeeOptions} value={selectedEmps} onChange={onEmpsChange} />
              </div>
              <div>
                <label className="form-label">Project ID</label>
                <input className="form-control form-control-sm" placeholder="Project ID" value={projIdFilter}
                  onChange={(e) => onProjIdChange(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="form-label">Project ID</label>
                <input className="form-control form-control-sm" placeholder="Project ID" value={filters.projectId ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Work Order #</label>
                <input className="form-control form-control-sm" placeholder="Work Order No" value={filters.workOrderNo ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, workOrderNo: e.target.value }))} />
              </div>
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={onRun}>
              Run Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportHeader({ title, sub, onBack, onClear, onExport, hasData }) {
  return (
    <div className="wip-list-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn btn-outline btn-sm" onClick={onBack} style={{ padding: '4px 10px' }}>←</button>
        <div>
          <div className="wip-list-title">{title}</div>
          <div className="wip-list-sub">{sub}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={onClear}>Clear</button>
        <button className="btn btn-primary btn-sm" onClick={onExport} disabled={!hasData}>Export CSV</button>
      </div>
    </div>
  );
}

// ── Summary Report View ────────────────────────────────────────────────────────
function SummaryReport({ onBack }) {
  const BLANK = { dateFrom: '', dateTo: '', type: '', status: '', department: '' };
  const [filters, setFilters] = useState(BLANK);
  const [submitted, setSubmitted] = useState(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['rpt-summary', submitted],
    queryFn: () => api.get('/timesheets/report-summary', { params: submitted }).then((r) => r.data),
    enabled: Boolean(submitted),
  });

  const totalHours    = rows.reduce((s, r) => s + (r.totalHours    ?? 0), 0);
  const totalLabour   = rows.reduce((s, r) => s + (r.labourCount   ?? 0), 0);
  const totalMaterial = rows.reduce((s, r) => s + (r.materialCount ?? 0), 0);
  const totalEquip    = rows.reduce((s, r) => s + (r.equipmentCount ?? 0), 0);

  function doExport() {
    exportCSV(
      ['Doc No', 'Type', 'Date', 'Department', 'Work Order / Project', 'Entered By', 'Shift', 'Labour', 'Duration (h)', 'Materials', 'Equipment', 'Status'],
      rows.map((r) => [r.docNo, r.tsType, r.entryDate, r.department_code, r.workOrderNo ?? r.projectId ?? '', r.entered_by_name ?? '', r.shiftCode ?? '', r.labourCount ?? 0, r.totalHours?.toFixed(2) ?? '0.00', r.materialCount ?? 0, r.equipmentCount ?? 0, r.status]),
      `timesheet-summary-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  return (
    <div className="page-content">
      <ReportHeader
        title="Timesheet Summary Report"
        sub="Header-level view with labour, material and equipment counts"
        onBack={onBack}
        onClear={() => { setFilters(BLANK); setSubmitted(null); }}
        onExport={doExport}
        hasData={rows.length > 0}
      />

      <FilterBar filters={filters} setFilters={setFilters} onRun={() => setSubmitted({ ...filters })} />

      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Timesheets',      value: rows.length },
            { label: 'Total Duration',  value: `${totalHours.toFixed(1)}h` },
            { label: 'Labour Lines',    value: totalLabour },
            { label: 'Material Lines',  value: totalMaterial },
            { label: 'Equipment Lines', value: totalEquip },
          ].map((k) => (
            <div key={k.label} className="card" style={{ marginBottom: 0, flex: 1, minWidth: 110 }}>
              <div className="card-body" style={{ padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-body" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="wip-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>#</th><th>Doc No</th><th>Type</th><th>Date</th><th>Department</th>
                  <th>Work Order / Project</th><th>Entered By</th><th>Shift</th>
                  <th style={{ textAlign: 'center' }}>Labour</th>
                  <th style={{ textAlign: 'right' }}>Duration</th>
                  <th style={{ textAlign: 'center' }}>Materials</th>
                  <th style={{ textAlign: 'center' }}>Equipment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={13} style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={13} style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>
                    {submitted ? 'No timesheets match the selected filters.' : 'Select filters and click Run Report'}
                  </td></tr>
                ) : rows.map((r, i) => (
                  <tr key={r.docNo}>
                    <td style={{ color: 'var(--text3)', fontSize: 11 }}>{i + 1}</td>
                    <td><span className="wip-link">{r.docNo}</span></td>
                    <td>{r.tsType}</td>
                    <td>{formatDate(r.entryDate)}</td>
                    <td>{r.department_code ?? '—'}</td>
                    <td>{r.workOrderNo ?? r.projectId ?? '—'}</td>
                    <td>{r.entered_by_name ?? '—'}</td>
                    <td>{r.shiftCode ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{r.labourCount ?? 0}</td>
                    <td style={{ textAlign: 'right' }}>{r.totalHours != null ? `${Number(r.totalHours).toFixed(2)}h` : '—'}</td>
                    <td style={{ textAlign: 'center' }}>{r.materialCount ?? 0}</td>
                    <td style={{ textAlign: 'center' }}>{r.equipmentCount ?? 0}</td>
                    <td><Badge variant={STATUS_VARIANT[r.status] ?? 'draft'}>{r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail Report View ─────────────────────────────────────────────────────────
const LINE_VARIANT = { LABOUR: 'submitted', MATERIAL: 'warning', EQUIPMENT: 'info', MACHINERY: 'info', VEHICLE: 'draft', ACCESS: 'draft' };
const LINE_LABEL   = { LABOUR: 'Labour', MATERIAL: 'Material', EQUIPMENT: 'Equipment', MACHINERY: 'Machinery', VEHICLE: 'Vehicle', ACCESS: 'Access Equip' };

function DetailReport({ tsType, onBack }) {
  const typeLabels = { PROD: 'Production', INST: 'Installation', PROJ: 'Project' };
  const isProj = tsType === 'PROJ';
  const BLANK = { dateFrom: '', dateTo: '', status: '', department: '', workOrderNo: '', projectId: '' };
  const [filters, setFilters] = useState(BLANK);
  const [submitted, setSubmitted] = useState(null);
  const [selectedEmps, setSelectedEmps] = useState([]);
  const [projIdFilter, setProjIdFilter] = useState('');

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ['rpt-detail', tsType, submitted],
    queryFn: () => api.get('/timesheets/report-detail', { params: { type: tsType, ...submitted } }).then((r) => r.data),
    enabled: Boolean(submitted),
  });

  const employeeOptions = isProj
    ? [...new Set(allRows.filter((r) => r.lineType === 'LABOUR').map((r) => r.employeeName).filter(Boolean))].sort()
    : [];

  const rows = (() => {
    let r = allRows;
    if (isProj && selectedEmps.length > 0) r = r.filter((row) => row.lineType === 'LABOUR' && selectedEmps.includes(row.employeeName));
    if (isProj && projIdFilter.trim()) r = r.filter((row) => (row.projectId ?? '').toLowerCase().includes(projIdFilter.trim().toLowerCase()));
    return r;
  })();

  function lineDesc(r) {
    if (r.lineType === 'LABOUR') {
      const name = r.employeeName ?? r.employeeCode ?? '—';
      if (r.nonProjectRelated && r.nonProjectDetails) return `${name} · Non-Project: ${r.nonProjectDetails}`;
      return name;
    }
    if (r.lineType === 'MATERIAL')                          return [r.itemCode, r.itemName].filter(Boolean).join(' – ') || '—';
    if (['MACHINERY','VEHICLE','ACCESS','EQUIPMENT'].includes(r.lineType)) return r.equipmentName ?? '—';
    return '—';
  }

  function lineQty(r) {
    if (r.lineType === 'LABOUR')    return r.qty != null ? `${(r.qty / 60).toFixed(2)}h` : '—';
    if (r.lineType === 'MATERIAL')  return r.qty != null ? `${r.qty} ${r.uom ?? ''}`.trim() : '—';
    if (r.lineType === 'MACHINERY') return r.qty != null ? `${r.qty} min` : '—';
    if (r.lineType === 'VEHICLE')   return r.qty != null ? `${r.qty} km`  : '—';
    if (['ACCESS','EQUIPMENT'].includes(r.lineType)) return r.qty != null ? `${r.qty}h` : '—';
    return '—';
  }

  function lineDuration(r) {
    if (r.lineType === 'LABOUR' && r.qty != null) {
      const h = Math.floor(r.qty / 60);
      const m = r.qty % 60;
      return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
    }
    return lineQty(r);
  }

  function lineMins(r) {
    if (r.lineType === 'LABOUR')    return r.qty != null ? r.qty : '—';
    if (r.lineType === 'MACHINERY') return r.qty != null ? r.qty : '—';
    return '—';
  }

  const colCount = isProj ? 11 : 10;

  function doExport() {
    if (isProj) {
      exportCSV(
        ['Doc No', 'Date', 'WO / Project', 'Line', 'Description', 'Task Type', 'Non-Project Details', 'Comments', 'Duration', 'Mins', 'Status'],
        rows.map((r) => [
          r.tsDocNo, r.entryDate, r.workOrderNo ?? r.projectId ?? '',
          r.lineNumber, r.employeeName ?? lineDesc(r),
          r.taskTypeCode ?? '', r.nonProjectRelated ? (r.nonProjectDetails ?? '') : '',
          r.comments ?? '', lineDuration(r), lineMins(r), r.status,
        ]),
        `proj-detail-${new Date().toISOString().slice(0, 10)}.csv`
      );
    } else {
      exportCSV(
        ['Doc No', 'Date', 'Department', 'WO / Project', 'Line', 'Type', 'Description', 'Qty / Hours', 'Status'],
        rows.map((r) => [
          r.tsDocNo, r.entryDate, r.department_code, r.workOrderNo ?? r.projectId ?? '',
          r.lineNumber, r.lineType, lineDesc(r), lineQty(r), r.status,
        ]),
        `${tsType.toLowerCase()}-detail-${new Date().toISOString().slice(0, 10)}.csv`
      );
    }
  }

  const totalLabourMins = rows.filter((r) => r.lineType === 'LABOUR').reduce((s, r) => s + (r.qty ?? 0), 0);
  const totalDurationLabel = isProj
    ? (() => { const h = Math.floor(totalLabourMins / 60); const m = totalLabourMins % 60; return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`; })()
    : `${(totalLabourMins / 60).toFixed(1)}h`;

  return (
    <div className="page-content">
      <ReportHeader
        title={`${typeLabels[tsType]} Detail Report`}
        sub={`Line-level breakdown for ${typeLabels[tsType]} timesheets — labour, materials and equipment`}
        onBack={onBack}
        onClear={() => { setFilters(BLANK); setSubmitted(null); setSelectedEmps([]); setProjIdFilter(''); }}
        onExport={doExport}
        hasData={rows.length > 0}
      />

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        showType={false}
        onRun={() => setSubmitted({ ...filters })}
        tsType={tsType}
        employeeOptions={employeeOptions}
        selectedEmps={selectedEmps}
        onEmpsChange={setSelectedEmps}
        projIdFilter={projIdFilter}
        onProjIdChange={setProjIdFilter}
      />

      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          {(isProj
            ? [
                { label: 'Total Lines',    value: rows.length },
                { label: 'Labour Lines',   value: rows.filter((r) => r.lineType === 'LABOUR').length },
                { label: 'Total Duration', value: totalDurationLabel },
              ]
            : [
                { label: 'Total Lines',     value: rows.length },
                { label: 'Labour Lines',    value: rows.filter((r) => r.lineType === 'LABOUR').length },
                { label: 'Material Lines',  value: rows.filter((r) => r.lineType === 'MATERIAL').length },
                { label: 'Equipment Lines', value: rows.filter((r) => ['MACHINERY','VEHICLE','ACCESS','EQUIPMENT'].includes(r.lineType)).length },
                { label: 'Total Duration',  value: totalDurationLabel },
              ]
          ).map((k) => (
            <div key={k.label} className="card" style={{ marginBottom: 0, flex: 1, minWidth: 110 }}>
              <div className="card-body" style={{ padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-body" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="wip-table" style={{ minWidth: isProj ? 720 : 780 }}>
              <thead>
                <tr>
                  <th>#</th><th>Doc No</th><th>Date</th>
                  {!isProj && <th>Department</th>}
                  <th>WO / Project</th><th>Line</th>
                  {!isProj && <th>Type</th>}
                  <th>Description</th>
                  {isProj && <th>Task Type</th>}
                  {isProj && <th>Non-Project Details</th>}
                  {isProj && <th>Comments</th>}
                  <th style={{ textAlign: 'right' }}>{isProj ? 'Duration' : 'Qty / Hours'}</th>
                  {isProj && <th style={{ textAlign: 'right' }}>Mins</th>}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={colCount} style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={colCount} style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>
                    {submitted ? 'No records found.' : 'Select filters and click Run Report'}
                  </td></tr>
                ) : rows.map((r, i) => (
                  <tr key={`${r.tsDocNo}-${r.lineType}-${r.lineNumber}`}>
                    <td style={{ color: 'var(--text3)', fontSize: 11 }}>{i + 1}</td>
                    <td><span className="wip-link">{r.tsDocNo}</span></td>
                    <td>{formatDate(r.entryDate)}</td>
                    {!isProj && <td>{r.department_code ?? '—'}</td>}
                    <td>{r.workOrderNo ?? r.projectId ?? '—'}</td>
                    <td style={{ color: 'var(--text3)', fontSize: 11 }}>{r.lineNumber}</td>
                    {!isProj && <td><Badge variant={LINE_VARIANT[r.lineType] ?? 'draft'}>{LINE_LABEL[r.lineType] ?? r.lineType}</Badge></td>}
                    <td>
                      {r.lineType === 'LABOUR' ? (r.employeeName ?? r.employeeCode ?? '—') : lineDesc(r)}
                    </td>
                    {isProj && <td style={{ color: 'var(--text3)', fontSize: 11 }}>{r.taskTypeCode || '—'}</td>}
                    {isProj && (
                      <td style={{ fontSize: 11 }}>
                        {r.nonProjectRelated ? (r.nonProjectDetails || 'Non-Project') : '—'}
                      </td>
                    )}
                    {isProj && <td style={{ color: 'var(--text3)', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.comments || '—'}</td>}
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{isProj ? lineDuration(r) : lineQty(r)}</td>
                    {isProj && <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{lineMins(r)}</td>}
                    <td><Badge variant={STATUS_VARIANT[r.status] ?? 'draft'}>{r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Report Cards (main) ────────────────────────────────────────────────────────
const REPORT_CARDS = [
  { id: 'summary', icon: '📊', title: 'Timesheet Summary',   desc: 'Timesheet list with labour counts, duration and status by date range' },
  { id: 'PROD',    icon: '🔧', title: 'Production Detail',   desc: 'Line-level breakdown for Production timesheets' },
  { id: 'INST',    icon: '🏗️', title: 'Installation Detail', desc: 'Line-level breakdown for Installation timesheets' },
  { id: 'PROJ',    icon: '📁', title: 'Project Detail',      desc: 'Line-level breakdown for Project timesheets' },
];

export default function ReportsPage() {
  const [view, setView] = useState('cards'); // 'cards' | 'summary' | 'PROD' | 'INST' | 'PROJ'

  if (view === 'summary') return <SummaryReport onBack={() => setView('cards')} />;
  if (['PROD', 'INST', 'PROJ'].includes(view)) return <DetailReport tsType={view} onBack={() => setView('cards')} />;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-sub">Select a report to generate and export</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {REPORT_CARDS.map((card) => (
          <div key={card.id} className="card" style={{ marginBottom: 0, cursor: 'pointer' }}
            onClick={() => setView(card.id)}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
            <div className="card-body">
              <div style={{ fontSize: 28, marginBottom: 10 }}>{card.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{card.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{card.desc}</div>
              <span className="badge badge-approved">CSV</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
