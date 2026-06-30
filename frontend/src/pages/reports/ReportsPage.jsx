import { useState } from 'react';
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

// ── Filter bar shared by both reports ─────────────────────────────────────────
function FilterBar({ filters, setFilters, onRun, showType = true }) {
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
          <div>
            <label className="form-label">Department</label>
            <input className="form-control form-control-sm" placeholder="Dept code" value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))} />
          </div>
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
  const BLANK = { dateFrom: '', dateTo: '', status: '', department: '' };
  const [filters, setFilters] = useState(BLANK);
  const [submitted, setSubmitted] = useState(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['rpt-detail', tsType, submitted],
    queryFn: () => api.get('/timesheets/report-detail', { params: { type: tsType, ...submitted } }).then((r) => r.data),
    enabled: Boolean(submitted),
  });

  function lineDesc(r) {
    if (r.lineType === 'LABOUR')                            return r.employeeName ?? r.employeeCode ?? '—';
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

  function doExport() {
    exportCSV(
      ['Doc No', 'Date', 'Department', 'WO / Project', 'Line', 'Type', 'Description', 'Qty / Hours', 'Status'],
      rows.map((r) => [
        r.tsDocNo, r.entryDate, r.department_code, r.workOrderNo ?? r.projectId ?? '',
        r.lineNumber, r.lineType, lineDesc(r), lineQty(r), r.status,
      ]),
      `${tsType.toLowerCase()}-detail-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  return (
    <div className="page-content">
      <ReportHeader
        title={`${typeLabels[tsType]} Detail Report`}
        sub={`Line-level breakdown for ${typeLabels[tsType]} timesheets — labour, materials and equipment`}
        onBack={onBack}
        onClear={() => { setFilters(BLANK); setSubmitted(null); }}
        onExport={doExport}
        hasData={rows.length > 0}
      />

      <FilterBar filters={filters} setFilters={setFilters} showType={false} onRun={() => setSubmitted({ ...filters })} />

      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Lines',     value: rows.length },
            { label: 'Labour Lines',    value: rows.filter((r) => r.lineType === 'LABOUR').length },
            { label: 'Material Lines',  value: rows.filter((r) => r.lineType === 'MATERIAL').length },
            { label: 'Equipment Lines', value: rows.filter((r) => ['MACHINERY','VEHICLE','ACCESS','EQUIPMENT'].includes(r.lineType)).length },
            { label: 'Total Duration',  value: `${(rows.filter((r) => r.lineType === 'LABOUR').reduce((s, r) => s + (r.qty ?? 0), 0) / 60).toFixed(1)}h` },
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
            <table className="wip-table" style={{ minWidth: 780 }}>
              <thead>
                <tr>
                  <th>#</th><th>Doc No</th><th>Date</th><th>Department</th>
                  <th>WO / Project</th><th>Line</th><th>Type</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Qty / Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>
                    {submitted ? 'No records found.' : 'Select filters and click Run Report'}
                  </td></tr>
                ) : rows.map((r, i) => (
                  <tr key={`${r.tsDocNo}-${r.lineType}-${r.lineNumber}`}>
                    <td style={{ color: 'var(--text3)', fontSize: 11 }}>{i + 1}</td>
                    <td><span className="wip-link">{r.tsDocNo}</span></td>
                    <td>{formatDate(r.entryDate)}</td>
                    <td>{r.department_code ?? '—'}</td>
                    <td>{r.workOrderNo ?? r.projectId ?? '—'}</td>
                    <td style={{ color: 'var(--text3)', fontSize: 11 }}>{r.lineNumber}</td>
                    <td><Badge variant={LINE_VARIANT[r.lineType] ?? 'draft'}>{LINE_LABEL[r.lineType] ?? r.lineType}</Badge></td>
                    <td>{lineDesc(r)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{lineQty(r)}</td>
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
