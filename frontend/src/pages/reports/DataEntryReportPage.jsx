import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
        department: r.department_code ?? null,
        digitalTech: r.digitalTech ?? null,
        enteredBy: r.entered_by_name ?? null,
        approvedBy: r.approvedBy ?? null,
        dataEntryCompleted: Boolean(r.dataEntryCompleted),
        dataEntryCompletedAt: r.dataEntryCompletedAt ?? null,
        dataEntryCompletedBy: r.dataEntryCompletedBy ?? null,
        dataEntrySectionNotes: r.dataEntrySectionNotes ? JSON.parse(r.dataEntrySectionNotes) : {},
        labour: [],
        outsource: [],
        materials: [],
        machinery: [],
        vehicles: [],
        access: [],
      });
    }
    const g = map.get(r.tsDocNo);
    if (r.lineType === 'LABOUR') {
      const isOutsource = (r.employeeName ?? '').toLowerCase().startsWith('labour p');
      const entry = { employeeName: r.employeeName, employeeCategory: r.employeeCategory ?? null, duration: r.qty ?? 0, startTime: r.startTime ?? null, endTime: r.endTime ?? null };
      if (isOutsource) g.outsource.push(entry); else g.labour.push(entry);
    }
    if (r.lineType === 'MATERIAL')                             g.materials.push({ itemName: r.itemName, qty: r.qty, uom: r.uom });
    if (r.lineType === 'VEHICLE')                              g.vehicles.push({ name: r.itemName, km: r.hoursUsed ?? r.qty });
    if (r.lineType === 'ACCESS')                               g.access.push({ name: r.itemName, mins: r.hoursUsed ?? r.qty });
    if (r.lineType === 'MACHINERY' || (!r.lineType && r.itemName))
                                                               g.machinery.push({ name: r.itemName, hours: r.hoursUsed ?? r.qty });
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
const TH_STYLE = { padding: '4px 8px', background: 'var(--surface2)', color: 'var(--text3)', fontWeight: 600, borderBottom: '1px solid var(--border2)', fontSize: 11 };

