import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { useAuthStore } from '../../store/authStore';

// ── Helpers ────────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function timeToMins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minsToLabel(m) {
  if (!m) return '0m';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? (min > 0 ? `${h}h ${min}m` : `${h}h`) : `${min}m`;
}

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Deterministic color per WO key — module-level so colors stay stable across re-renders
const PALETTE = [
  { bg: 'rgba(196,125,40,0.22)',  border: '#c47d28', text: '#7a4e10' },
  { bg: 'rgba(45,122,79,0.20)',   border: '#2d7a4f', text: '#1a5030' },
  { bg: 'rgba(37,99,168,0.20)',   border: '#2563a8', text: '#163c70' },
  { bg: 'rgba(184,50,50,0.20)',   border: '#b83232', text: '#7a1818' },
  { bg: 'rgba(128,90,200,0.20)',  border: '#7c5ab8', text: '#4a2880' },
  { bg: 'rgba(20,150,160,0.20)',  border: '#14969f', text: '#0a6068' },
  { bg: 'rgba(180,130,40,0.22)',  border: '#b48228', text: '#705010' },
  { bg: 'rgba(80,140,60,0.20)',   border: '#508c3c', text: '#305820' },
];
const colorCache = {};
function getColor(key) {
  if (!colorCache[key]) {
    colorCache[key] = PALETTE[Object.keys(colorCache).length % PALETTE.length];
  }
  return colorCache[key];
}

// ── Constants ────────────────────────────────────────────────────────────────
const LEFT_W    = 210;  // px — employee panel width
const HDR_H     = 48;   // px — time ruler height
const LANE_H    = 34;   // px — height of one task lane
const LANE_PAD  = 8;    // px — top/bottom padding inside a row

function rowHeightForLanes(n) {
  return LANE_PAD * 2 + Math.max(1, n) * LANE_H;
}

