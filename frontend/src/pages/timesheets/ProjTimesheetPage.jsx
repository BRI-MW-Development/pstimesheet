import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import SearchSelect from '../../components/ui/SearchSelect';
import Badge from '../../components/ui/Badge';
import FileLightbox from '../../components/ui/FileLightbox';
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

// ── Attachment cell component ──────────────────────────────────────────────────
function AttachCell({ attachment, existingAttachments = [], onAdd, onRemoveNew, onRemoveExisting, readOnly }) {
  const fileRef = useRef();
  const [lightbox, setLightbox] = useState(null); // { src, name, mimeType }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onAdd({ fileName: file.name, mimeType: file.type, fileSize: file.size, fileData: ev.target.result.split(',')[1], dataUrl: ev.target.result });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function openExisting(att) {
    api.get(`/timesheets/proj-line-attachments/${att.id}`).then((r) => {
      const { fileName, mimeType, fileData } = r.data;
      const src = fileData.startsWith('data:') ? fileData : `data:${mimeType};base64,${fileData}`;
      setLightbox({ src, name: fileName, mimeType });
    });
  }

  function fileIcon(name = '') {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg','jpeg','png','gif','webp','bmp'].includes(ext)) return '🖼';
    if (ext === 'pdf') return '📄';
    if (['doc','docx'].includes(ext)) return '📝';
    if (['xls','xlsx'].includes(ext)) return '📊';
    return '📎';
  }

  function downloadLightbox() {
    if (!lightbox) return;
    const a = document.createElement('a'); a.href = lightbox.src; a.download = lightbox.name; a.click();
  }

  return (
    <>
      {lightbox && (
        <FileLightbox file={lightbox} onClose={() => setLightbox(null)} onDownload={downloadLightbox} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Existing saved attachments */}
        {existingAttachments.map((att) => {
          const isImg = att.mimeType?.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(att.fileName);
          return (
            <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <button type="button" onClick={() => openExisting(att)}
                title={isImg ? 'Click to preview' : 'Click to download'}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', maxWidth: 140, pointerEvents: 'auto' }}>
                <span style={{ fontSize: isImg ? 13 : undefined }}>{isImg ? '👁' : fileIcon(att.fileName)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.fileName}</span>
              </button>
              {!readOnly && (
                <button type="button" onClick={() => onRemoveExisting(att.id)}
                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 2px', lineHeight: 1 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          );
        })}

        {/* New (unsaved) attachment */}
        {attachment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {attachment.mimeType?.startsWith('image/') && attachment.dataUrl ? (
              <img src={attachment.dataUrl} alt={attachment.fileName}
                onClick={() => setLightbox({ src: attachment.dataUrl, name: attachment.fileName, mimeType: attachment.mimeType })}
                style={{ width: 36, height: 28, objectFit: 'cover', borderRadius: 4, cursor: 'zoom-in', border: '1px solid #e5e7eb' }} />
            ) : (
              <span>{fileIcon(attachment.fileName)}</span>
            )}
            <span style={{ fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{attachment.fileName}</span>
            {!readOnly && (
              <button type="button" onClick={onRemoveNew}
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 2px', lineHeight: 1 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        )}

        {/* Upload button */}
        {!readOnly && !attachment && (
          <>
            <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile} />
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ fontSize: 11, color: '#6b7280', background: 'none', border: '1px dashed #d1d5db', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, alignSelf: 'flex-start' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              Attach file
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ── Daily Form ─────────────────────────────────────────────────────────────────
let _lineKey = 0;
const EMPTY_LINE = () => ({ _key: ++_lineKey, projectId: '', taskType: '', startTime: '', endTime: '', attachment: null, existingAttachments: [], comments: '', commentOpen: false, nonProjectRelated: false, nonProjectDetails: '' });

const _localDate = (d) => { const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; };
const TODAY     = _localDate(new Date());
const MIN_DATE  = _localDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

function DailyForm({ editDocNo, readOnly, onBack, onSaved, onEdit }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const isAdmin = permissions.some((p) => p.module === 'USERS' && p.canWrite);
  const userEmployeeCode = user?.employeeCode ?? '';
  const entryPerson = user?.employeeCode ?? user?.username ?? '';

  const [summary, setSummary] = useState({ employee: userEmployeeCode, date: TODAY });
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const { data: employees = [] } = useQuery({ queryKey: ['employees'],  queryFn: () => api.get('/employees').then((r) => r.data) });
  const { data: projects  = [] } = useQuery({ queryKey: ['projects'],   queryFn: () => api.get('/projects').then((r) => r.data) });
  const { data: taskTypes = [] } = useQuery({ queryKey: ['task-types'], queryFn: () => api.get('/task-types').then((r) => r.data) });

  const { data: existing } = useQuery({
    queryKey: ['timesheet', editDocNo],
    queryFn: () => api.get(`/timesheets/${editDocNo}`).then((r) => r.data),
    enabled: Boolean(editDocNo),
  });

  const { data: dayEntries = [] } = useQuery({
    queryKey: ['day-entries', summary.employee, summary.date, editDocNo],
    queryFn: () => api.get('/timesheets/day-entries', { params: { employeeCode: summary.employee, date: summary.date, excludeDocNo: editDocNo } }).then((r) => r.data),
    enabled: !!(summary.employee && summary.date),
  });

  useEffect(() => {
    if (!existing) return;
    // Debug: log what the API returned so we can verify DB values
    console.log('[PROJ] existing labourLines from API:', JSON.stringify(
      (existing.labourLines ?? []).map(l => ({ lineNumber: l.lineNumber, projectId: l.projectId, taskTypeCode: l.taskTypeCode, startTime: l.startTime, endTime: l.endTime, comments: l.comments }))
    ));
    setSummary({
      employee: existing.labourLines?.[0]?.employeeCode ?? userEmployeeCode,
      date: existing.entryDate?.slice(0, 10) ?? TODAY,
    });
    setLines(existing.labourLines?.length > 0
      ? existing.labourLines.map((l, li) => ({
          _key: ++_lineKey,
          projectId: l.projectId ?? (li === 0 ? existing.projectId ?? '' : ''),
          taskType:  l.taskTypeCode ?? (li === 0 ? existing.shiftCode ?? '' : ''),
          startTime: l.startTime ?? '',
          endTime:   l.endTime ?? '',
          attachment: null,
          existingAttachments: l.attachments ?? [],
          comments: l.comments ?? '',
          commentOpen: Boolean(l.comments),
          nonProjectRelated: Boolean(l.nonProjectRelated),
          nonProjectDetails: l.nonProjectDetails ?? '',
        }))
      : [EMPTY_LINE()]);
  }, [existing]);

  function setLine(idx, field, val) {
    setLines((ls) => ls.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  }
  function addLine()        { setLines((ls) => [...ls, EMPTY_LINE()]); }
  function removeLine(idx)  { setLines((ls) => ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls); }

  function removeExistingAttachment(lineIdx, attachId) {
    api.delete(`/timesheets/proj-line-attachments/${attachId}`)
      .then(() => setLines((ls) => ls.map((l, i) => i === lineIdx
        ? { ...l, existingAttachments: l.existingAttachments.filter((a) => a.id !== attachId) } : l)))
      .catch(() => toast('Failed to remove attachment.', 'error'));
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload) =>
      editDocNo
        ? api.put(`/timesheets/${editDocNo}`, payload).then((r) => r.data)
        : api.post('/timesheets', payload).then((r) => r.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['proj-timesheets'] });
      if (editDocNo) {
        queryClient.invalidateQueries({ queryKey: ['timesheet', editDocNo] });
        toast('Timesheet updated.', 'success');
        onSaved();
      } else {
        // New save: open the record immediately so user can verify data saved correctly
        const savedDocNo = result?.docNo;
        toast(`Saved as Draft${savedDocNo ? ` — ${savedDocNo}` : ''}.`, 'success');
        onSaved(savedDocNo); // pass docNo up so parent can open the record
      }
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const { mutate: confirm, isPending: confirming } = useMutation({
    mutationFn: () => api.post(`/timesheets/${editDocNo}/confirm`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proj-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['timesheet', editDocNo] });
      toast('Timesheet confirmed and approved.', 'success');
      onSaved();
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Confirm failed.', 'error'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    const emp = summary.employee || userEmployeeCode;
    if (!emp?.trim()) { toast('Employee is required.', 'error'); return; }
    // Lines that have ANY field filled in are "active" — all four fields are required on active lines
    const activeLines = lines.filter((l) => l.projectId?.trim() || l.nonProjectRelated || l.taskType?.trim() || l.startTime || l.endTime);
    if (activeLines.length === 0) { toast('Add at least one line with data.', 'error'); return; }

    for (let i = 0; i < activeLines.length; i++) {
      const { projectId, taskType, startTime: s, endTime: e, nonProjectRelated, nonProjectDetails } = activeLines[i];
      const lineLabel = `Line ${i + 1}`;
      if (!nonProjectRelated && !projectId?.trim()) { toast(`${lineLabel}: Project ID is required.`, 'error'); return; }
      if (nonProjectRelated && !nonProjectDetails?.trim()) { toast(`${lineLabel}: Details are required for Non Project Related entries.`, 'error'); return; }
      if (!taskType?.trim())  { toast(`${lineLabel}: Task Type is required.`, 'error'); return; }
      if (!s)                 { toast(`${lineLabel}: Start Time is required.`, 'error'); return; }
      if (!e)                 { toast(`${lineLabel}: End Time is required.`, 'error'); return; }
      const sm = Number(calcMins('00:00', s));
      const em = Number(calcMins('00:00', e));
      if (sm === em) { toast(`${lineLabel}: Start and end time cannot be the same.`, 'error'); return; }
      if (em < sm)   { toast(`${lineLabel}: End time must be after start time.`, 'error'); return; }
    }
    const validLines = activeLines;
    console.log('[PROJ] saving labourRows:', JSON.stringify(
      validLines.map(l => ({ projectId: l.projectId, taskType: l.taskType, startTime: l.startTime, endTime: l.endTime }))
    ));
    save({
      tsType: 'PROJ',
      date: summary.date,
      projectId: validLines[0]?.projectId || '',
      shift: validLines[0]?.taskType || '',
      entryPerson,
      labourRows: validLines.map((l) => ({
        employee: emp,
        startTime: l.startTime || null,
        endTime:   l.endTime   || null,
        duration:  calcMins(l.startTime, l.endTime) || '0',
        projectId: l.nonProjectRelated ? null : (l.projectId || null),
        taskTypeCode: l.taskType || null,
        comments: l.comments || null,
        attachment: l.attachment || null,
        nonProjectRelated: l.nonProjectRelated || false,
        nonProjectDetails: l.nonProjectRelated ? (l.nonProjectDetails || null) : null,
      })),
    });
  }

  const empOptions  = employees.map((e) => ({ value: e.employeeNo, label: `${e.employeeNo} – ${[e.firstName, e.lastname].filter(Boolean).join(' ')}` }));
  const projOptions = projects.map((p) => ({ value: p.projectCode, label: p.projectCode }));
  const ttOptions   = taskTypes.map((t) => ({ value: t.taskTypeCode ?? t.name, label: t.taskTypeName ?? t.name }));

  const statusLabel = existing?.status;
  const isDraft = statusLabel === 'Draft';
  const canEdit = isDraft || isWithin24h(existing?.createdAt);

  function lineMins(line) {
    const m = Number(calcMins(line.startTime, line.endTime));
    return m > 0 ? m : 0;
  }

  const filledCount  = lines.filter((l) => l.projectId || l.taskType || l.startTime).length;
  const totalMinutes = lines.reduce((sum, l) => sum + lineMins(l), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Top bar ── */}
      <div className="ts-modal-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {editDocNo && <span className="ts-docno-pill">{editDocNo}</span>}
          <div>
            <div className="ts-modal-title">{readOnly ? 'View Timesheet' : editDocNo ? 'Edit Timesheet' : 'New Daily Timesheet'}</div>
            <div className="ts-modal-sub">{readOnly ? `${statusLabel ?? ''} · read-only` : 'Projects Team · daily entry'}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
      </div>

      {/* ── Body ── */}
      <div className="ts-scroll-panel">
        <form id="pt-daily-form" onSubmit={handleSubmit}>
          <div style={{ display: 'contents', pointerEvents: readOnly ? 'none' : undefined }}>

          {/* ── Summary section ── */}
          <div className="ts-section">
            <div className="ts-section-head" style={{ background: 'linear-gradient(to right, #f0f7ff, #f8fafc)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3b82f6' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Summary
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : '220px 180px 1fr 150px' }}>
              <div style={{ padding: '16px 20px', borderRight: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>Doc No</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: editDocNo ? '#1d4ed8' : '#9ca3af', fontFamily: 'monospace' }}>
                  {editDocNo ?? '— auto-generated —'}
                </div>
              </div>
              <div style={{ padding: '16px 20px', borderRight: isMobile ? undefined : '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>Date</div>
                <input type="date" className="form-control" value={summary.date}
                  min={MIN_DATE} max={TODAY}
                  style={{ maxWidth: 160, fontSize: 13 }}
                  onChange={(e) => setSummary((s) => ({ ...s, date: e.target.value }))} />
              </div>
              <div style={{ padding: '16px 20px', borderRight: '1px solid #f0f0f0', borderTop: isMobile ? '1px solid #f0f0f0' : undefined }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>Employee</div>
                {isAdmin ? (
                  <SearchSelect options={empOptions} value={summary.employee}
                    onChange={(v) => setSummary((s) => ({ ...s, employee: v }))} placeholder="Search employee…" />
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', paddingTop: 6 }}>{summary.employee || userEmployeeCode || '—'}</div>
                )}
              </div>
              <div style={{ padding: '16px 20px', textAlign: 'center', borderTop: isMobile ? '1px solid #f0f0f0' : undefined }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Total Duration</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: totalMinutes > 0 ? '#2563eb' : '#d1d5db', lineHeight: 1 }}>{totalMinutes > 0 ? totalMinutes : '—'}</div>
                {totalMinutes > 0 && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>minutes</div>}
              </div>
            </div>
          </div>

          {/* ── Timeline ── */}
          {(() => {
            const toMins = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
            const timedLines = lines.map((l, i) => ({ ...l, _idx: i, s: toMins(l.startTime), e: toMins(l.endTime) }))
              .filter((l) => l.s != null && l.e != null && l.e > l.s);
            const otherEntries = dayEntries.map((e, i) => ({ ...e, _idx: i, s: toMins(e.startTime), e: toMins(e.endTime) }))
              .filter((e) => e.s != null && e.e != null && e.e > e.s);
            if (timedLines.length === 0 && otherEntries.length === 0) return null;
            const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];
            const allMins = [
              ...timedLines.flatMap((l) => [l.s, l.e]),
              ...otherEntries.flatMap((e) => [e.s, e.e]),
            ];
            const viewStart = Math.max(0,    Math.floor((Math.min(...allMins) - 30) / 60) * 60);
            const viewEnd   = Math.min(1440, Math.ceil ((Math.max(...allMins) + 30) / 60) * 60);
            const span = viewEnd - viewStart;
            const pct = (m) => ((m - viewStart) / span * 100).toFixed(3) + '%';
            const w   = (s, e) => ((e - s) / span * 100).toFixed(3) + '%';
            const hm  = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
            const ticks = [];
            for (let m = Math.ceil(viewStart / 60) * 60; m <= viewEnd; m += 60) ticks.push(m);
            // Overlap detection: any current line overlaps any other entry
            const hasOverlap = timedLines.some((l) =>
              otherEntries.some((e) => l.s < e.e && l.e > e.s)
            );
            const trackStyle = { position: 'relative', height: 20, background: '#f1f5f9', borderRadius: 6 };
            const tickLines = ticks.map((m) => (
              <div key={m} style={{ position: 'absolute', left: pct(m), top: 0, bottom: 0, width: 1, background: '#e2e8f0' }} />
            ));
            return (
              <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #f0f0f0' }}>
                {/* tick labels */}
                <div style={{ position: 'relative', height: 16 }}>
                  {ticks.map((m) => (
                    <span key={m} style={{ position: 'absolute', left: pct(m), transform: 'translateX(-50%)', fontSize: 9, color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{hm(m)}</span>
                  ))}
                </div>
                {/* current timesheet track */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#6b7280', width: 68, flexShrink: 0, textAlign: 'right' }}>This entry</span>
                  <div style={{ ...trackStyle, flex: 1 }}>
                    {tickLines}
                    {timedLines.map((l) => (
                      <div key={l._key}
                        title={`L${l._idx + 1} · ${l.projectId || '—'} · ${hm(l.s)}–${hm(l.e)}`}
                        style={{ position: 'absolute', left: pct(l.s), width: w(l.s, l.e), top: 2, bottom: 2, background: COLORS[l._idx % COLORS.length], borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {(l.e - l.s) >= 45 && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', padding: '0 4px' }}>L{l._idx + 1}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* other timesheets track */}
                {otherEntries.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#6b7280', width: 68, flexShrink: 0, textAlign: 'right' }}>Other</span>
                    <div style={{ ...trackStyle, flex: 1 }}>
                      {tickLines}
                      {otherEntries.map((e) => (
                        <div key={`${e.tsDocNo}-${e.lineNumber}`}
                          title={`${e.tsDocNo} · ${e.label} · ${hm(e.s)}–${hm(e.e)} (${e.status})`}
                          style={{ position: 'absolute', left: pct(e.s), width: w(e.s, e.e), top: 2, bottom: 2, background: '#94a3b8', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {(e.e - e.s) >= 45 && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', padding: '0 4px' }}>{e.tsType}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* overlap warning */}
                {hasOverlap && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '4px 8px', background: '#fef3c7', borderRadius: 4, border: '1px solid #fcd34d' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span style={{ fontSize: 10, color: '#92400e', fontWeight: 600 }}>Time overlap with another timesheet entry for this employee on this date</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Lines section ── */}
          <div className="ts-section">
            <div className="ts-section-head">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Line Details
              <span className="ts-section-badge">{filledCount || undefined}</span>
            </div>

            <table className="ts-line-table">
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'center' }}>#</th>
                  <th style={{ width: 110, textAlign: 'center' }}>Non-Project</th>
                  <th>Project ID / Details</th>
                  <th>Task Type</th>
                  <th style={{ width: 120 }}>Start Time</th>
                  <th style={{ width: 120 }}>End Time</th>
                  <th style={{ width: 96, textAlign: 'center' }}>Duration</th>
                  <th style={{ width: 190 }}>Attachment</th>
                  <th style={{ width: 48, textAlign: 'center' }}>Note</th>
                  {!readOnly && <th style={{ width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <React.Fragment key={line._key}>
                    <tr>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: '#f1f5f9', fontSize: 11, fontWeight: 700, color: '#64748b' }}>{idx + 1}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {readOnly ? (
                          line.nonProjectRelated
                            ? <span style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', background: '#ede9fe', borderRadius: 4, padding: '2px 8px' }}>Non-Project</span>
                            : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
                        ) : (
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: line.nonProjectRelated ? '#7c3aed' : '#6b7280' }}>
                            <input
                              type="checkbox"
                              checked={line.nonProjectRelated}
                              onChange={(e) => {
                                setLine(idx, 'nonProjectRelated', e.target.checked);
                                if (e.target.checked) setLine(idx, 'projectId', '');
                                else setLine(idx, 'nonProjectDetails', '');
                              }}
                            />
                            {line.nonProjectRelated && <span style={{ fontSize: 10, fontWeight: 600 }}>Yes</span>}
                          </label>
                        )}
                      </td>
                      <td>
                        {line.nonProjectRelated ? (
                          <input
                            type="text"
                            className="form-control"
                            style={{ fontSize: 13, minWidth: 160 }}
                            value={line.nonProjectDetails}
                            onChange={(e) => setLine(idx, 'nonProjectDetails', e.target.value)}
                            placeholder="Enter details…"
                            readOnly={readOnly}
                          />
                        ) : (
                          <SearchSelect options={projOptions} value={line.projectId}
                            onChange={(v) => setLine(idx, 'projectId', v)} placeholder="Type to search…" />
                        )}
                      </td>
                      <td>
                        <select value={line.taskType} onChange={(e) => setLine(idx, 'taskType', e.target.value)}>
                          <option value="">— select —</option>
                          {ttOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </td>
                      <td><TimeInput value={line.startTime} onChange={(v) => setLine(idx, 'startTime', v)} /></td>
                      <td><TimeInput value={line.endTime}   onChange={(v) => setLine(idx, 'endTime',   v)} /></td>
                      <td style={{ textAlign: 'center' }}>
                        {lineMins(line) > 0
                          ? <span style={{ display: 'inline-block', background: '#eff6ff', color: '#2563eb', fontWeight: 700, fontSize: 12, borderRadius: 6, padding: '3px 10px' }}>{lineMins(line)} min</span>
                          : <span style={{ color: '#e2e8f0', fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        <AttachCell
                          attachment={line.attachment}
                          existingAttachments={line.existingAttachments}
                          onAdd={(att) => setLine(idx, 'attachment', att)}
                          onRemoveNew={() => setLine(idx, 'attachment', null)}
                          onRemoveExisting={(attachId) => removeExistingAttachment(idx, attachId)}
                          readOnly={readOnly}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button type="button" title={line.comments ? 'Edit comment' : 'Add comment'}
                          onClick={() => setLine(idx, 'commentOpen', !line.commentOpen)}
                          style={{ border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, pointerEvents: 'auto',
                            color: line.comments ? '#2563eb' : '#d1d5db',
                            background: line.commentOpen ? '#eff6ff' : 'transparent' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={line.comments ? '#dbeafe' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                        </button>
                      </td>
                      {!readOnly && (
                        <td style={{ textAlign: 'center' }}>
                          {lines.length > 1 && (
                            <button type="button" className="del-row-btn" onClick={() => removeLine(idx)} title="Remove line">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    {line.commentOpen && (
                      <tr style={{ background: '#f8faff' }}>
                        <td colSpan={readOnly ? 9 : 10} style={{ padding: '6px 16px 10px 52px' }}>
                          <textarea
                            value={line.comments}
                            onChange={(e) => setLine(idx, 'comments', e.target.value)}
                            placeholder="Add a comment for this line…"
                            readOnly={readOnly}
                            rows={2}
                            style={{ width: '100%', fontSize: 12, resize: 'vertical', borderRadius: 6, border: '1px solid #e5e7eb', padding: '6px 10px', color: '#374151', background: readOnly ? '#f9fafb' : '#fff', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {!readOnly && (
              <div className="ts-section-footer">
                <button type="button" className="ts-add-btn" onClick={addLine}>+ Add Line</button>
              </div>
            )}
          </div>

          </div>{/* end pointer-events wrapper */}
        </form>
      </div>

      {/* ── Footer ── */}
      <div className="ts-modal-footer">
        {readOnly ? (
          <>
            <button type="button" className="ts-footer-cancel" onClick={onBack}>← Back to List</button>
            {isDraft && onEdit && (
              <button type="button" className="ts-footer-cancel" style={{ marginLeft: 'auto' }} onClick={onEdit}>Edit</button>
            )}
            {isDraft && editDocNo && (
              <button type="button" className="ts-footer-save" disabled={confirming}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                onClick={() => {
                  if (window.confirm('Confirm this timesheet? Once confirmed it cannot be edited.')) confirm();
                }}>
                {confirming ? 'Confirming…' : '✓ Confirm Timesheet'}
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" className="ts-footer-cancel" onClick={onBack}>Cancel</button>
            <button type="submit" form="pt-daily-form" className="ts-footer-save" disabled={saving}>
              {saving ? 'Saving…' : editDocNo ? 'Update Timesheet' : 'Save as Draft'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Weekly Form ────────────────────────────────────────────────────────────────
let _wLineKey = 0;
const EMPTY_WLINE = () => ({ _key: ++_wLineKey, projectId: '', taskType: '', startTime: '', endTime: '', attachment: null, existingAttachments: [], comments: '', commentOpen: false });

function WeeklyForm({ onBack, onSaved }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const isAdmin = permissions.some((p) => p.module === 'USERS' && p.canWrite);
  const userEmployeeCode = user?.employeeCode ?? '';
  const entryPerson = user?.displayName ?? user?.username ?? '';

  // Always format dates in LOCAL time to avoid UTC-offset shift (e.g. IST midnight → previous UTC day)
  const localDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = localDateStr(new Date());
  const minEntryDate = localDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const mon = new Date();
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const defaultWeekStart = localDateStr(mon);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const [employee, setEmployee] = useState(userEmployeeCode);
  const [weekStart, setWeekStart] = useState(defaultWeekStart);
  // dayLines[0..6] = array of line objects per day
  const [dayLines, setDayLines] = useState(() => Array(7).fill(null).map(() => [EMPTY_WLINE()]));
  // active tab index — find today within the default week
  const todayDi = (() => {
    for (let i = 0; i < 7; i++) {
      const d = new Date(defaultWeekStart + 'T00:00:00'); d.setDate(d.getDate() + i);
      if (localDateStr(d) === todayStr) return i;
    }
    return 0;
  })();
  const [activeDay, setActiveDay] = useState(todayDi);

  const { data: employees = [] } = useQuery({ queryKey: ['employees'],  queryFn: () => api.get('/employees').then((r) => r.data) });
  const { data: projects  = [] } = useQuery({ queryKey: ['projects'],   queryFn: () => api.get('/projects').then((r) => r.data) });
  const { data: taskTypes = [] } = useQuery({ queryKey: ['task-types'], queryFn: () => api.get('/task-types').then((r) => r.data) });

  const { data: weekEntries = {} } = useQuery({
    queryKey: ['week-entries', employee, weekStart],
    queryFn: () => api.get('/timesheets/week-entries', { params: { employeeCode: employee, weekStart } }).then((r) => r.data),
    enabled: !!(employee && weekStart),
  });

  // Full PROJ timesheet data for the week (pre-populate + lock confirmed days)
  const { data: weekProjData = {}, isPending: projPending } = useQuery({
    queryKey: ['week-proj-data', employee, weekStart],
    queryFn: () => api.get('/timesheets/week-proj-data', { params: { employeeCode: employee, weekStart } }).then((r) => r.data),
    enabled: !!(employee && weekStart),
    staleTime: 30000,
  });

  // Reset lines when week or employee changes
  useEffect(() => {
    setDayLines(Array(7).fill(null).map(() => [EMPTY_WLINE()]));
  }, [employee, weekStart]);

  // Once PROJ data loads, populate dayLines for days that have saved timesheets
  useEffect(() => {
    if (projPending) return;
    setDayLines(Array(7).fill(null).map((_, di) => {
      const date = dates[di];
      const dp = date ? weekProjData[date] : null;
      if (dp?.lines?.length > 0) {
        return dp.lines.map((l) => ({
          _key: ++_wLineKey,
          _isExisting: true,
          _savedStatus: dp.status,
          projectId: l.projectId ?? '',
          taskType:  l.taskTypeCode ?? '',
          startTime: l.startTime ?? '',
          endTime:   l.endTime ?? '',
          attachment: null,
          existingAttachments: [],
          comments: l.comments ?? '',
          commentOpen: Boolean(l.comments),
        }));
      }
      return [EMPTY_WLINE()];
    }));
  }, [weekProjData, projPending]);

  const dates = (() => {
    if (!weekStart) return Array(7).fill('');
    return Array(7).fill(null).map((_, i) => {
      const d = new Date(weekStart + 'T00:00:00'); d.setDate(d.getDate() + i);
      return localDateStr(d);
    });
  })();

  const weekEnd = dates[6] ?? '';

  // When the week changes, snap activeDay to the last non-future day so we never
  // land on a future tab (e.g. navigating forward then back leaves Friday selected)
  useEffect(() => {
    if (!dates[activeDay] || dates[activeDay] > todayStr) {
      const lastValid = dates.reduce((best, d, i) => (d && d <= todayStr ? i : best), 0);
      setActiveDay(lastValid);
    }
  }, [weekStart]);

  function setLine(di, li, field, val) {
    setDayLines((all) => all.map((day, d) => d !== di ? day : day.map((ln, l) => l !== li ? ln : { ...ln, [field]: val })));
  }
  function addLine(di) {
    setDayLines((all) => all.map((day, d) => d !== di ? day : [...day, EMPTY_WLINE()]));
  }
  function removeLine(di, li) {
    setDayLines((all) => all.map((day, d) => d !== di ? day : day.filter((_, l) => l !== li)));
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

  const empOptions  = employees.map((e) => ({ value: e.employeeNo, label: `${e.employeeNo} – ${[e.firstName, e.lastname].filter(Boolean).join(' ')}` }));
  const projOptions = projects.map((p) => ({ value: p.projectCode, label: `${p.projectCode} – ${p.projectName ?? ''}` }));
  const ttOptions   = taskTypes.map((t) => ({ value: t.taskTypeCode ?? t.name, label: t.taskTypeName ?? t.name }));

  const toMins = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hm     = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const COLORS  = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];

  function fmtMins(mins) {
    if (!mins) return null;
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
  }

  // Per-day totals
  const dayTotals = dayLines.map((lines) =>
    lines.reduce((sum, l) => sum + (parseInt(calcMins(l.startTime, l.endTime), 10) || 0), 0)
  );
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  // Per-day lock status from saved PROJ data
  const dayLocked = dates.map((date) => {
    const dp = date ? weekProjData[date] : null;
    return dp ? ['Approved', 'Submitted'].includes(dp.status) : false;
  });
  const dayDocNo = dates.map((date) => {
    const dp = date ? weekProjData[date] : null;
    return dp?.docNo ?? null;
  });
  const dayStatus = dates.map((date) => {
    const dp = date ? weekProjData[date] : null;
    return dp?.status ?? null;
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!employee) { toast('Select an employee.', 'error'); return; }

    // Collect only new (non-existing) active lines; skip too-old days
    const activeEntries = [];
    dayLines.forEach((lines, di) => {
      if (!dates[di] || dates[di] < minEntryDate) return; // too old
      lines.forEach((ln, li) => {
        if (ln._isExisting) return; // approved/saved line — cannot re-save
        if (ln.projectId?.trim() || ln.taskType?.trim() || ln.startTime || ln.endTime) {
          activeEntries.push({ ln, di, li });
        }
      });
    });

    if (activeEntries.length === 0) { toast('Add at least one new line with data (within the past 7 days).', 'error'); return; }

    // Block entries on future dates (second line of defence after UI)
    const futureEntry = activeEntries.find(({ di }) => dates[di] > todayStr);
    if (futureEntry) { toast(`${DAYS[futureEntry.di]}: Cannot save entries for future dates.`, 'error'); return; }

    for (const { ln, di, li } of activeEntries) {
      const label = `${DAYS[di]} Line ${li + 1}`;
      if (!ln.projectId?.trim()) { toast(`${label}: Project is required.`, 'error'); return; }
      if (!ln.taskType?.trim())  { toast(`${label}: Task Type is required.`, 'error'); return; }
      if (!ln.startTime)         { toast(`${label}: Start Time is required.`, 'error'); return; }
      if (!ln.endTime)           { toast(`${label}: End Time is required.`, 'error'); return; }
      const sm = Number(calcMins('00:00', ln.startTime));
      const em = Number(calcMins('00:00', ln.endTime));
      if (sm === em) { toast(`${label}: Start and end time cannot be the same.`, 'error'); return; }
      if (em < sm)   { toast(`${label}: End time must be after start time.`, 'error'); return; }
    }

    // Build rows for backend
    const rows = [];
    dayLines.forEach((lines, di) => {
      lines.forEach((ln) => {
        if (!ln.startTime && !ln.endTime) return;
        rows.push({
          projectId:  ln.projectId,
          taskType:   ln.taskType,
          comment:    ln.comments,
          attachment: ln.attachment,
          days:  Array(7).fill(null).map((_, i) => ({ s: i === di ? ln.startTime : '', e: i === di ? ln.endTime : '' })),
          dates,
        });
      });
    });
    save({ employee, weekStart, rows });
  }

  // Derived per-day data (computed once, used in tab bar and panel)
  const dayData = dates.map((date, di) => {
    const lines      = dayLines[di];
    const isToday    = date === todayStr;
    const isFuture   = date > todayStr;
    const isTooOld   = date < minEntryDate;
    const canAddNew  = !isFuture && !isTooOld;
    const isLocked   = dayLocked[di];
    const docNo      = dayDocNo[di];
    const status     = dayStatus[di];
    const dayMins    = dayTotals[di];
    const otherSegs  = (weekEntries[date] ?? [])
      .map((e) => ({ ...e, s: toMins(e.startTime), e: toMins(e.endTime) }))
      .filter((e) => e.s != null && e.e != null && e.e > e.s);
    const currentSegs = lines
      .map((l, li) => ({ li, s: toMins(l.startTime), e: toMins(l.endTime), projectId: l.projectId }))
      .filter((seg) => seg.s != null && seg.e != null && seg.e > seg.s);
    const hasOverlap = canAddNew && currentSegs.filter((c) => !c._isExisting).some((c) => otherSegs.some((o) => c.s < o.e && c.e > o.s));
    const allMins = [...currentSegs.flatMap((s) => [s.s, s.e]), ...otherSegs.flatMap((s) => [s.s, s.e])];
    const tl = allMins.length > 0 ? (() => {
      const vs = Math.max(0,    Math.floor((Math.min(...allMins) - 30) / 60) * 60);
      const ve = Math.min(1440, Math.ceil ((Math.max(...allMins) + 30) / 60) * 60);
      const sp = ve - vs;
      const p  = (m) => ((m - vs) / sp * 100).toFixed(3) + '%';
      const ww = (s, e) => ((e - s) / sp * 100).toFixed(3) + '%';
      const tks = [];
      for (let m = Math.ceil(vs / 60) * 60; m <= ve; m += 60) tks.push(m);
      return { p, ww, tks };
    })() : null;
    return { date, lines, isToday, isFuture, isTooOld, canAddNew, isLocked, docNo, status, dayMins, otherSegs, currentSegs, hasOverlap, tl };
  });

  const ad = dayData[activeDay]; // active day data

  return (
    <div className="page-content">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Weekly Timesheet</div>
          <div className="page-sub">Projects Team · each filled day is saved as its own daily timesheet</div>
        </div>
        <div className="btn-row">
          <button className="btn btn-outline btn-sm" type="button" onClick={onBack}>← Back</button>
          <button className="btn btn-primary btn-sm" type="button" disabled={saving} onClick={handleSubmit}>
            {saving ? 'Saving…' : '💾 Save Week'}
          </button>
        </div>
      </div>

      {/* ── Header strip: week nav + employee ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0 14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="btn btn-outline btn-sm" style={{ padding: '4px 10px' }}
            onClick={() => { const d = new Date(weekStart + 'T00:00:00'); d.setDate(d.getDate() - 7); setWeekStart(localDateStr(d)); }}>◀</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', minWidth: 148, textAlign: 'center' }}>
            {weekStart && weekEnd
              ? `${new Date(weekStart + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(weekEnd + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : '—'}
          </span>
          <button type="button" className="btn btn-outline btn-sm" style={{ padding: '4px 10px' }}
            disabled={weekStart >= defaultWeekStart}
            onClick={() => { const d = new Date(weekStart + 'T00:00:00'); d.setDate(d.getDate() + 7); setWeekStart(localDateStr(d)); }}>▶</button>
          <input type="date" className="form-control" style={{ width: 140, height: 32, fontSize: 13 }} value={weekStart}
            max={defaultWeekStart}
            onChange={(e) => {
              const d = new Date(e.target.value + 'T00:00:00');
              d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // snap to Monday
              setWeekStart(localDateStr(d));
            }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <label style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, whiteSpace: 'nowrap' }}>Employee</label>
          {isAdmin ? (
            <div style={{ width: isMobile ? '100%' : 260 }}>
              <SearchSelect options={empOptions} value={employee} onChange={setEmployee} placeholder="Search employee…" />
            </div>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{employee || '—'}</span>
          )}
        </div>

        {weekTotal > 0 && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '4px 14px', fontSize: 13, fontWeight: 700, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
            {fmtMins(weekTotal)} this week
          </div>
        )}
      </div>

      {/* ── Day tab bar ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 0, overflowX: 'auto' }}>
        {dayData.map(({ date, isToday, isFuture, isTooOld, isLocked, status, dayMins, hasOverlap }, di) => {
          const isActive = di === activeDay;
          const hasDraft = status === 'Draft';
          const notEditable = isFuture || isTooOld;
          return (
            <button key={di} type="button"
              onClick={() => !isFuture && setActiveDay(di)}
              disabled={isFuture}
              title={isFuture ? 'Future date' : isTooOld ? 'Too old — view only (> 7 days)' : isLocked ? `${status} — existing lines read-only` : undefined}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 10px 10px',
                border: 'none',
                borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                marginBottom: -2,
                background: isFuture ? '#f9fafb' : isTooOld ? (isActive ? '#fafafa' : 'transparent') : isLocked ? (isActive ? '#f0fdf4' : '#f9fafb') : isActive ? '#eff6ff' : isToday ? '#f0fdf4' : 'transparent',
                borderRadius: '6px 6px 0 0',
                cursor: isFuture ? 'not-allowed' : 'pointer',
                minWidth: 80, flex: '1 1 80px',
                opacity: notEditable ? 0.55 : 1,
                transition: 'background .12s',
              }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: isFuture ? '#9ca3af' : isTooOld ? '#9ca3af' : isLocked ? '#15803d' : isActive ? '#1d4ed8' : isToday ? '#15803d' : '#374151' }}>
                {DAYS[di]}
              </span>
              <span style={{ fontSize: 10, color: isActive ? '#3b82f6' : '#9ca3af', marginTop: 1 }}>
                {date ? new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
              </span>
              <div style={{ display: 'flex', gap: 3, marginTop: 4, alignItems: 'center', minHeight: 14 }}>
                {dayMins > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: isActive ? '#1d4ed8' : '#374151', background: isActive ? '#dbeafe' : '#f1f5f9', borderRadius: 4, padding: '1px 5px' }}>
                    {fmtMins(dayMins)}
                  </span>
                )}
                {isLocked && <span style={{ fontSize: 9, color: '#15803d' }} title="Approved — existing lines locked">✓</span>}
                {hasDraft && <span style={{ fontSize: 9, color: '#f59e0b' }} title="Draft — editable">●</span>}
                {hasOverlap && <span style={{ fontSize: 9, color: '#ef4444' }} title="Time overlap">⚠</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Active day panel ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
        {/* Day sub-header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 12px', borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: ad.isToday ? '#1d4ed8' : '#111827' }}>
            {DAYS[activeDay]}
          </span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {ad.date ? new Date(ad.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
          </span>
          {ad.isToday && <span style={{ fontSize: 10, fontWeight: 700, color: '#15803d', background: '#dcfce7', borderRadius: 4, padding: '1px 7px' }}>Today</span>}
          {ad.isLocked && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#15803d', background: '#dcfce7', borderRadius: 4, padding: '1px 7px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              {ad.status} · {ad.docNo} · existing lines locked
            </span>
          )}
          {ad.status === 'Draft' && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7', borderRadius: 4, padding: '1px 7px' }}>
              Draft · {ad.docNo}
            </span>
          )}
          {ad.isTooOld && !ad.status && (
            <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', background: '#f3f4f6', borderRadius: 4, padding: '1px 7px' }}>
              View only — older than 7 days
            </span>
          )}
          {ad.dayMins > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', borderRadius: 6, padding: '2px 10px' }}>
              {fmtMins(ad.dayMins)}
            </span>
          )}
        </div>

        {/* ── Timeline ── */}
        {(() => {
          const { currentSegs, otherSegs, hasOverlap } = ad;
          if (currentSegs.length === 0 && otherSegs.length === 0) return null;
          const allMins = [...currentSegs.flatMap((s) => [s.s, s.e]), ...otherSegs.flatMap((s) => [s.s, s.e])];
          const vs = Math.max(0,    Math.floor((Math.min(...allMins) - 30) / 60) * 60);
          const ve = Math.min(1440, Math.ceil ((Math.max(...allMins) + 30) / 60) * 60);
          const sp = ve - vs;
          const pct = (m) => ((m - vs) / sp * 100).toFixed(3) + '%';
          const ww  = (s, e) => ((e - s) / sp * 100).toFixed(3) + '%';
          const tks = [];
          for (let m = Math.ceil(vs / 60) * 60; m <= ve; m += 60) tks.push(m);
          const trackStyle = { position: 'relative', height: 20, background: '#f1f5f9', borderRadius: 6, flex: 1 };
          const tickLines = tks.map((m) => (
            <div key={m} style={{ position: 'absolute', left: pct(m), top: 0, bottom: 0, width: 1, background: '#e2e8f0' }} />
          ));
          return (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
              {/* tick labels */}
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ width: 68, flexShrink: 0 }} />
                <div style={{ position: 'relative', flex: 1, height: 14, marginBottom: 4 }}>
                  {tks.map((m) => (
                    <span key={m} style={{ position: 'absolute', left: pct(m), transform: 'translateX(-50%)', fontSize: 9, color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{hm(m)}</span>
                  ))}
                </div>
              </div>
              {/* This entry track */}
              {currentSegs.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#6b7280', width: 68, flexShrink: 0, textAlign: 'right' }}>This entry</span>
                  <div style={trackStyle}>
                    {tickLines}
                    {currentSegs.map((seg, si) => (
                      <div key={si} title={`L${seg.li + 1} · ${seg.projectId || '—'} · ${hm(seg.s)}–${hm(seg.e)}`}
                        style={{ position: 'absolute', left: pct(seg.s), width: ww(seg.s, seg.e), top: 2, bottom: 2, background: COLORS[si % COLORS.length], borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {(seg.e - seg.s) >= 45 && <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', padding: '0 4px' }}>L{seg.li + 1}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Other timesheets track */}
              {otherSegs.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#6b7280', width: 68, flexShrink: 0, textAlign: 'right' }}>Other</span>
                  <div style={trackStyle}>
                    {tickLines}
                    {otherSegs.map((seg, si) => (
                      <div key={si} title={`${seg.tsDocNo} · ${seg.label} · ${hm(seg.s)}–${hm(seg.e)} (${seg.status})`}
                        style={{ position: 'absolute', left: pct(seg.s), width: ww(seg.s, seg.e), top: 2, bottom: 2, background: '#94a3b8', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {(seg.e - seg.s) >= 45 && <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', padding: '0 4px' }}>{seg.tsType}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hasOverlap && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 8px', background: '#fef3c7', borderRadius: 4, border: '1px solid #fcd34d' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span style={{ fontSize: 10, color: '#92400e', fontWeight: 600 }}>Time overlap with another timesheet entry for this employee on this date</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Line table */}
        <div style={{ padding: '16px' }}>
        <table className="ts-line-table" style={{ marginBottom: 8 }}>
          <thead>
            <tr>
              <th style={{ width: 32, textAlign: 'center' }}>#</th>
              <th>Project</th>
              <th style={{ width: 160 }}>Task Type</th>
              <th style={{ width: 110 }}>Start</th>
              <th style={{ width: 110 }}>End</th>
              <th style={{ width: 84, textAlign: 'center' }}>Duration</th>
              <th style={{ width: 190 }}>Attachment</th>
              <th style={{ width: 44, textAlign: 'center' }}>Note</th>
              <th style={{ width: 32 }}></th>
            </tr>
          </thead>
          <tbody>
            {ad.lines.map((line, li) => {
              const mins = parseInt(calcMins(line.startTime, line.endTime), 10) || 0;
              const lineRO = line._isExisting || !ad.canAddNew; // read-only if saved or too old
              return (
                <React.Fragment key={line._key}>
                  <tr style={{ background: line._isExisting ? '#f9fafb' : undefined }}>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: line._isExisting ? '#94a3b8' : COLORS[li % COLORS.length], fontSize: 10, fontWeight: 700, color: '#fff' }}>{li + 1}</span>
                    </td>
                    <td>
                      {lineRO
                        ? <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', padding: '0 4px' }}>{line.projectId || '—'}</span>
                        : <SearchSelect options={projOptions} value={line.projectId}
                            onChange={(v) => setLine(activeDay, li, 'projectId', v)} placeholder="Search project…" />
                      }
                    </td>
                    <td>
                      {lineRO
                        ? <span style={{ fontSize: 13, color: '#374151', padding: '0 4px' }}>{ttOptions.find((t) => t.value === line.taskType)?.label || line.taskType || '—'}</span>
                        : <select style={{ width: '100%' }} value={line.taskType}
                            onChange={(e) => setLine(activeDay, li, 'taskType', e.target.value)}>
                            <option value="">— select —</option>
                            {ttOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                      }
                    </td>
                    <td>
                      {lineRO
                        ? <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', padding: '0 4px', fontFamily: 'monospace' }}>{line.startTime || '—'}</span>
                        : <TimeInput value={line.startTime} onChange={(v) => setLine(activeDay, li, 'startTime', v)} />
                      }
                    </td>
                    <td>
                      {lineRO
                        ? <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', padding: '0 4px', fontFamily: 'monospace' }}>{line.endTime || '—'}</span>
                        : <TimeInput value={line.endTime} onChange={(v) => setLine(activeDay, li, 'endTime', v)} />
                      }
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {mins > 0
                        ? <span style={{ background: line._isExisting ? '#f0fdf4' : '#eff6ff', color: line._isExisting ? '#15803d' : '#2563eb', fontWeight: 700, fontSize: 11, borderRadius: 5, padding: '2px 8px' }}>{fmtMins(mins)}</span>
                        : <span style={{ color: '#e2e8f0' }}>—</span>}
                    </td>
                    <td>
                      <AttachCell
                        attachment={line.attachment}
                        existingAttachments={line.existingAttachments}
                        onAdd={(att) => setLine(activeDay, li, 'attachment', att)}
                        onRemoveNew={() => setLine(activeDay, li, 'attachment', null)}
                        onRemoveExisting={() => {}}
                        readOnly={lineRO}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {line.comments ? (
                        <button type="button" title={lineRO ? 'View note' : 'Edit note'}
                          onClick={() => setLine(activeDay, li, 'commentOpen', !line.commentOpen)}
                          style={{ border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: '#2563eb', background: line.commentOpen ? '#eff6ff' : 'transparent' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#dbeafe" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </button>
                      ) : !lineRO ? (
                        <button type="button" title="Add note"
                          onClick={() => setLine(activeDay, li, 'commentOpen', !line.commentOpen)}
                          style={{ border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: '#d1d5db', background: 'transparent' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </button>
                      ) : null}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {!line._isExisting && ad.lines.filter((l) => !l._isExisting).length > 1 && (
                        <button type="button" className="del-row-btn" onClick={() => removeLine(activeDay, li)} title="Remove">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </td>
                  </tr>
                  {line.commentOpen && (
                    <tr style={{ background: '#f8faff' }}>
                      <td colSpan={9} style={{ padding: '6px 16px 10px 52px' }}>
                        <textarea
                          value={line.comments}
                          readOnly={lineRO}
                          onChange={(e) => !lineRO && setLine(activeDay, li, 'comments', e.target.value)}
                          placeholder="Add a note for this line…"
                          rows={2}
                          style={{ width: '100%', fontSize: 12, resize: 'vertical', borderRadius: 6, border: '1px solid #e5e7eb', padding: '6px 10px', color: '#374151', background: lineRO ? '#f9fafb' : '#fff', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {ad.canAddNew && (
          <button type="button" className="ts-add-btn" onClick={() => addLine(activeDay)}>+ Add Line</button>
        )}
        {!ad.canAddNew && ad.isTooOld && (
          <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', padding: '4px 0' }}>
            This day is older than 7 days — new entries cannot be added.
          </div>
        )}
        </div>
      </div>
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
          {/* <option value="weekly">Weekly Entry</option> */}
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
    { key: 'createdAt',      label: 'Created Date', sort: true, render: (r) => formatDate(r.createdAt) },
    { key: 'entered_by_name',label: 'Employee',     sort: true },
    { key: 'status', label: 'Status', sort: true, render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'draft'}>{r.status ?? '—'}</Badge> },
    {
      key: 'actions', label: '', sort: false,
      render: (row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="wip-icon-btn wip-icon-btn-view" title="View"
            onClick={() => { setEditDocNo(row.docNo); setIsReadonly(true); setView('daily'); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          {canWrite && isWithin24h(row.createdAt) && row.status !== 'Approved' && (
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
    const handleSaved = (savedDocNo) => {
      if (savedDocNo && !editDocNo) {
        // New save: immediately open the record in read-only mode to verify data
        setEditDocNo(savedDocNo);
        setIsReadonly(true);
      } else {
        goBack();
      }
    };
    return <DailyForm editDocNo={editDocNo} readOnly={isReadonly} onBack={goBack} onSaved={handleSaved} onEdit={() => setIsReadonly(false)} />;
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
