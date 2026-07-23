import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import Badge from '../../components/ui/Badge';
import { formatDate } from '../../utils/format';

const STATUS_VARIANT = { Draft: 'draft', Submitted: 'submitted', Approved: 'approved', Rejected: 'rejected' };

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(groups) {
  const rows = [
    ['Doc No', 'Type', 'Status', 'Section', 'Date', 'Work Order', 'Employee / Item', 'Qty / Duration (mins)', 'UOM / Unit'],
  ];
  for (const g of groups) {
    const hdr = [g.tsDocNo, g.tsType, g.status];
    for (const l of g.labour) {
      rows.push([...hdr, 'Labour', g.entryDate, g.workOrderNo ?? '', l.employeeName ?? '', l.duration ?? 0, 'mins']);
    }
    if (g.labour.length > 0) {
      rows.push([...hdr, 'Labour Subtotal', '', '', `${g.labour.length} employees`, `Avg ${g.avgDuration} mins`, '']);
    }
    for (const l of g.outsource) {
      rows.push([...hdr, 'Outsource Labour', g.entryDate, g.workOrderNo ?? '', l.employeeName ?? '', l.duration ?? 0, 'mins']);
    }
    if (g.outsource.length > 0) {
      rows.push([...hdr, 'Outsource Subtotal', '', '', `${g.outsource.length} entries`, `Avg ${g.outsourceAvgDuration} mins`, '']);
    }
    for (const m of g.materials) {
      rows.push([...hdr, 'Material', g.entryDate, g.workOrderNo ?? '', m.itemName ?? '', m.qty ?? '', m.uom ?? '']);
    }
    for (const v of g.vehicles) {
      rows.push([...hdr, 'Vehicle', g.entryDate, g.workOrderNo ?? '', v.name ?? '', v.km ?? '', 'km']);
    }
    for (const a of g.access) {
      rows.push([...hdr, 'Access Equipment', g.entryDate, g.workOrderNo ?? '', a.name ?? '', a.mins ?? '', 'mins']);
    }
  }
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `data-entry-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ── Group flat rows by tsDocNo ─────────────────────────────────────────────
function groupRows(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.tsDocNo)) {
      map.set(r.tsDocNo, {
        tsDocNo: r.tsDocNo,
        tsType: r.tsType,
        entryDate: r.entryDate,
        workOrderNo: r.workOrderNo,
        status: r.status,
        labour: [],
        outsource: [],
        materials: [],
        vehicles: [],
        access: [],
      });
    }
    const g = map.get(r.tsDocNo);
    if (r.lineType === 'LABOUR') {
      const isOutsource = (r.employeeName ?? '').toLowerCase().startsWith('labour p');
      const entry = { employeeName: r.employeeName, duration: r.qty ?? 0 };
      if (isOutsource) g.outsource.push(entry); else g.labour.push(entry);
    }
    if (r.lineType === 'MATERIAL') g.materials.push({ itemName: r.itemName, qty: r.qty, uom: r.uom });
    if (r.lineType === 'VEHICLE')  g.vehicles.push({ name: r.itemName, km: r.hoursUsed ?? r.qty });
    if (r.lineType === 'ACCESS')   g.access.push({ name: r.itemName, mins: r.hoursUsed ?? r.qty });
  }
  for (const g of map.values()) {
    const total = g.labour.reduce((s, l) => s + (Number(l.duration) || 0), 0);
    g.avgDuration = g.labour.length > 0 ? Math.round(total / g.labour.length) : 0;
    g.totalDuration = total;
    const outTotal = g.outsource.reduce((s, l) => s + (Number(l.duration) || 0), 0);
    g.outsourceAvgDuration = g.outsource.length > 0 ? Math.round(outTotal / g.outsource.length) : 0;
    g.outsourceTotalDuration = outTotal;
  }
  return [...map.values()];
}

// ── Sub-table ─────────────────────────────────────────────────────────────────
function SubTable({ label, cols, rows, subtotal }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} style={{ textAlign: c.align ?? 'left', padding: '4px 8px', background: 'var(--surface2)', color: 'var(--text3)', fontWeight: 600, borderBottom: '1px solid var(--border2)', fontSize: 11 }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              {cols.map((c) => (
                <td key={c.key} style={{ padding: '5px 8px', textAlign: c.align ?? 'left', color: 'var(--text)' }}>
                  {row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
          {subtotal && (
            <tr style={{ background: 'var(--surface2)', fontWeight: 600 }}>
              <td colSpan={cols.length} style={{ padding: '5px 8px', fontSize: 12, color: 'var(--accent)' }}>
                {subtotal}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Single TS group card ───────────────────────────────────────────────────────
function TSGroupCard({ g }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-body" style={{ padding: '12px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', fontFamily: 'monospace' }}>{g.tsDocNo}</span>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{formatDate(g.entryDate)}</span>
          {g.workOrderNo && (
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>WO: <strong style={{ color: 'var(--text)' }}>{g.workOrderNo}</strong></span>
          )}
          <Badge variant="info" style={{ fontSize: 10 }}>{g.tsType}</Badge>
          <Badge variant={STATUS_VARIANT[g.status] ?? 'draft'}>{g.status}</Badge>
        </div>

        {/* Labour */}
        <SubTable
          label="Labour"
          cols={[
            { key: 'date',         label: 'Date' },
            { key: 'workOrderNo',  label: 'Work Order' },
            { key: 'employeeName', label: 'Employee' },
            { key: 'durationFmt',  label: 'Duration (mins)', align: 'right' },
          ]}
          rows={g.labour.map((l) => ({
            date:         formatDate(g.entryDate),
            workOrderNo:  g.workOrderNo ?? '—',
            employeeName: l.employeeName ?? '—',
            durationFmt:  l.duration ?? 0,
          }))}
          subtotal={g.labour.length > 0
            ? `${g.labour.length} employee${g.labour.length > 1 ? 's' : ''} · Total ${g.totalDuration} mins · Avg ${g.avgDuration} mins`
            : null}
        />

        {/* Outsource Labour */}
        <SubTable
          label="Outsource Labour"
          cols={[
            { key: 'date',         label: 'Date' },
            { key: 'workOrderNo',  label: 'Work Order' },
            { key: 'employeeName', label: 'Name / Description' },
            { key: 'durationFmt',  label: 'Duration (mins)', align: 'right' },
          ]}
          rows={g.outsource.map((l) => ({
            date:         formatDate(g.entryDate),
            workOrderNo:  g.workOrderNo ?? '—',
            employeeName: l.employeeName ?? '—',
            durationFmt:  l.duration ?? 0,
          }))}
          subtotal={g.outsource.length > 0
            ? `${g.outsource.length} outsource${g.outsource.length > 1 ? ' entries' : ' entry'} · Total ${g.outsourceTotalDuration} mins · Avg ${g.outsourceAvgDuration} mins`
            : null}
        />

        {/* Materials */}
        <SubTable
          label="Materials"
          cols={[
            { key: 'itemName', label: 'Item' },
            { key: 'qty',      label: 'Qty', align: 'right' },
            { key: 'uom',      label: 'UOM' },
          ]}
          rows={g.materials}
        />

        {/* Vehicles */}
        <SubTable
          label="Vehicles"
          cols={[
            { key: 'name', label: 'Vehicle' },
            { key: 'km',   label: 'KM', align: 'right' },
          ]}
          rows={g.vehicles}
        />

        {/* Access Equipment */}
        <SubTable
          label="Access Equipment"
          cols={[
            { key: 'name', label: 'Equipment' },
            { key: 'mins', label: 'Mins', align: 'right' },
          ]}
          rows={g.access}
        />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DataEntryReportPage() {
  const BLANK = { dateFrom: '', dateTo: '', type: '', status: '', workOrderNo: '' };
  const [filters, setFilters] = useState(BLANK);
  const [submitted, setSubmitted] = useState(null);

  const { data: raw = [], isLoading } = useQuery({
    queryKey: ['data-entry-report', submitted],
    queryFn: () => api.get('/timesheets/report-detail', { params: submitted }).then((r) => r.data),
    enabled: Boolean(submitted),
  });

  const groups = groupRows(raw);

  const totals = groups.reduce(
    (acc, g) => ({
      sheets: acc.sheets + 1,
      employees: acc.employees + g.labour.length,
      duration: acc.duration + g.totalDuration,
      materials: acc.materials + g.materials.length,
      vehicles: acc.vehicles + g.vehicles.length,
      access: acc.access + g.access.length,
    }),
    { sheets: 0, employees: 0, duration: 0, materials: 0, vehicles: 0, access: 0 }
  );

  return (
    <div className="page-content">
      {/* Page header */}
      <div className="wip-list-header">
        <div>
          <div className="wip-list-title">Data Entry Report</div>
          <div className="wip-list-sub">Grouped by timesheet — employees, materials, vehicles &amp; access equipment</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => { setFilters(BLANK); setSubmitted(null); }}>Clear</button>
          <button className="btn btn-primary btn-sm" disabled={groups.length === 0} onClick={() => exportCSV(groups)}>Export CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, alignItems: 'end' }}>
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
            <div>
              <label className="form-label">Type</label>
              <select className="form-control form-control-sm" value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
                <option value="">All Types</option>
                <option value="PROD">Production</option>
                <option value="INST">Installation</option>
                <option value="PROJ">Project</option>
              </select>
            </div>
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
              <label className="form-label">Work Order #</label>
              <input className="form-control form-control-sm" placeholder="Work Order No" value={filters.workOrderNo}
                onChange={(e) => setFilters((f) => ({ ...f, workOrderNo: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" style={{ width: '100%' }}
                onClick={() => setSubmitted({ ...filters })}>
                Run Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      {groups.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Timesheets',  value: totals.sheets },
            { label: 'Employees',   value: totals.employees },
            { label: 'Total Mins',  value: totals.duration },
            { label: 'Materials',   value: totals.materials },
            { label: 'Vehicles',    value: totals.vehicles },
            { label: 'Access Equip', value: totals.access },
          ].map((k) => (
            <div key={k.label} className="card" style={{ marginBottom: 0, flex: 1, minWidth: 100 }}>
              <div className="card-body" style={{ padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Loading…
        </div>
      )}

      {!isLoading && submitted && groups.length === 0 && (
        <div className="card">
          <div className="card-body" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            No timesheets match the selected filters.
          </div>
        </div>
      )}

      {!isLoading && !submitted && (
        <div className="card">
          <div className="card-body" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            Select filters and click Run Report
          </div>
        </div>
      )}

      {!isLoading && groups.map((g) => <TSGroupCard key={g.tsDocNo} g={g} />)}
    </div>
  );
}