// Assign each task to a non-overlapping vertical lane.
// Returns tasks enriched with { lane, _startMins, _endMins, _offset? }.
function computeTaskLanes(tasks, rangeStart) {
  // Resolve sequential offset for tasks without startTime
  let seqOffset = rangeStart;
  const placed = tasks.map(t => {
    if (!t.startTime) {
      const o = seqOffset;
      seqOffset += Math.max(t.durationMinutes, 15) + 5;
      return { ...t, _offset: o };
    }
    return t;
  });

  // Sort by resolved start time so earlier tasks claim lower lanes first
  const sorted = [...placed].sort((a, b) => {
    const sa = a.startTime ? (timeToMins(a.startTime) ?? a._offset) : a._offset;
    const sb = b.startTime ? (timeToMins(b.startTime) ?? b._offset) : b._offset;
    return sa - sb;
  });

  const laneEnds = []; // laneEnds[i] = resolved end-minute of last task in lane i
  return sorted.map(t => {
    const start  = t.startTime ? (timeToMins(t.startTime) ?? t._offset ?? rangeStart) : (t._offset ?? rangeStart);
    const rawEnd = t.endTime   ? timeToMins(t.endTime)   : null;

    let end;
    if (t.isContinuation) {
      // Continuation of an overnight task — bar starts at 0 (midnight), ends at actual endTime
      end = rawEnd !== null ? rawEnd : Math.max(t.durationMinutes, 15);
    } else if (rawEnd !== null && rawEnd < start) {
      // Overnight task on entry date — clip bar at midnight
      end = 1440;
    } else if (rawEnd !== null && rawEnd > start) {
      end = rawEnd;
    } else {
      end = start + Math.max(t.durationMinutes, 15);
    }

    let lane = laneEnds.findIndex(e => e <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;

    return { ...t, lane, _startMins: start, _endMins: end };
  });
}

function toHHMM(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  if (h === 0 && m === 0) return '12 AM';
  if (h === 12 && m === 0) return '12 PM';
  if (h < 12) return m === 0 ? `${h} AM` : `${h}:${String(m).padStart(2, '0')} AM`;
  return m === 0 ? `${h - 12} PM` : `${h - 12}:${String(m).padStart(2, '0')} PM`;
}

// position of a time value within [rangeStart, rangeEnd] as a percentage
function pct(mins, rangeStart, rangeDur) {
  return ((mins - rangeStart) / rangeDur) * 100;
}

// ── TimelineRuler ─────────────────────────────────────────────────────────────
function TimelineRuler({ rangeStart, rangeEnd }) {
  const rangeDur = rangeEnd - rangeStart;

  // Tick every 30 mins, label every 60 mins
  const ticks = [];
  for (let m = rangeStart; m <= rangeEnd; m += 30) ticks.push(m);
  const labels = ticks.filter(m => m % 60 === 0);

  // Shift bands clipped to range
  const dayStart  = Math.max(rangeStart, 8 * 60);
  const dayEnd    = Math.min(rangeEnd,   17 * 60);
  const nightStart = Math.max(rangeStart, 20 * 60);
  const nightEnd   = Math.min(rangeEnd,   28 * 60); // 28*60 = 4 AM next day

  return (
    <div style={{ position: 'relative', height: HDR_H, borderBottom: '2px solid var(--border2)', background: 'var(--surface2)', flexShrink: 0 }}>
      {/* Day shift band */}
      {dayEnd > dayStart && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct(dayStart, rangeStart, rangeDur)}%`, width: `${((dayEnd - dayStart) / rangeDur) * 100}%`, background: 'rgba(196,125,40,0.08)', borderLeft: '1px solid rgba(196,125,40,0.25)', borderRight: '1px solid rgba(196,125,40,0.25)' }} />
      )}
      {/* Night shift band */}
      {nightEnd > nightStart && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct(nightStart, rangeStart, rangeDur)}%`, width: `${((nightEnd - nightStart) / rangeDur) * 100}%`, background: 'rgba(37,99,168,0.07)', borderLeft: '1px solid rgba(37,99,168,0.2)', borderRight: '1px solid rgba(37,99,168,0.2)' }} />
      )}
      {/* Hour labels */}
      {labels.map(m => (
        <div key={m} style={{ position: 'absolute', bottom: 4, left: `${pct(m, rangeStart, rangeDur)}%`, transform: 'translateX(-50%)', fontSize: 10, color: 'var(--text3)', userSelect: 'none', whiteSpace: 'nowrap' }}>
          {toHHMM(m)}
        </div>
      ))}
      {/* Tick marks */}
      {ticks.map(m => (
        <div key={`tk${m}`} style={{ position: 'absolute', bottom: 0, top: m % 60 === 0 ? '55%' : '75%', left: `${pct(m, rangeStart, rangeDur)}%`, width: 1, background: m % 60 === 0 ? 'var(--border2)' : 'var(--border)' }} />
      ))}
    </div>
  );
}

