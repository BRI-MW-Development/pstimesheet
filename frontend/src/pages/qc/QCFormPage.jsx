import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import SearchSelect from '../../components/ui/SearchSelect';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../store/authStore';

/* ── QC Checklist Template ─────────────────────────────────────────── */
const QC_SECTIONS = [
  { name: 'Letter Moulding',               items: ['Workmanship', 'Surface Finish', 'Quality', 'Depth of Material', 'Origin and Side Finish'] },
  { name: 'Metal Fabrication',             items: ['Structural & Support', 'Material Type / Size', 'Surface Finish', 'Fixing Methods & Assembly', 'Quantity'] },
  { name: 'CNC Laser Cutting',             items: ['Quantity', 'Cutting Quality', 'Verify Cutting Files', 'Material Types', 'Fixing', 'Workmanship'] },
  { name: 'Acrylic',                       items: ['Fixing', 'Workmanship', 'Material Specification', 'Quantity', 'Surface Finish'] },
  { name: 'Packaging',                     items: ['Quantity', 'Physical Damage', 'Workmanship'] },
  { name: 'Electrical',                    items: ['Quantity', 'Efficient Temperature & Illumination', 'Verify Electrical Components', 'Visual Checkout (Darkroom)'] },
  { name: 'Painting',                      items: ['Quantity', 'Workmanship', 'Surface Finish', 'Colour / Coat'] },
  { name: 'Vinyl / Graphics / ScreenPrinting', items: ['Material Specification', 'Print Quality', 'Workmanship', 'Surface Finish'] },
  { name: 'Slitting',                      items: ['Surface Finish', 'Workmanship'] },
  { name: 'Outsourced & Fixing Materials', items: ['Fixing', 'Quantity', 'Surface Finish', 'Material Specification', 'Workmanship'] },
  { name: 'Sending',                       items: ['Powder Coating Cost', 'Workmanship', 'Surface Finish'] },
];

const RESULT_OPTIONS = ['Pass', 'Fail', 'N/A'];
const STATUS_OPTIONS = ['Draft', 'In Progress', 'Passed', 'Failed', 'Closed'];

function defaultChecklist() {
  const cl = {};
  QC_SECTIONS.forEach((s) => {
    cl[s.name] = {};
    s.items.forEach((item) => { cl[s.name][item] = 'Pass'; });
  });
  return cl;
}

/* ── Result badge ───────────────────────────────────────────────────── */
function ResultBadge({ value }) {
  const colors = {
    Pass: { bg: 'rgba(45,122,79,0.12)', color: '#2d7a4f', border: 'rgba(45,122,79,0.3)' },
    Fail: { bg: 'rgba(185,28,28,0.1)',  color: '#b91c1c', border: 'rgba(185,28,28,0.3)' },
    'N/A': { bg: 'rgba(100,80,40,0.08)', color: '#6b5e4a', border: 'rgba(100,80,40,0.2)' },
  };
  const c = colors[value] ?? colors['N/A'];
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {value || '—'}
    </span>
  );
}