function SubTable({ label, cols, rows, subtotal, subtotalRows, summaryCols, sectionNotes, expanded }) {
  if (rows.length === 0) return null;
  const hasNotes = sectionNotes && (sectionNotes.issue || sectionNotes.completion);

  return (
    <div style={{ marginTop: 12 }}>
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 5,
        paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{rows.length} entr{rows.length === 1 ? 'y' : 'ies'}</div>
        {hasNotes && (
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text2)', marginLeft: 4 }}>
            {sectionNotes.issue && (
              <span><span style={{ color: 'var(--text3)', fontWeight: 600 }}>Issue: </span>{sectionNotes.issue}</span>
            )}
            {sectionNotes.completion && (
              <span><span style={{ color: 'var(--text3)', fontWeight: 600 }}>Completion: </span>{sectionNotes.completion}</span>
            )}
          </div>
        )}
      </div>

      {/* Collapsed: structured summary table via summaryCols */}
      {!expanded && subtotalRows && summaryCols && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <colgroup>
            {summaryCols.map((c) => (
              <col key={c.key} style={{ width: c.width ? `${c.width}px` : 'auto' }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {summaryCols.map((c) => (
                <th key={c.key} style={{ ...TH_STYLE, textAlign: c.align ?? 'left' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subtotalRows.map((row, i) => {
              const isLast = i === subtotalRows.length - 1;
              const showSep = isLast && subtotalRows.length > 1;
              return (
                <tr key={i} style={{
                  background: isLast ? 'var(--surface2)' : undefined,
                  borderBottom: '1px solid var(--border)',
                  borderTop: showSep ? '2px solid var(--border2)' : undefined,
                  fontWeight: isLast ? 700 : 400,
                }}>
                  {summaryCols.map((c) => (
                    <td key={c.key} style={{
                      padding: '5px 8px', textAlign: c.align ?? 'left',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: c.key === 'avg'
                        ? 'var(--accent)'
                        : (isLast && c.key === 'label') ? 'var(--accent)'
                        : c.key === 'label' ? 'var(--text)' : 'var(--text2)',
                      fontWeight: c.key === 'avg' ? 700 : undefined,
                    }}>
                      {row[c.key] != null
                        ? (c.unit ? `${row[c.key]} ${c.unit}` : row[c.key])
                        : '—'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!expanded && !subtotalRows && subtotal && (
        <div style={{ padding: '5px 8px', fontSize: 12, color: 'var(--accent)', fontWeight: 600, background: 'var(--surface2)', borderRadius: 4 }}>
          {subtotal}
        </div>
      )}

      {/* Expanded: full detail table */}
      {expanded && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} style={{ ...TH_STYLE, textAlign: c.align ?? 'left' }}>
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
            {subtotalRows && subtotalRows.map((row, i) => {
              const isLast = i === subtotalRows.length - 1;
              return (
                <tr key={i} style={{ background: 'var(--surface2)', borderTop: i === 0 ? '2px solid var(--border2)' : '1px solid var(--border)' }}>
                  <td colSpan={cols.length - 1} style={{ padding: '5px 8px', fontSize: 11, fontWeight: 700,
                    color: isLast ? 'var(--accent)' : 'var(--text2)', textAlign: 'right' }}>
                    {row.label}{row.count != null ? ` · ${row.count} employee${row.count !== 1 ? 's' : ''}` : ''}
                  </td>
                  <td style={{ padding: '5px 8px', fontSize: 11, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{row.total} min / </span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>avg {row.avg}</span>
                  </td>
                </tr>
              );
            })}
            {!subtotalRows && subtotal && (
              <tr style={{ background: 'var(--surface2)', fontWeight: 600 }}>
                <td colSpan={cols.length} style={{ padding: '5px 8px', fontSize: 12, color: 'var(--accent)' }}>
                  {subtotal}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const SECTIONS = [
  { key: 'labour',    label: 'Labour',           optional: false },
  { key: 'outsource', label: 'Outsource Labour',  optional: true  },
  { key: 'materials', label: 'Materials',         optional: true  },
  { key: 'machinery', label: 'Machinery',         optional: true  },
  { key: 'vehicles',  label: 'Vehicles',          optional: true  },
  { key: 'access',    label: 'Access Equipment',  optional: true  },
];

function isGroupPartial(g) {
  return SECTIONS.some((s) => {
    const count = { labour: g.labour.length, outsource: g.outsource.length, materials: g.materials.length, machinery: g.machinery.length, vehicles: g.vehicles.length, access: g.access.length }[s.key];
    if (!count) return false;
    const n = g.dataEntrySectionNotes?.[s.key];
    return !n?.issue && !n?.completion;
  });
}

// ── Mark Complete Modal ────────────────────────────────────────────────────────
function MarkCompleteModal({ g, onConfirm, onClose, isPending }) {
  const existing = g.dataEntrySectionNotes ?? {};
  const [notes, setNotes] = useState(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.key, { issue: existing[s.key]?.issue ?? '', completion: existing[s.key]?.completion ?? '' }]))
  );

  const setNote = (key, field, val) =>
    setNotes((prev) => ({ ...prev, [key]: { ...prev[key], [field]: val } }));

  const counts = {
    labour: g.labour.length, outsource: g.outsource.length,
    materials: g.materials.length, machinery: g.machinery.length,
    vehicles: g.vehicles.length, access: g.access.length,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: 580, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', margin: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Mark Data Entry Complete</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {g.tsDocNo}{g.workOrderNo ? ` · WO: ${g.workOrderNo}` : ''}
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Section</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>WO Issue</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>WO Completion</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SECTIONS.filter((s) => counts[s.key] > 0).map((s) => {
              const count = counts[s.key];
              return (
                <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13 }}>✅</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{count} entr{count === 1 ? 'y' : 'ies'}</div>
                    </div>
                  </div>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Issue…"
                    value={notes[s.key].issue}
                    onChange={(e) => setNote(s.key, 'issue', e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                  <input
                    className="form-control form-control-sm"
                    placeholder="Completion…"
                    value={notes[s.key].completion}
                    onChange={(e) => setNote(s.key, 'completion', e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose} disabled={isPending}>Cancel</button>
          <button className="btn btn-success btn-sm" disabled={isPending} onClick={() => onConfirm({ sectionNotes: notes })}>
            {isPending ? 'Saving…' : 'Confirm Mark Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single TS group card ───────────────────────────────────────────────────────
function TSGroupCard({ g, queryKey, tsType }) {
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const isPartial = g.dataEntryCompleted && isGroupPartial(g);

  const { mutate: toggleComplete, isPending } = useMutation({
    mutationFn: ({ complete, sectionNotes }) =>
      api.patch(`/timesheets/${g.tsDocNo}/data-entry-complete`, { complete, sectionNotes }),
    onSuccess: () => { setShowModal(false); qc.invalidateQueries({ queryKey }); },
  });

  return (
    <div className="card" style={{ marginBottom: 12, borderLeft: g.dataEntryCompleted ? `3px solid ${isPartial ? '#f59e0b' : '#22c55e'}` : undefined }}>
      <div className="card-body" style={{ padding: '12px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', fontFamily: 'monospace' }}>{g.tsDocNo}</span>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{formatDate(g.entryDate)}</span>
          {g.workOrderNo && (
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>WO: <strong style={{ color: 'var(--text)' }}>{g.workOrderNo}</strong></span>
          )}
          <Badge variant={STATUS_VARIANT[g.status] ?? 'draft'} style={{ fontSize: 10 }}>{g.status}</Badge>
        </div>

        {/* Meta row: Department · Digital Tech · Entry Person · Approver */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 8, fontSize: 11, color: 'var(--text3)' }}>
          {g.department && (
            <span><span style={{ fontWeight: 600 }}>Dept: </span><span style={{ color: 'var(--text2)' }}>{g.department}</span></span>
          )}
          {g.digitalTech && (
            <span><span style={{ fontWeight: 600 }}>Digital Tech: </span>
              <span style={{ color: g.digitalTech === 'Yes' ? 'var(--accent)' : 'var(--text2)', fontWeight: g.digitalTech === 'Yes' ? 700 : 400 }}>{g.digitalTech}</span>
            </span>
          )}
          {g.enteredBy && (
            <span><span style={{ fontWeight: 600 }}>Entry: </span><span style={{ color: 'var(--text2)' }}>{g.enteredBy}</span></span>
          )}
          {g.approvedBy && (
            <span><span style={{ fontWeight: 600 }}>Approver: </span><span style={{ color: 'var(--text2)' }}>{g.approvedBy}</span></span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {g.dataEntryCompleted && (
              <span style={{ fontSize: 11, fontWeight: 600, color: isPartial ? '#f59e0b' : '#22c55e' }}>
                {isPartial ? '⚠ Partially Complete' : '✓ Data Entry Completed'}
                {g.dataEntryCompletedBy ? ` by ${g.dataEntryCompletedBy}` : ''}
                {!isPartial && g.dataEntryCompletedAt ? ` · ${formatDate(g.dataEntryCompletedAt)}` : ''}
              </span>
            )}
            <button
              className={`btn btn-sm ${!g.dataEntryCompleted ? 'btn-success' : isPartial ? 'btn-warning' : 'btn-outline'}`}
              disabled={isPending}
              onClick={() => {
                if (!g.dataEntryCompleted || isPartial) setShowModal(true);
                else toggleComplete({ complete: false });
              }}
              style={{ fontSize: 11, padding: '3px 10px' }}>
              {isPending ? '…' : !g.dataEntryCompleted ? 'Mark Complete' : isPartial ? 'Update & Complete' : 'Unmark Complete'}
            </button>
          </div>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button type="button" onClick={() => setExpanded((v) => !v)}
            style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, padding: '2px 4px' }}>
            {expanded ? '▲ Hide Details' : '▼ Show Details'}
          </button>
        </div>

        {/* Labour */}
        {(() => {
          const showCategory = tsType === 'INST' || tsType === 'INSTD';
          const labourCols = [
            { key: 'sno',              label: '#',               align: 'right' },
            { key: 'employeeName',     label: 'Employee' },
            ...(showCategory ? [{ key: 'employeeCategory', label: 'Category' }] : []),
            { key: 'startTime',        label: 'Start' },
            { key: 'endTime',          label: 'End' },
            { key: 'durationFmt',      label: 'Duration (mins)', align: 'right' },
          ];

          let subtotalRows = null;
          if (g.labour.length > 0) {
            if (showCategory) {
              const catMap = new Map();
              for (const l of g.labour) {
                const cat = l.employeeCategory || 'Uncategorised';
                if (!catMap.has(cat)) catMap.set(cat, { count: 0, total: 0 });
                const c = catMap.get(cat);
                c.count += 1;
                c.total += Number(l.duration) || 0;
              }
              subtotalRows = [...catMap.entries()].map(([cat, { count, total }]) => ({
                label: cat, count, total, avg: count > 0 ? Math.round(total / count) : 0,
              }));
              subtotalRows.push({
                label: 'Overall', count: g.labour.length, total: g.totalDuration, avg: g.avgDuration,
              });
            } else {
              subtotalRows = [{
                count: g.labour.length, total: g.totalDuration, avg: g.avgDuration,
              }];
            }
          }

          const labourSummaryCols = showCategory ? [
            { key: 'label', label: 'Category' },
            { key: 'count', label: 'Employees', align: 'right', width: 90 },
            { key: 'total', label: 'Total',     align: 'right', width: 90, unit: 'min' },
            { key: 'avg',   label: 'Avg',       align: 'right', width: 80, unit: 'min' },
          ] : [
            { key: 'count', label: 'Employees', align: 'right', width: 90 },
            { key: 'total', label: 'Total',     align: 'right', width: 90, unit: 'min' },
            { key: 'avg',   label: 'Avg',       align: 'right', width: 80, unit: 'min' },
          ];

          return (
            <SubTable
              label="Labour"
              sectionNotes={g.dataEntryCompleted ? g.dataEntrySectionNotes?.labour : null}
              cols={labourCols}
              rows={g.labour.map((l, i) => ({
                sno:              i + 1,
                employeeName:     l.employeeName ?? '—',
                employeeCategory: l.employeeCategory ?? '—',
                startTime:        l.startTime ?? '—',
                endTime:          l.endTime ?? '—',
                durationFmt:      l.duration ?? 0,
              }))}
              subtotalRows={subtotalRows}
              summaryCols={labourSummaryCols}
              expanded={expanded}
            />
          );
        })()}

        {/* Outsource Labour */}
        {(() => {
          const outCatMap = new Map();
          for (const l of g.outsource) {
            const cat = l.employeeCategory || 'Labour Supply';
            if (!outCatMap.has(cat)) outCatMap.set(cat, { count: 0, total: 0 });
            const c = outCatMap.get(cat);
            c.count += 1;
            c.total += Number(l.duration) || 0;
          }
          const outsourceSubtotalRows = [...outCatMap.entries()].map(([cat, { count, total }]) => ({
            label: cat, count, total, avg: count > 0 ? Math.round(total / count) : 0,
          }));
          if (outsourceSubtotalRows.length > 1) {
            outsourceSubtotalRows.push({
              label: 'Overall', count: g.outsource.length, total: g.outsourceTotalDuration, avg: g.outsourceAvgDuration,
            });
          }
          return (
            <SubTable
              label="Outsource Labour"
              sectionNotes={g.dataEntryCompleted ? g.dataEntrySectionNotes?.outsource : null}
              cols={[
                { key: 'sno',         label: '#',                align: 'right' },
                { key: 'employeeName',label: 'Name / Description' },
                { key: 'startTime',   label: 'Start' },
                { key: 'endTime',     label: 'End' },
                { key: 'durationFmt', label: 'Duration (mins)',   align: 'right' },
              ]}
              rows={g.outsource.map((l, i) => ({
                sno:          i + 1,
                employeeName: l.employeeName ?? '—',
                startTime:    l.startTime ?? '—',
                endTime:      l.endTime ?? '—',
                durationFmt:  l.duration ?? 0,
              }))}
              subtotalRows={g.outsource.length > 0 ? outsourceSubtotalRows : null}
              summaryCols={[
                { key: 'label', label: 'Category' },
                { key: 'count', label: 'Count',  align: 'right', width: 70 },
                { key: 'total', label: 'Total',  align: 'right', width: 90, unit: 'min' },
                { key: 'avg',   label: 'Avg',    align: 'right', width: 80, unit: 'min' },
              ]}
              expanded={expanded}
            />
          );
        })()}

        {/* Materials — always show rows */}
        <SubTable
          label="Materials"
          sectionNotes={g.dataEntryCompleted ? g.dataEntrySectionNotes?.materials : null}
          cols={[
            { key: 'itemName', label: 'Item' },
            { key: 'qty',      label: 'Qty', align: 'right' },
            { key: 'uom',      label: 'UOM' },
          ]}
          rows={g.materials}
          expanded={true}
        />

        {/* Machinery — always show rows */}
        <SubTable
          label="Machinery"
          sectionNotes={g.dataEntryCompleted ? g.dataEntrySectionNotes?.machinery : null}
          cols={[
            { key: 'name',  label: 'Machine' },
            { key: 'hours', label: 'Hours', align: 'right' },
          ]}
          rows={g.machinery}
          expanded={true}
        />

        {/* Vehicles */}
        {(() => {
          const vTotal = g.vehicles.reduce((s, v) => s + (Number(v.km) || 0), 0);
          const vAvg   = g.vehicles.length > 0 ? Math.round(vTotal / g.vehicles.length) : 0;
          return (
            <SubTable
              label="Vehicles"
              sectionNotes={g.dataEntryCompleted ? g.dataEntrySectionNotes?.vehicles : null}
              cols={[
                { key: 'name', label: 'Vehicle' },
                { key: 'km',   label: 'KM', align: 'right' },
              ]}
              rows={g.vehicles}
              subtotalRows={g.vehicles.length > 0 ? [{ count: g.vehicles.length, total: vTotal, avg: vAvg }] : null}
              summaryCols={[
                { key: 'count', label: 'Vehicles', align: 'right', width: 80 },
                { key: 'total', label: 'Total',    align: 'right', width: 90, unit: 'KM' },
                { key: 'avg',   label: 'Avg',      align: 'right', width: 80, unit: 'KM' },
              ]}
              subtotal={null}
              expanded={expanded}
            />
          );
        })()}

        {/* Access Equipment — always show rows */}
        <SubTable
          label="Access Equipment"
          sectionNotes={g.dataEntryCompleted ? g.dataEntrySectionNotes?.access : null}
          cols={[
            { key: 'name', label: 'Equipment' },
            { key: 'mins', label: 'Mins', align: 'right' },
          ]}
          rows={g.access}
          expanded={true}
        />
      </div>

      {showModal && (
        <MarkCompleteModal
          g={g}
          isPending={isPending}
          onClose={() => setShowModal(false)}
          onConfirm={({ sectionNotes }) => toggleComplete({ complete: true, sectionNotes })}
        />
      )}
    </div>
  );
}

// ── Tab report panel ───────────────────────────────────────────────────────────
function TabReport({ tsType }) {
  const BLANK = { dateFrom: '', dateTo: '', workOrderNo: '' };
  const [filters, setFilters] = useState(BLANK);
  const [queueStatus, setQueueStatus] = useState('all');
  const [submitted, setSubmitted] = useState(null);
  const [view, setView] = useState('queue');

  // Completed tab has its own date range
  const [cFilters, setCFilters] = useState(BLANK);
  const [cSubmitted, setCSubmitted] = useState(null);

  // INSTD maps to tsType=INST with digitalTech=Yes; INST maps to tsType=INST with digitalTech=No
  const apiType      = tsType === 'INSTD' ? 'INST' : tsType;
  const digitalTech  = tsType === 'INST' ? 'No' : tsType === 'INSTD' ? 'Yes' : undefined;

  const queueKey = ['data-entry-report-queue', tsType, submitted];
  const { data: queueRaw = [], isLoading: queueLoading } = useQuery({
    queryKey: queueKey,
    queryFn: () => api.get('/timesheets/report-detail', {
      params: { type: apiType, status: 'Approved', dataEntryCompleted: 'false', digitalTech, ...submitted },
    }).then((r) => r.data),
    enabled: Boolean(submitted),
  });

  const completedKey = ['data-entry-report-completed', tsType, cSubmitted];
  const { data: completedRaw = [], isLoading: completedLoading } = useQuery({
    queryKey: completedKey,
    queryFn: () => api.get('/timesheets/report-detail', {
      params: {
        type: apiType, status: 'Approved', dataEntryCompleted: 'true', digitalTech,
        completedDateFrom: cSubmitted?.dateFrom,
        completedDateTo: cSubmitted?.dateTo,
        workOrderNo: cSubmitted?.workOrderNo,
      },
    }).then((r) => r.data),
    enabled: Boolean(cSubmitted),
  });

  // Queue includes partially complete (dataEntryCompleted=true but partial) — fetch them separately
  const partialKey = ['data-entry-report-partial', tsType, submitted];
  const { data: partialRaw = [] } = useQuery({
    queryKey: partialKey,
    queryFn: () => api.get('/timesheets/report-detail', {
      params: { type: apiType, status: 'Approved', dataEntryCompleted: 'true', digitalTech, ...submitted },
    }).then((r) => r.data),
    enabled: Boolean(submitted),
  });

  const queueGroups = groupRows(queueRaw);
  const partialGroups = groupRows(partialRaw).filter((g) => isGroupPartial(g));
  const mergedQueue = [...queueGroups, ...partialGroups].sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1));
  const allQueueGroups = queueStatus === 'not-started'
    ? mergedQueue.filter((g) => !g.dataEntryCompleted)
    : queueStatus === 'partial'
    ? mergedQueue.filter((g) => g.dataEntryCompleted && isGroupPartial(g))
    : mergedQueue;

  const completedGroups = groupRows(completedRaw).filter((g) => !isGroupPartial(g));

  const visibleGroups = view === 'queue' ? allQueueGroups : completedGroups;
  const visibleQueryKey = view === 'queue' ? queueKey : completedKey;
  const isLoading = view === 'queue' ? queueLoading : completedLoading;

  return (
    <>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
        {[
          { key: 'queue',     label: 'Queue',    count: submitted ? allQueueGroups.length : null, color: '#f59e0b' },
          { key: 'completed', label: 'Completed', count: cSubmitted ? completedGroups.length : null, color: '#22c55e' },
        ].map((t) => (
          <button key={t.key} type="button" onClick={() => setView(t.key)}
            style={{
              padding: '8px 18px', fontSize: 12, fontWeight: 600, background: 'transparent',
              border: 'none', cursor: 'pointer', marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6,
              borderBottom: `3px solid ${view === t.key ? 'var(--accent)' : 'transparent'}`,
              color: view === t.key ? 'var(--accent)' : 'var(--text3)',
            }}>
            {t.label}
            {t.count !== null && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                background: view === t.key ? 'var(--accent)' : 'var(--surface2)',
                color: view === t.key ? '#fff' : t.color,
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
        {visibleGroups.length > 0 && (
          <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto', marginBottom: 4, fontSize: 11 }}
            onClick={() => exportCSV(visibleGroups)}>
            Export CSV
          </button>
        )}
      </div>

      {/* Queue filters */}
      {view === 'queue' && (
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
                <label className="form-label">Work Order #</label>
                <input className="form-control form-control-sm" placeholder="Work Order No" value={filters.workOrderNo}
                  onChange={(e) => setFilters((f) => ({ ...f, workOrderNo: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Data Entry Status</label>
                <select className="form-control form-control-sm" value={queueStatus} onChange={(e) => setQueueStatus(e.target.value)}>
                  <option value="all">All Pending</option>
                  <option value="not-started">Not Started</option>
                  <option value="partial">Partially Completed</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setSubmitted({ ...filters })}>
                  Load Queue
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => { setFilters(BLANK); setSubmitted(null); setQueueStatus('all'); }}>Clear</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completed filters */}
      {view === 'completed' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, alignItems: 'end' }}>
              <div>
                <label className="form-label">Completed From <span style={{ color: 'var(--danger, #ef4444)', fontSize: 10 }}>*</span></label>
                <input type="date" className="form-control form-control-sm" value={cFilters.dateFrom}
                  onChange={(e) => setCFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Completed To <span style={{ color: 'var(--danger, #ef4444)', fontSize: 10 }}>*</span></label>
                <input type="date" className="form-control form-control-sm" value={cFilters.dateTo}
                  onChange={(e) => setCFilters((f) => ({ ...f, dateTo: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Work Order #</label>
                <input className="form-control form-control-sm" placeholder="Work Order No" value={cFilters.workOrderNo}
                  onChange={(e) => setCFilters((f) => ({ ...f, workOrderNo: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }}
                  disabled={!cFilters.dateFrom || !cFilters.dateTo}
                  onClick={() => setCSubmitted({ ...cFilters })}>
                  Load Completed
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => { setCFilters(BLANK); setCSubmitted(null); }}>Clear</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Loading…
        </div>
      )}

      {!isLoading && view === 'queue' && !submitted && (
        <div className="card"><div className="card-body" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          Select filters and click Load Queue
        </div></div>
      )}
      {!isLoading && view === 'completed' && !cSubmitted && (
        <div className="card"><div className="card-body" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          Select a date range and click Load Completed
        </div></div>
      )}
      {!isLoading && ((view === 'queue' && submitted) || (view === 'completed' && cSubmitted)) && visibleGroups.length === 0 && (
        <div className="card"><div className="card-body" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          {view === 'queue' ? 'No pending timesheets — all done!' : 'No completed timesheets for the selected period.'}
        </div></div>
      )}
      {!isLoading && visibleGroups.map((g) => <TSGroupCard key={g.tsDocNo} g={g} queryKey={visibleQueryKey} tsType={tsType} />)}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DataEntryReportPage({ tsType }) {
  const title = tsType === 'INST' ? 'Data Entry — Installation' : tsType === 'INSTD' ? 'Data Entry — Installation Digital' : 'Data Entry — Production';
  const sub   = tsType === 'INST' ? 'Installation timesheets' : tsType === 'INSTD' ? 'Installation Digital timesheets' : 'Production timesheets';

  return (
    <div className="page-content">
      <div className="wip-list-header">
        <div>
          <div className="wip-list-title">{title}</div>
          <div className="wip-list-sub">{sub} — grouped by timesheet · employees, materials, vehicles &amp; access equipment</div>
        </div>
      </div>
      <TabReport tsType={tsType} />
    </div>
  );
}