// ── TaskTooltip ───────────────────────────────────────────────────────────────
function TaskTooltip({ task, x, y }) {
  if (!task) return null;
  const duration = task._endMins - task._startMins;

  const headerLabel = task.nonProjectRelated
    ? (task.nonProjectDetails || 'Non-Project')
    : (task.workOrderNo || task.projectId || '—');

  const rows = [
    { label: 'Doc #',         value: task.tsDocNo       || '—' },
    { label: 'Task Type',     value: task.taskType       || '—' },
    task.nonProjectRelated
      ? { label: 'Details',   value: task.nonProjectDetails || 'Non-Project' }
      : { label: 'Work Order', value: task.workOrderNo   || '—' },
    { label: 'Project ID',    value: task.nonProjectRelated ? '—' : (task.projectId  || '—') },
    { label: 'Project Name',  value: task.nonProjectRelated ? '—' : (task.projectName || '—') },
    { label: 'Department',    value: task.department     || '—' },
    task.taskDescription ? { label: 'Description', value: task.taskDescription } : null,
    { label: 'Start',         value: task.isContinuation ? '00:00 (prev day →)' : (task.startTime || '—') },
    { label: 'End',           value: task.isOvernight && !task.isContinuation ? `${task.endTime} (next day)` : (task.endTime || '—') },
    { label: 'Duration',      value: minsToLabel(duration) },
    { label: 'Status',        value: task.status         || '—' },
  ].filter(r => r && r.value && r.value !== '—');

  const TW = 260, TH = 240;
  const vw = window.innerWidth, vh = window.innerHeight;
  const left = x + 14 + TW > vw ? x - TW - 8 : x + 14;
  const top  = y + 10 + TH > vh ? y - TH - 8 : y + 10;

  return (
    <div style={{ position: 'fixed', top, left, zIndex: 9999, width: TW, background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,0.22)', pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{headerLabel}</div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{task.department}</div>
      </div>
      <div style={{ padding: '6px 12px 8px' }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{r.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GanttRow — just the bars, no employee info ────────────────────────────────
function GanttRow({ emp, isOdd, rangeStart, rangeEnd, rowHeight, onTaskHover, onTaskLeave }) {
  const rangeDur = rangeEnd - rangeStart;
  const tasks    = computeTaskLanes(emp.tasks, rangeStart);

  const hourTicks = [];
  for (let m = 0; m <= 1440; m += 60) hourTicks.push(m);

  if (emp.noTimeRecorded) {
    return (
      <div style={{ height: rowHeight, position: 'relative', borderBottom: '1px solid var(--border)', background: 'rgba(220,38,38,0.03)', display: 'flex', alignItems: 'center', paddingLeft: 16 }}>
        {hourTicks.map(m => (
          <div key={m} style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct(m, rangeStart, rangeDur)}%`, width: 1, background: 'var(--border)', pointerEvents: 'none' }} />
        ))}
        <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, opacity: 0.7, letterSpacing: 0.2, zIndex: 1 }}>— No time recorded —</span>
      </div>
    );
  }

  return (
    <div style={{ height: rowHeight, position: 'relative', borderBottom: '1px solid var(--border)', background: isOdd ? 'var(--surface)' : 'var(--bg)' }}>
      {/* Hour grid lines */}
      {hourTicks.map(m => (
        <div key={m} style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct(m, rangeStart, rangeDur)}%`, width: 1, background: 'var(--border)', pointerEvents: 'none' }} />
      ))}
      {/* Task bars — one per lane */}
      {tasks.map((t, i) => {
        const leftPct  = pct(t._startMins, rangeStart, rangeDur);
        const widthPct = ((t._endMins - t._startMins) / rangeDur) * 100;
        const barTop   = LANE_PAD + t.lane * LANE_H;

        const colorKey = t.workOrderNo || t.department || String(i);
        const color    = getColor(colorKey);

        const statusBadge = t.status === 'Approved'  ? { label: 'Approved',  bg: 'rgba(45,122,79,0.2)',  text: '#1a5030' }
                          : t.status === 'Submitted' ? { label: 'Submitted', bg: 'rgba(37,99,168,0.18)', text: '#163c70' }
                          : null;

        const isOvernightBar   = t.isOvernight && !t.isContinuation;
        const isContinuationBar = t.isContinuation;
        const borderStyle = isContinuationBar ? 'dashed' : 'solid';
        const borderRadius = isOvernightBar
          ? '4px 0 0 4px'   // right side open → continues into next day
          : isContinuationBar
          ? '0 4px 4px 0'   // left side open → continued from prev day
          : '4px';

        return (
          <div key={i}
               onMouseEnter={e => onTaskHover(t, e.clientX, e.clientY)}
               onMouseMove={e  => onTaskHover(t, e.clientX, e.clientY)}
               onMouseLeave={onTaskLeave}
               style={{ position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`, top: barTop, height: LANE_H - 4, borderRadius, border: `1.5px ${borderStyle} ${color.border}`, background: color.bg, display: 'flex', alignItems: 'center', paddingLeft: isContinuationBar ? 4 : 7, paddingRight: isOvernightBar ? 4 : 4, overflow: 'hidden', cursor: 'pointer', boxSizing: 'border-box', gap: 4 }}>
            {isContinuationBar && <span style={{ fontSize: 10, color: color.text, flexShrink: 0 }}>◀</span>}
            <span style={{ fontSize: 11, fontWeight: 600, color: color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
              {t.workOrderNo || t.projectId || (t.nonProjectRelated ? (t.nonProjectDetails || 'Non-Project') : '—')}
            </span>
            {statusBadge && (
              <span style={{ fontSize: 9, fontWeight: 700, color: statusBadge.text, background: statusBadge.bg, borderRadius: 3, padding: '1px 5px', flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {statusBadge.label}
              </span>
            )}
            {isOvernightBar && <span style={{ fontSize: 10, color: color.text, flexShrink: 0 }}>▶</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── EmployeeCard — left panel card ─────────────────────────────────────────────
function EmployeeCard({ emp, isOdd, rowHeight, onClick }) {
  const missing = emp.noTimeRecorded;
  return (
    <div
      onClick={onClick}
      style={{ height: rowHeight, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderBottom: '1px solid var(--border)', background: missing ? 'rgba(220,38,38,0.04)' : isOdd ? 'var(--surface)' : 'var(--bg)', boxSizing: 'border-box', cursor: 'pointer' }}
      onMouseEnter={e => e.currentTarget.style.background = missing ? 'rgba(220,38,38,0.08)' : 'rgba(196,125,40,0.08)'}
      onMouseLeave={e => e.currentTarget.style.background = missing ? 'rgba(220,38,38,0.04)' : isOdd ? 'var(--surface)' : 'var(--bg)'}
    >
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: missing ? 'rgba(220,38,38,0.15)' : 'var(--accent)', color: missing ? '#dc2626' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, letterSpacing: 0.5, border: missing ? '1.5px dashed #dc2626' : 'none' }}>
        {initials(emp.employeeName)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: missing ? 'var(--text3)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {emp.employeeName}
        </div>
        <div style={{ fontSize: 10, color: missing ? '#dc2626' : 'var(--text3)', marginTop: 2, fontWeight: missing ? 600 : 400 }}>
          {missing ? 'No time recorded' : `${minsToLabel(emp.totalMinutes)} · ${emp.tasks.length} task${emp.tasks.length !== 1 ? 's' : ''}`}
        </div>
      </div>
    </div>
  );
}

// ── Now indicator ─────────────────────────────────────────────────────────────
function NowLine({ date, rangeStart, rangeEnd }) {
  const [nowMins, setNowMins] = useState(null);
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (date !== today) { setNowMins(null); return; }
    const update = () => {
      const n = new Date();
      setNowMins(n.getHours() * 60 + n.getMinutes());
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [date]);

  if (nowMins === null || nowMins < rangeStart || nowMins > rangeEnd) return null;
  const rangeDur = rangeEnd - rangeStart;
  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct(nowMins, rangeStart, rangeDur)}%`, width: 2, background: '#b83232', zIndex: 10, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 2, left: -14, background: '#b83232', color: '#fff', fontSize: 9, padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap' }}>
        {String(Math.floor(nowMins / 60)).padStart(2, '0')}:{String(nowMins % 60).padStart(2, '0')}
      </div>
    </div>
  );
}

// ── EmployeeMonthModal ────────────────────────────────────────────────────────
const MINI_LANE_H  = 28;
const MINI_LANE_PAD = 5;
const DATE_COL_W   = 76; // px — left date column in modal

function miniRowHeight(laneCount) {
  return MINI_LANE_PAD * 2 + Math.max(1, laneCount) * MINI_LANE_H;
}


function EmployeeMonthModal({ emp, initialDate, type, onClose }) {
  const [year, setYear]   = useState(() => Number(initialDate.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(initialDate.slice(5, 7)));

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastD    = new Date(year, month, 0).getDate();
  const dateTo   = `${year}-${String(month).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;

  const { data: days = [], isLoading } = useQuery({
    queryKey: ['emp-month-timeline', emp.employeeCode, dateFrom, dateTo, type],
    queryFn: () => api.get('/timesheets/employee-timeline', {
      params: { employeeCode: emp.employeeCode, dateFrom, dateTo, type },
    }).then(r => r.data),
    staleTime: 60000,
  });

  const dayMap  = Object.fromEntries(days.map(d => [d.date, d.tasks]));
  const allDays = Array.from({ length: lastD }, (_, i) => {
    const d = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    return { date: d, tasks: dayMap[d] || [] };
  });

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const totalMins = days.reduce((s, d) => s + d.tasks.reduce((ss, t) => ss + t.durationMinutes, 0), 0);
  const workDays  = days.filter(d => d.tasks.length > 0).length;

  const rulerHours = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  // Close on Escape key
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />

      {/* Modal card */}
      <div style={{ position: 'relative', zIndex: 1, width: 'min(96vw, 1080px)', height: '88vh', background: 'var(--surface)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border2)' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: '2px solid var(--border2)', background: 'var(--surface2)', flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            {initials(emp.employeeName)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{emp.employeeName}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              {workDays} working day{workDays !== 1 ? 's' : ''} · {minsToLabel(totalMins)} total
            </div>
          </div>

          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto' }}>
            <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 15, color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', minWidth: 140, textAlign: 'center' }}>{MONTH_NAMES[month - 1]} {year}</span>
            <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 15, color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>›</button>
          </div>

          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 18, color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* ── Ruler ── */}
        <div style={{ display: 'flex', flexShrink: 0, background: 'var(--surface2)', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ width: DATE_COL_W, flexShrink: 0, borderRight: '1px solid var(--border2)', padding: '0 10px', display: 'flex', alignItems: 'center', height: 28 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Date</span>
          </div>
          <div style={{ flex: 1, position: 'relative', height: 28, minWidth: 0 }}>
            {rulerHours.map(h => (
              <div key={h} style={{ position: 'absolute', bottom: 4, left: `${(h / 24) * 100}%`, transform: 'translateX(-50%)', fontSize: 9, color: 'var(--text3)', whiteSpace: 'nowrap', userSelect: 'none' }}>
                {h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
              </div>
            ))}
            {rulerHours.map(h => (
              <div key={`t${h}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(h / 24) * 100}%`, width: 1, background: 'var(--border2)' }} />
            ))}
          </div>
        </div>

        {/* ── Day rows ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
          ) : allDays.map((day, i) => {
            const dt        = new Date(day.date + 'T00:00:00');
            const dow       = DAY_NAMES[dt.getDay()];
            const dayNum    = dt.getDate();
            const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
            const hasData   = day.tasks.length > 0;
            const laneCount = hasData ? Math.max(1, ...computeTaskLanes(day.tasks, 0).map(t => t.lane + 1)) : 1;
            const rowH      = miniRowHeight(laneCount);

            return (
              <div key={day.date} style={{ display: 'flex', borderBottom: '1px solid var(--border)', minHeight: rowH }}>
                {/* Date label */}
                <div style={{ width: DATE_COL_W, flexShrink: 0, borderRight: '1px solid var(--border2)', padding: '5px 10px', background: isWeekend ? 'rgba(196,125,40,0.07)' : 'var(--surface2)', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: isWeekend ? 'var(--accent)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{dow}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: hasData ? 'var(--text)' : 'var(--text3)', lineHeight: 1 }}>{dayNum}</div>
                  {hasData && (
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>
                      {minsToLabel(day.tasks.reduce((s, t) => s + t.durationMinutes, 0))}
                    </div>
                  )}
                </div>

                {/* Mini gantt */}
                <div style={{ flex: 1, height: rowH, position: 'relative', background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)', minWidth: 0 }}>
                  {rulerHours.map(h => (
                    <div key={h} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(h / 24) * 100}%`, width: 1, background: 'var(--border)', pointerEvents: 'none' }} />
                  ))}
                  {hasData && computeTaskLanes(day.tasks, 0).map((t, ti) => {
                    const leftPct  = (t._startMins / 1440) * 100;
                    const widthPct = Math.max((t._endMins - t._startMins) / 1440 * 100, 0.4);
                    const barTop   = MINI_LANE_PAD + t.lane * MINI_LANE_H;
                    const colorKey = t.workOrderNo || t.department || String(ti);
                    const color    = getColor(colorKey);
                    return (
                      <div key={ti}
                           title={`${t.tsDocNo} • ${t.workOrderNo || t.projectId} • ${t.department} • ${t.startTime}–${t.endTime}`}
                           style={{ position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`, top: barTop, height: MINI_LANE_H - 4, borderRadius: 3, border: `1px solid ${color.border}`, background: color.bg, overflow: 'hidden', display: 'flex', alignItems: 'center', paddingLeft: 5, cursor: 'default', boxSizing: 'border-box' }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.workOrderNo || t.projectId || '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = todayStr();
  if (dateStr === today) return 'Today';
  if (dateStr === shiftDate(today, -1)) return 'Yesterday';
  if (dateStr === shiftDate(today, 1)) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ADMIN_ROLES = ['ROLE-001'];

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TimelinePage() {
  const user    = useAuthStore(s => s.user);
  const isAdmin = ADMIN_ROLES.includes(user?.roleCode ?? '');

  const [date, setDate]     = useState(todayStr);
  const [hodCode, setHod]   = useState('');
  const [type, setType]     = useState('');
  const [search, setSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);

  const empListRef = useRef(null);
  const ganttRef   = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const handleTaskHover = (task, x, y) => setTooltip({ task, x, y });
  const handleTaskLeave = () => setTooltip(null);

  const onGanttScroll = () => {
    if (empListRef.current && ganttRef.current)
      empListRef.current.scrollTop = ganttRef.current.scrollTop;
  };

  // HOD teams dropdown — admin only
  const { data: hodAssignments = [] } = useQuery({
    queryKey: ['hod-teams'],
    queryFn: () => api.get('/hod-teams').then(r => r.data),
    staleTime: 300_000,
    enabled: isAdmin,
  });
  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then(r => r.data),
    staleTime: 300_000,
    enabled: isAdmin,
  });
  const hodOptions = useMemo(() => {
    if (!isAdmin) return [];
    const empMap = new Map(allEmployees.map(e => [
      e.employeeNo,
      [e.firstName, e.lastname].filter(Boolean).join(' ') || e.employeeNo,
    ]));
    const unique = [...new Set(hodAssignments.map(h => h.hodCode))];
    return unique.map(code => ({ code, name: empMap.get(code) || code })).sort((a, b) => a.name.localeCompare(b.name));
  }, [isAdmin, hodAssignments, allEmployees]);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['timeline', date, hodCode, type],
    queryFn: () => api.get('/timesheets/timeline', {
      params: { date, hodCode: hodCode || undefined, type: type || undefined },
    }).then(r => r.data),
    enabled: Boolean(date),
    staleTime: 60000,
  });

  const filtered = search
    ? employees.filter(e => e.employeeName.toLowerCase().includes(search.toLowerCase()))
    : employees;

  const totalMins  = filtered.reduce((s, e) => s + e.totalMinutes, 0);
  const totalTasks = filtered.reduce((s, e) => s + e.tasks.length, 0);

  const rangeStart = 0;
  const rangeEnd   = 1440;

  const btnStyle = {
    width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border2)',
    background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer',
    fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, lineHeight: 1,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      <TaskTooltip task={tooltip?.task} x={tooltip?.x} y={tooltip?.y} />

      {/* ── Top filter bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '2px solid var(--border2)', background: 'var(--surface)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginRight: 4 }}>Timeline</span>

        {/* Date navigator: ‹ [label + date picker] › */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, padding: '2px 4px' }}>
          <button style={btnStyle} onClick={() => setDate(d => shiftDate(d, -1))} title="Previous day">‹</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '0 4px', minWidth: 90, justifyContent: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{formatDateLabel(date)}</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                   style={{ border: 'none', background: 'transparent', fontSize: 11, color: 'var(--text3)', outline: 'none', cursor: 'pointer', width: 22, opacity: 0.7 }} />
          </label>
          <button style={btnStyle} onClick={() => setDate(d => shiftDate(d, 1))} title="Next day">›</button>
        </div>

        <select value={type} onChange={e => setType(e.target.value)}
                style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--border2)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}>
          <option value="">All Types</option>
          <option value="PROD">Production</option>
          <option value="INST">Installation</option>
          <option value="PROJ">Projects</option>
        </select>

        {/* HOD Team filter */}
        {hodOptions.length > 0 && (
          <select value={hodCode} onChange={e => setHod(e.target.value)}
                  style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--border2)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)', outline: 'none', cursor: 'pointer', maxWidth: 180 }}>
            <option value="">All HOD Teams</option>
            {hodOptions.map(h => (
              <option key={h.code} value={h.code}>{h.name}</option>
            ))}
          </select>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 10px' }}>
          🔍
          <input placeholder="Employee..." value={search} onChange={e => setSearch(e.target.value)}
                 style={{ border: 'none', background: 'transparent', fontSize: 12, color: 'var(--text)', outline: 'none', width: 120 }} />
        </div>

        <div style={{ display: 'flex', gap: 16, marginLeft: 8, fontSize: 12, color: 'var(--text3)' }}>
          <span><strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> employees</span>
          <span><strong style={{ color: 'var(--text)' }}>{totalTasks}</strong> tasks</span>
          <span><strong style={{ color: 'var(--text)' }}>{minsToLabel(totalMins)}</strong> total</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left employee panel ── */}
        <div style={{ width: LEFT_W, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '2px solid var(--border2)', zIndex: 2, background: 'var(--surface2)' }}>
          {/* Panel header — same height as gantt ruler */}
          <div style={{ height: HDR_H, flexShrink: 0, display: 'flex', alignItems: 'flex-end', padding: '0 12px 10px', borderBottom: '2px solid var(--border2)', background: 'var(--surface2)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Employee</span>
          </div>
          {/* Employee list — hidden scrollbar, scrollTop driven by gantt */}
          <div ref={empListRef} style={{ flex: 1, overflowY: 'hidden' }}>
            {isLoading ? null : filtered.map((emp, i) => {
              const lanes = computeTaskLanes(emp.tasks, rangeStart);
              const laneCount = lanes.length > 0 ? Math.max(1, ...lanes.map(t => t.lane + 1)) : 1;
              return <EmployeeCard key={emp.employeeCode} emp={emp} isOdd={i % 2 === 1} rowHeight={rowHeightForLanes(laneCount)} onClick={() => setSelectedEmp(emp)} />;
            })}
          </div>
        </div>

        {/* ── Right gantt area ── */}
        <div ref={ganttRef} onScroll={onGanttScroll}
             style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {/* Sticky time ruler */}
          <div style={{ position: 'sticky', top: 0, zIndex: 5 }}>
            <TimelineRuler rangeStart={rangeStart} rangeEnd={rangeEnd} />
          </div>

          {isLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading timeline…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
              {date ? 'No timesheet data for this date.' : 'Select a date to view the timeline.'}
            </div>
          ) : (
            <div style={{ position: 'relative', minWidth: 600 }}>
              <NowLine date={date} rangeStart={rangeStart} rangeEnd={rangeEnd} />
              {filtered.map((emp, i) => {
                const lanes = computeTaskLanes(emp.tasks, rangeStart);
              const laneCount = lanes.length > 0 ? Math.max(1, ...lanes.map(t => t.lane + 1)) : 1;
                return <GanttRow key={emp.employeeCode} emp={emp} isOdd={i % 2 === 1} rangeStart={rangeStart} rangeEnd={rangeEnd} rowHeight={rowHeightForLanes(laneCount)} onTaskHover={handleTaskHover} onTaskLeave={handleTaskLeave} />;
              })}
            </div>
          )}
        </div>

      </div>

      {selectedEmp && (
        <EmployeeMonthModal
          emp={selectedEmp}
          initialDate={date}
          type={type}
          onClose={() => setSelectedEmp(null)}
        />
      )}
    </div>
  );
}