/* ── Section card ───────────────────────────────────────────────────── */
function SectionCard({ section, values, onChange, readonly }) {
  const passCount = section.items.filter((i) => values[i] === 'Pass').length;
  const allPass = passCount === section.items.length;
  const hasFail = section.items.some((i) => values[i] === 'Fail');

  const headerBg = hasFail ? '#b91c1c' : allPass ? '#3d8c70' : '#c47d28';

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Section header */}
      <div style={{ background: headerBg, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {hasFail ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <polyline points="20 6 9 17 4 12"/>}
        </svg>
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{section.name}</span>
        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{passCount}/{section.items.length}</span>
      </div>
      {/* Items grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', padding: '10px 14px 12px' }}>
        {section.items.map((item) => (
          <div key={item} style={{ padding: '6px 8px 6px 0' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontWeight: 500 }}>{item}</div>
            {readonly ? (
              <ResultBadge value={values[item]} />
            ) : (
              <div style={{ display: 'flex', gap: 4 }}>
                {RESULT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(section.name, item, opt)}
                    style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${opt === 'Pass' ? 'rgba(45,122,79,0.4)' : opt === 'Fail' ? 'rgba(185,28,28,0.4)' : 'rgba(100,80,40,0.25)'}`,
                      background: values[item] === opt
                        ? (opt === 'Pass' ? 'rgba(45,122,79,0.15)' : opt === 'Fail' ? 'rgba(185,28,28,0.12)' : 'rgba(100,80,40,0.1)')
                        : 'transparent',
                      color: values[item] === opt
                        ? (opt === 'Pass' ? '#2d7a4f' : opt === 'Fail' ? '#b91c1c' : '#6b5e4a')
                        : 'var(--text3)',
                      opacity: values[item] === opt ? 1 : 0.55,
                    }}
                  >{opt}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Comment item ───────────────────────────────────────────────────── */
function CommentItem({ comment, onDelete, canDelete }) {
  const dt = new Date(comment.createdAt);
  const dateStr = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
        {(comment.authorName || '?')[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{comment.authorName}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>{dateStr} {timeStr}</span>
            {canDelete && (
              <button type="button" onClick={() => onDelete(comment.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1 }}>✕</button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3, lineHeight: 1.5 }}>{comment.commentText}</div>
      </div>
    </div>
  );
}

/* ── Main form ──────────────────────────────────────────────────────── */
export default function QCFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isEdit = Boolean(id);
  const isView = useLocation().pathname.endsWith('/view');
  const fileInputRef = useRef(null);

  const isApprover = user?.canApprove || ['Admin', 'Manager', 'Supervisor'].includes(user?.roleCode);

  const [header, setHeader] = useState({
    workOrderNo: '', signType: '', projectCode: '', projectName: '',
    customerName: '', qcDate: new Date().toISOString().slice(0, 10),
    quantity: '', partialFull: 'Full', qcInspector: '', status: 'Draft', remarks: '',
  });
  const [checklist, setChecklist] = useState(defaultChecklist);
  const [newComment, setNewComment] = useState('');

  // Data queries
  const { data: projects   = [] } = useQuery({ queryKey: ['projects'],    queryFn: () => api.get('/projects').then((r) => r.data) });
  const { data: workOrders = [] } = useQuery({ queryKey: ['work-orders'], queryFn: () => api.get('/work-orders').then((r) => r.data) });
  const { data: employees  = [] } = useQuery({ queryKey: ['employees'],   queryFn: () => api.get('/employees').then((r) => r.data) });

  const { data: existing } = useQuery({
    queryKey: ['qc', id],
    queryFn: () => api.get(`/qc/${id}`).then((r) => r.data),
    enabled: isEdit,
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['qc-comments', id],
    queryFn: () => api.get(`/qc/${id}/comments`).then((r) => r.data),
    enabled: isEdit,
  });

  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ['qc-attachments', id],
    queryFn: () => api.get(`/qc/${id}/attachments`).then((r) => r.data),
    enabled: isEdit,
  });

  // Load existing record
  useEffect(() => {
    if (!existing) return;
    setHeader({
      workOrderNo:  existing.workOrderNo   ?? '',
      signType:     existing.signType      ?? '',
      projectCode:  existing.projectCode   ?? '',
      projectName:  existing.projectName   ?? '',
      customerName: existing.customerName  ?? '',
      qcDate:       existing.qcDate?.slice(0, 10) ?? '',
      quantity:     existing.quantity      ?? '',
      partialFull:  existing.partialFull   ?? 'Full',
      qcInspector:  existing.qcInspector   ?? '',
      status:       existing.status        ?? 'Draft',
      remarks:      existing.remarks       ?? '',
    });
    if (existing.checklistData) {
      try { setChecklist({ ...defaultChecklist(), ...JSON.parse(existing.checklistData) }); }
      catch { /* keep default */ }
    }
  }, [existing]);

  const tsStatus = existing?.status ?? null;
  const isReadonly = isView || tsStatus === 'Passed' || tsStatus === 'Closed' || (tsStatus === 'In Progress' && !isApprover);

  // Save mutation
  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload) =>
      isEdit
        ? api.put(`/qc/${id}`, payload).then((r) => r.data)
        : api.post('/qc', payload).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['qc-records'] });
      toast(isEdit ? 'QC record updated.' : 'QC record created.', 'success');
      if (!isEdit && data?.id) navigate(`/qc/${data.id}/edit`);
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  // Comment mutation
  const { mutate: postComment } = useMutation({
    mutationFn: (text) => api.post(`/qc/${id}/comments`, { commentText: text }).then((r) => r.data),
    onSuccess: () => { setNewComment(''); refetchComments(); },
    onError: () => toast('Comment failed.', 'error'),
  });

  const { mutate: deleteComment } = useMutation({
    mutationFn: (cId) => api.delete(`/qc/comments/${cId}`).then((r) => r.data),
    onSuccess: () => refetchComments(),
  });

  // File upload
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.post(`/qc/${id}/attachments`, {
          fileName: file.name, mimeType: file.type,
          fileData: reader.result, fileSize: file.size,
        });
        refetchAttachments();
        toast('File uploaded.', 'success');
      } catch { toast('Upload failed.', 'error'); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleDownload(attach) {
    try {
      const res = await api.get(`/qc/attachments/${attach.id}/download`);
      const a = document.createElement('a');
      a.href = res.data.fileData;
      a.download = res.data.fileName;
      a.click();
    } catch { toast('Download failed.', 'error'); }
  }

  const { mutate: deleteAttach } = useMutation({
    mutationFn: (aId) => api.delete(`/qc/attachments/${aId}`).then((r) => r.data),
    onSuccess: () => refetchAttachments(),
  });

  function handleChecklistChange(section, item, value) {
    setChecklist((prev) => ({ ...prev, [section]: { ...prev[section], [item]: value } }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    save({ ...header, checklistData: checklist });
  }

  // Header field helpers
  function setHdr(f, v) { setHeader((h) => ({ ...h, [f]: v })); }

  const projOptions = projects.map((p) => {
    const code = p.projectCode ?? p.projectId;
    return { value: code, label: code, search: `${code} ${p.projectName ?? ''}` };
  });
  const woOptions  = workOrders.map((w) => ({ value: w.workOrderNumber, label: w.workOrderNumber, search: `${w.workOrderNumber} ${w.projectName ?? ''}` }));
  const empOptions = employees.map((e) => ({ value: `${e.firstName ?? ''} ${e.lastname ?? ''}`.trim(), label: `${e.firstName ?? ''} ${e.lastname ?? ''}`.trim() }));

  const statusColor = { Draft: '#6b5e4a', 'In Progress': '#2563a8', Passed: '#2d7a4f', Failed: '#b91c1c', Closed: '#a0907a' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Top bar ── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              {isReadonly && isEdit ? `QC Record — ${existing?.docNo ?? id}` : isEdit ? `Edit QC — ${existing?.docNo ?? id}` : 'New QC Record'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
              {isReadonly ? (tsStatus === 'Passed' ? 'Passed — read-only' : tsStatus === 'Closed' ? 'Closed — read-only' : 'Read-only view') : 'QC Module'}
            </div>
          </div>
          {existing?.status && (
            <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${statusColor[existing.status]}18`, color: statusColor[existing.status], border: `1px solid ${statusColor[existing.status]}40` }}>
              {existing.status}
            </span>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/qc')}>← Back</button>
      </div>

      {/* ── Body ── */}
      <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: header + checklist */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Header card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>QC Module</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px 20px' }}>
              {/* Row 1 */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Work Order #</label>
                <SearchSelect options={woOptions} value={header.workOrderNo}
                  onChange={(v) => setHdr('workOrderNo', v)} placeholder="Select…" disabled={isReadonly} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>QC Number</label>
                <input className="form-control" value={existing?.docNo ?? '(auto)'} readOnly style={{ background: 'var(--bg2)', color: 'var(--text3)', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Date</label>
                <input type="date" className="form-control" value={header.qcDate} disabled={isReadonly}
                  onChange={(e) => setHdr('qcDate', e.target.value)} style={{ fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Quantity</label>
                <input type="number" className="form-control" value={header.quantity} disabled={isReadonly} min={0}
                  onChange={(e) => setHdr('quantity', e.target.value)} placeholder="1" style={{ fontSize: 13 }} />
              </div>
              {/* Row 2 */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Sign Type</label>
                <input className="form-control" value={header.signType} disabled={isReadonly}
                  onChange={(e) => setHdr('signType', e.target.value)} placeholder="e.g. Metal Fabrication" style={{ fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Project</label>
                <SearchSelect options={projOptions} value={header.projectCode}
                  onChange={(v) => {
                    const proj = projects.find((p) => (p.projectCode ?? p.projectId) === v);
                    const rawName = proj?.projectName ?? '';
                    const projectName = rawName.includes(':') ? rawName.split(':').slice(1).join(':').trim() : rawName;
                    setHeader((h) => ({ ...h, projectCode: v, projectName, customerName: proj?.customerName ?? h.customerName }));
                  }}
                  placeholder="Project ID…" disabled={isReadonly} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Partial / Full</label>
                <select className="form-control" value={header.partialFull} disabled={isReadonly}
                  onChange={(e) => setHdr('partialFull', e.target.value)} style={{ fontSize: 13 }}>
                  <option>Full</option>
                  <option>Partial</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>QC Inspector</label>
                <input className="form-control" value={header.qcInspector} disabled={isReadonly}
                  onChange={(e) => setHdr('qcInspector', e.target.value)} placeholder="Inspector name" style={{ fontSize: 13 }} />
              </div>
              {/* Row 3 */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Project Name</label>
                <input className="form-control" value={header.projectName} readOnly style={{ background: 'var(--bg2)', color: 'var(--text2)', fontSize: 13 }} placeholder="Auto-filled" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Customer</label>
                <input className="form-control" value={header.customerName} readOnly style={{ background: 'var(--bg2)', color: 'var(--text2)', fontSize: 13 }} placeholder="Auto-filled" />
              </div>
              {!isReadonly && (
                <>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</label>
                    <select className="form-control" value={header.status} onChange={(e) => setHdr('status', e.target.value)} style={{ fontSize: 13 }}>
                      {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 3' }}>
                    <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Remarks</label>
                    <input className="form-control" value={header.remarks} onChange={(e) => setHdr('remarks', e.target.value)} placeholder="Optional remarks" style={{ fontSize: 13 }} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Checklist grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {QC_SECTIONS.map((section) => (
              <SectionCard
                key={section.name}
                section={section}
                values={checklist[section.name] ?? {}}
                onChange={handleChecklistChange}
                readonly={isReadonly}
              />
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)' }}>

          {/* Quality Check History */}
          <div style={{ borderBottom: '1px solid var(--border)', padding: '12px 14px 10px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Quality Check History</div>
            {existing?.status ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor[existing.status] ?? '#a0907a', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: statusColor[existing.status] ?? 'var(--text2)' }}>{existing.status}</span>
                </div>
                {existing.qcInspector && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', paddingLeft: 16 }}>Inspector: {existing.qcInspector}</div>
                )}
                {existing.updatedAt && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', paddingLeft: 16 }}>
                    {new Date(existing.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.3 }}>📋</div>
                No History Yet
              </div>
            )}
          </div>

          {/* Comments */}
          <div style={{ borderBottom: '1px solid var(--border)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 160 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', padding: '10px 14px 6px' }}>Comments</div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {comments.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text3)' }}>No comments yet.</div>
              ) : (
                comments.map((c) => (
                  <CommentItem key={c.id} comment={c} canDelete={isApprover || c.authorName === (user?.displayName ?? user?.username)} onDelete={deleteComment} />
                ))
              )}
            </div>
            {isEdit && (
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) { e.preventDefault(); postComment(newComment.trim()); } }}
                  placeholder="Add a comment…"
                  style={{ flex: 1, padding: '5px 8px', fontSize: 12, border: '1px solid var(--border2)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
                />
                <button type="button" className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: 11 }}
                  onClick={() => { if (newComment.trim()) postComment(newComment.trim()); }}>
                  Send
                </button>
              </div>
            )}
          </div>

          {/* Files */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: 220 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', padding: '10px 14px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Files</span>
              {isEdit && (
                <>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={() => fileInputRef.current?.click()}>+ Upload</button>
                  <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
                </>
              )}
            </div>
            <div style={{ overflowY: 'auto', padding: '0 12px 8px' }}>
              {attachments.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>No files attached.</div>
              ) : (
                attachments.map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.fileName}</span>
                    <button type="button" onClick={() => handleDownload(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', fontSize: 11, padding: '0 2px' }} title="Download">↓</button>
                    {isEdit && (
                      <button type="button" onClick={() => { if (confirm('Remove file?')) deleteAttach(a.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: '0 2px' }} title="Delete">✕</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer (inside form but outside scroll area) */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 280, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '10px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {isReadonly ? (
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/qc')}>← Back to List</button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/qc')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create QC Record'}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
