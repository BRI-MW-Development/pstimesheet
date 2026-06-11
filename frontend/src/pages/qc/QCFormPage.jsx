import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import SearchSelect from '../../components/ui/SearchSelect';
import CameraCapture from '../../components/ui/CameraCapture';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../store/authStore';

/* ── Colour tokens ─────────────────────────────────── */
const C = {
  teal:     '#0f7173', tealMid: '#1a9496', tealLight: '#e6f3f3',
  pass:     '#16a34a', passBg:  '#dcfce7', passBd: '#bbf7d0',
  fail:     '#dc2626', failBg:  '#fee2e2', failBd: '#fca5a5',
  amber:    '#d97706', amberBg: '#fef3c7',
  na:       '#6b7280', naBg:    '#f3f4f6', naBd: '#d1d5db',
};

const STATUS_STYLE = {
  'In Progress': { color: C.amber, bg: C.amberBg },
  Passed:        { color: C.pass,  bg: C.passBg  },
  Failed:        { color: C.fail,  bg: C.failBg  },
};
const STATUS_OPTIONS = ['In Progress', 'Passed', 'Failed'];

/* ── Checklist template ────────────────────────────── */
const QC_SECTIONS = [
  { name: 'Letter Moulding',                icon: '🔤', items: ['Workmanship', 'Surface Finish', 'Quantity', 'Depth of Material', 'Edges and Side Finish'] },
  { name: 'Metal Fabrication',              icon: '🔩', items: ['Structural & Support', 'Material Type / Size', 'Surface Finish', 'Fixing Methods & Assembly', 'Quantity'] },
  { name: 'CNC Laser Cutting',              icon: '✂️', items: ['Quantity', 'Cutting Quality', 'Verify Cutting Files', 'Material Types'] },
  { name: 'Acrylic',                        icon: '💎', items: ['Fixing', 'Workmanship', 'Material Specification', 'Quantity', 'Surface Finish'] },
  { name: 'Packaging',                      icon: '📦', items: ['Cleaning', 'Physical Damages', 'Workmanship', 'Quantity'] },
  { name: 'Electricals',                    icon: '⚡', items: ['LED Brand', 'Quantity', 'KELVIN Temperature & Illumination', 'Verify Electrical Components', 'Visual Checkup (Darkspots)'] },
  { name: 'Painting',                       icon: '🎨', items: ['Quantity', 'Workmanship', 'Surface Finish', 'Colour / Coat'] },
  { name: 'Vinyl / Graphics / ScreenPrinting', icon: '🖨️', items: ['Material Specification', 'Print Quality', 'Workmanship', 'Surface Finish'] },
  { name: 'Polishing',                      icon: '✨', items: ['Surface Finish', 'Workmanship'] },
  { name: 'Outsourced & Fixing Materials',  icon: '🔧', items: ['Quantity', 'Material Specification', 'Surface Finish', 'Workmanship'] },
  { name: 'Sanding',                        icon: '🪵', items: ['Powder Coating Coat', 'Workmanship', 'Surface Finish'] },
];

function defaultChecklist() {
  const cl = {};
  QC_SECTIONS.forEach(s => { cl[s.name] = {}; s.items.forEach(i => { cl[s.name][i] = ''; }); });
  return cl;
}
function defaultSectionNA() {
  const na = {};
  QC_SECTIONS.forEach(s => { na[s.name] = false; });
  return na;
}

/* ── Checklist item row ────────────────────────────── */
function ItemRow({ label, value, onChange, disabled, readonly }) {
  const isPass  = value === 'Pass';
  const isFail  = value === 'Fail';
  const isNA    = value === 'N/A' || disabled;
  const isEmpty = !value && !disabled; // not yet selected

  if (readonly) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 14px', borderBottom: '1px solid var(--border)', gap: 10, opacity: isNA ? 0.45 : 1 }}>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--text2)', textDecoration: isNA ? 'line-through' : 'none' }}>{label}</span>
        <span style={{
          padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: isNA ? C.naBg : isPass ? C.passBg : isFail ? C.failBg : 'var(--surface2)',
          color:      isNA ? C.na   : isPass ? C.pass   : isFail ? C.fail   : 'var(--text3)',
        }}>
          {isNA ? 'N/A' : isPass ? '✓ Pass' : isFail ? '✗ Fail' : '—'}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '7px 14px', borderBottom: '1px solid var(--border)', gap: 10,
      background: isNA ? 'var(--surface2)' : isPass ? '#f0fdf4' : isFail ? '#fff5f5' : isEmpty ? '#fffbeb' : 'var(--surface)',
      opacity: isNA ? 0.5 : 1, transition: 'background 0.15s, opacity 0.15s',
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: isNA ? 'var(--text3)' : isPass ? C.pass : isFail ? C.fail : '#f59e0b',
        transition: 'background 0.15s',
      }} />
      <span style={{ flex: 1, fontSize: 12, color: isNA ? 'var(--text3)' : 'var(--text)', fontWeight: 500, textDecoration: isNA ? 'line-through' : 'none' }}>
        {label}
      </span>
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${isEmpty ? '#fbbf24' : 'var(--border2)'}`, flexShrink: 0 }}>
        {[['Pass', '✓', C.pass, C.passBg], ['Fail', '✗', C.fail, C.failBg]].map(([opt, sym, col, bg]) => (
          <button key={opt} type="button" disabled={disabled}
            onClick={() => onChange(opt)}
            style={{
              padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
              border: 'none', borderRight: opt === 'Pass' ? '1px solid var(--border2)' : 'none',
              background: value === opt ? bg : 'var(--surface)',
              color:      value === opt ? col : 'var(--text3)',
              transition: 'all 0.12s',
            }}>
            {sym} {opt}
          </button>
        ))}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: disabled ? 'default' : 'pointer', flexShrink: 0 }}>
        <input type="checkbox" checked={value === 'N/A'} disabled={disabled}
          onChange={e => onChange(e.target.checked ? 'N/A' : '')}
          style={{ width: 12, height: 12, cursor: disabled ? 'default' : 'pointer', accentColor: C.na }} />
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>N/A</span>
      </label>
    </div>
  );
}

/* ── Section card ──────────────────────────────────── */
function SectionCard({ section, values, sectionNA, onItemChange, onSectionNA, readonly }) {
  const na      = sectionNA;
  const pass    = section.items.filter(i => !na && values[i] === 'Pass').length;
  const fail    = section.items.filter(i => !na && values[i] === 'Fail').length;
  const itemNA  = section.items.filter(i => !na && values[i] === 'N/A').length;
  const empty   = section.items.filter(i => !na && !values[i]).length;
  const active  = na ? 0 : section.items.length - itemNA;
  const allPass = !na && active > 0 && pass === active && empty === 0;
  const hasFail = !na && fail > 0;
  const hasEmpty = !na && empty > 0;

  const borderColor = na ? C.na : hasFail ? C.fail : allPass ? C.pass : hasEmpty ? '#f59e0b' : C.amber;
  const headerBg    = na ? 'var(--surface2)' : hasFail ? '#fff5f5' : allPass ? '#f0fdf4' : hasEmpty ? '#fffbeb' : 'var(--bg2)';

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border2)', borderLeft: `4px solid ${borderColor}`, boxShadow: 'var(--sh-sm)', transition: 'border-color 0.2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', background: headerBg, borderBottom: '1px solid var(--border)', gap: 8 }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>{section.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: na ? 'var(--text3)' : 'var(--text)', flex: 1, textDecoration: na ? 'line-through' : 'none' }}>
          {section.name}
        </span>
        {!na && (
          <div style={{ display: 'flex', gap: 4 }}>
            {empty > 0 && <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#d97706' }}>{empty} pending</span>}
            {pass > 0 && <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: C.passBg, color: C.pass }}>{pass}✓</span>}
            {fail > 0 && <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: C.failBg, color: C.fail }}>{fail}✗</span>}
            {itemNA > 0 && <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'var(--surface3)', color: 'var(--text3)' }}>{itemNA} N/A</span>}
          </div>
        )}
        {na && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'var(--surface3)', color: 'var(--text3)', letterSpacing: '0.04em' }}>NOT APPLICABLE</span>}
        {!readonly && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 4, flexShrink: 0 }}>
            <input type="checkbox" checked={na} onChange={e => onSectionNA(e.target.checked)}
              style={{ width: 13, height: 13, cursor: 'pointer', accentColor: C.na }} />
            <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>N/A Section</span>
          </label>
        )}
      </div>

      {/* Items */}
      {section.items.map(item => (
        <ItemRow key={item} label={item}
          value={na ? 'N/A' : (values[item] ?? 'Pass')}
          onChange={v => onItemChange(section.name, item, v)}
          disabled={na}
          readonly={readonly} />
      ))}
    </div>
  );
}

/* ── Comment ───────────────────────────────────────── */
function Comment({ c, onDelete, canDelete, currentUser }) {
  const dt = new Date(c.createdAt);
  const ini = (c.authorName || '?')[0].toUpperCase();
  // Show current user's profile pic if they authored this comment
  const imgUrl = c.authorName === (currentUser?.displayName ?? currentUser?.username)
    ? currentUser?.profileImageUrl
    : null;
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: `linear-gradient(135deg,${C.teal},${C.tealMid})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
        {imgUrl
          ? <img src={imgUrl} alt={ini} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{ e.target.style.display='none'; }} />
          : ini}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{c.authorName}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            {canDelete && <button type="button" onClick={() => onDelete(c.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, padding: 0 }}>✕</button>}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{c.commentText}</div>
      </div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────── */
export default function QCFormPage() {
  const { id }  = useParams();
  const navigate = useNavigate();
  const toast    = useToast();
  const queryClient = useQueryClient();
  const user     = useAuthStore(s => s.user);
  const isEdit   = Boolean(id);
  const isView   = useLocation().pathname.endsWith('/view');
  const fileInputRef   = useRef(null);
  const loadedId       = useRef(null);
  const pendingFilesRef = useRef([]);  // holds files queued before record exists
  const [showCamera,  setShowCamera]  = useState(false);
  const [mobQcTab,    setMobQcTab]    = useState('details'); // 'details' | 'checklist' | 'info'
  const [windowW, setWindowW] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWindowW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // No sidebar in this route — full viewport. Tabs on tablet/mobile.
  const isNarrow = windowW <= 900;

  const isApprover = user?.canApprove || ['Admin', 'Manager', 'Supervisor'].includes(user?.roleCode);

  const currentUserName = user?.displayName ?? user?.name ?? user?.username ?? '';
  const [header,    setHeader]    = useState({ workOrderNo: '', signType: '', projectCode: '', projectName: '', customerName: '', qcDate: new Date().toISOString().slice(0, 10), quantity: '', partialFull: 'Full', qcInspector: currentUserName, status: 'In Progress', remarks: '' });
  const [checklist, setChecklist] = useState(defaultChecklist);
  const [sectionNA, setSectionNA] = useState(defaultSectionNA);
  const [newComment,    setNewComment]    = useState('');
  const [activeTab,     setActiveTab]     = useState('history');
  const [pendingFiles,  setPendingFiles]  = useState([]);  // files queued on create form
  const [converting,   setConverting]    = useState(0);   // count of in-progress FileReader ops

  /* ── Queries ───────────────────────────────────── */
  const { data: projects    = [] } = useQuery({ queryKey: ['projects'],     queryFn: () => api.get('/projects').then(r => r.data) });
  const { data: workOrders  = [] } = useQuery({ queryKey: ['work-orders'],  queryFn: () => api.get('/work-orders').then(r => r.data) });
  const { data: completedWos = []} = useQuery({ queryKey: ['completed-wos'],queryFn: () => api.get('/wo-complete').then(r => r.data.map(w => w.workOrderNumber)) });
  const { data: existing }         = useQuery({ queryKey: ['qc', id], enabled: isEdit, queryFn: () => api.get(`/qc/${id}`).then(r => r.data) });
  const { data: comments = [],    refetch: refetchComments }    = useQuery({ queryKey: ['qc-comments', id],    enabled: isEdit, queryFn: () => api.get(`/qc/${id}/comments`).then(r => r.data) });
  const { data: attachments = [], refetch: refetchAttachments } = useQuery({ queryKey: ['qc-attachments', id], enabled: isEdit, queryFn: () => api.get(`/qc/${id}/attachments`).then(r => r.data) });
  // WO-level history: all QC records for the same work order
  const { data: woHistory = [] } = useQuery({
    queryKey: ['qc-wo-history', header.workOrderNo],
    queryFn: () => api.get('/qc', { params: { workOrderNo: header.workOrderNo } }).then(r => r.data),
    enabled: Boolean(header.workOrderNo),
  });

  /* ── Load existing record (once per record) ────── */
  useEffect(() => {
    if (!existing || loadedId.current === existing.id) return;
    loadedId.current = existing.id;
    setHeader({ workOrderNo: existing.workOrderNo ?? '', signType: existing.signType ?? '', projectCode: existing.projectCode ?? '', projectName: existing.projectName ?? '', customerName: existing.customerName ?? '', qcDate: existing.qcDate?.slice(0, 10) ?? '', quantity: existing.quantity ?? '', partialFull: existing.partialFull ?? 'Full', qcInspector: existing.qcInspector || currentUserName, status: existing.status ?? 'In Progress', remarks: existing.remarks ?? '' });
    if (existing.checklistData) {
      try {
        const parsed = JSON.parse(existing.checklistData);
        const mergedCl  = { ...defaultChecklist() };
        const mergedNA  = { ...defaultSectionNA() };
        Object.keys(parsed).forEach(key => {
          if (key === '__sectionNA') { Object.assign(mergedNA, parsed[key]); }
          else if (mergedCl[key] !== undefined) { mergedCl[key] = { ...mergedCl[key], ...parsed[key] }; }
        });
        setChecklist(mergedCl);
        setSectionNA(mergedNA);
      } catch {}
    }
  }, [existing]);

  const tsStatus   = existing?.status ?? null;
  const isReadonly = isView || tsStatus === 'Passed' || (tsStatus === 'Failed' && !isApprover);

  /* ── Auto-status from checklist ─────────────────── */
  useEffect(() => {
    if (isReadonly) return;
    // Only count items that have been explicitly answered (Pass or Fail — not empty or N/A)
    const answered = QC_SECTIONS
      .filter(s => !sectionNA[s.name])
      .flatMap(s => s.items.map(i => checklist[s.name]?.[i]).filter(v => v === 'Pass' || v === 'Fail'));
    const hasEmpty = QC_SECTIONS
      .filter(s => !sectionNA[s.name])
      .some(s => s.items.some(i => !checklist[s.name]?.[i]));
    if (answered.length === 0) return;
    const autoStatus = hasEmpty ? 'In Progress'
      : answered.some(v => v === 'Fail') ? 'Failed'
      : 'Passed';
    setHeader(h => h.status === autoStatus ? h : { ...h, status: autoStatus });
  }, [checklist, sectionNA, isReadonly]);

  // Keep ref in sync so mutation closure always reads current pending list
  pendingFilesRef.current = pendingFiles;

  /* ── Mutations ─────────────────────────────────── */
  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: payload => isEdit ? api.put(`/qc/${id}`, payload).then(r => r.data) : api.post('/qc', payload).then(r => r.data),
    onSuccess: async data => {
      queryClient.invalidateQueries({ queryKey: ['qc-records'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['qc', id] });
      // Upload pending files sequentially (already converted to base64 on capture)
      if (!isEdit && data?.id && pendingFilesRef.current.length > 0) {
        let uploaded = 0;
        for (const pf of pendingFilesRef.current) {
          try {
            await api.post(`/qc/${data.id}/attachments`, { fileName: pf.name, mimeType: pf.mimeType, fileData: pf.dataUrl, fileSize: pf.size });
            uploaded++;
          } catch { /* continue uploading remaining files */ }
        }
        if (uploaded < pendingFilesRef.current.length) {
          toast(`${uploaded}/${pendingFilesRef.current.length} images uploaded. Some failed.`, 'error');
        }
        setPendingFiles([]);
      }
      toast(isEdit ? 'QC record updated.' : 'QC record created.', 'success');
      if (!isEdit && data?.id) navigate(`/qc/${data.id}/edit`);
    },
    onError: err => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const { mutate: postComment }  = useMutation({ mutationFn: text => api.post(`/qc/${id}/comments`, { commentText: text }).then(r => r.data), onSuccess: () => { setNewComment(''); refetchComments(); } });
  const { mutate: deleteComment} = useMutation({ mutationFn: cId  => api.delete(`/qc/comments/${cId}`).then(r => r.data), onSuccess: () => refetchComments() });

  /* Camera capture callback — dataUrl is already base64 */
  function handleCameraCapture(dataUrl, mimeType, fileName) {
    const size = Math.round((dataUrl.length * 3) / 4); // approximate bytes from base64
    if (isEdit && id) {
      const imageCount = attachments.filter(a => a.mimeType?.startsWith('image/')).length;
      if (imageCount >= 10) { toast('Maximum 10 images allowed.', 'error'); return; }
      api.post(`/qc/${id}/attachments`, { fileName, mimeType, fileData: dataUrl, fileSize: size })
        .then(() => { refetchAttachments(); toast('Photo saved.', 'success'); })
        .catch(() => toast('Upload failed.', 'error'));
    } else {
      if (pendingFiles.length >= 10) { toast('Maximum 10 images allowed.', 'error'); return; }
      setPendingFiles(prev => {
        const next = [...prev, { name: fileName, mimeType, size, dataUrl, preview: dataUrl }];
        toast(`Photo ${next.length} added (${next.length}/10).`, 'success');
        return next;
      });
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      toast('Only image files are accepted (JPG, PNG, HEIC, etc.).', 'error'); return;
    }
    if (isEdit && id) {
      const imageCount = attachments.filter(a => a.mimeType?.startsWith('image/')).length;
      if (imageCount >= 10) { toast('Maximum 10 images allowed per QC record.', 'error'); return; }
      // Upload directly to existing record
      const reader = new FileReader();
      reader.onload = async () => {
        try { await api.post(`/qc/${id}/attachments`, { fileName: file.name, mimeType: file.type, fileData: reader.result, fileSize: file.size }); refetchAttachments(); toast('Image uploaded.', 'success'); }
        catch { toast('Upload failed.', 'error'); }
      };
      reader.readAsDataURL(file);
    } else {
      if (pendingFiles.length >= 10) {
        toast('Maximum 10 images allowed.', 'error'); return;
      }
      // Convert to base64 now and track until done
      setConverting(c => c + 1);
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }).then(dataUrl => {
        setPendingFiles(prev => {
          const next = [...prev, { name: file.name, mimeType: file.type, size: file.size, dataUrl, preview: dataUrl }];
          toast(`Image ${next.length} added (${next.length}/10).`, 'success');
          return next;
        });
      }).catch(() => {
        toast('Failed to read image file.', 'error');
      }).finally(() => {
        setConverting(c => c - 1);
      });
    }
  }
  async function handleDownload(a) {
    try {
      const res = await api.get(`/qc/attachments/${a.id}/download`);
      const { fileData, fileName, isS3 } = res.data;
      if (isS3) {
        // S3 presigned URL — open directly in new tab for download
        window.open(fileData, '_blank');
      } else {
        const el = document.createElement('a');
        el.href = fileData; el.download = fileName; el.click();
      }
    } catch { toast('Download failed.', 'error'); }
  }
  const { mutate: deleteAttach } = useMutation({ mutationFn: aId => api.delete(`/qc/attachments/${aId}`).then(r => r.data), onSuccess: () => refetchAttachments() });

  function setHdr(f, v) { setHeader(h => ({ ...h, [f]: v })); }

  /* ── Options ───────────────────────────────────── */
  const completedSet = new Set(completedWos);
  const prodWOs = workOrders.filter(w => w.sourceType === 'Operation WO' && !completedSet.has(w.workOrderNumber));
  const woOptions   = prodWOs.map(w => ({ value: w.workOrderNumber, label: w.workOrderNumber, search: `${w.workOrderNumber} ${w.projectName ?? ''}` }));
  const projOptions = projects.map(p => { const c = p.projectCode ?? p.projectId; return { value: c, label: c, search: `${c} ${p.projectName ?? ''}` }; });

  function onWorkOrderChange(woNo) {
    const wo = workOrders.find(w => w.workOrderNumber === woNo); if (!wo) { setHdr('workOrderNo', woNo); return; }
    const raw = wo.projectName ?? '';
    const projectName = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw;
    const projectCode = wo.projectCode ?? wo.projectId ?? '';
    const proj = projects.find(p => (p.projectCode ?? p.projectId) === projectCode);
    setHeader(h => ({ ...h, workOrderNo: woNo, projectCode, projectName, customerName: proj?.customerName ?? wo.customerName ?? h.customerName, signType: wo.signType ?? h.signType, quantity: wo.quantity ?? h.quantity }));
  }

  /* ── Summary values ────────────────────────────── */
  const activeSections = QC_SECTIONS.filter(s => !sectionNA[s.name]);
  const allItems    = activeSections.flatMap(s => s.items.map(i => checklist[s.name]?.[i]));
  const passTotal   = allItems.filter(v => v === 'Pass').length;
  const failTotal   = allItems.filter(v => v === 'Fail').length;
  const naTotal     = allItems.filter(v => v === 'N/A').length;
  const emptyTotal  = allItems.filter(v => !v).length;
  const naSection   = QC_SECTIONS.length - activeSections.length;
  const answeredItems = allItems.length - naTotal - emptyTotal;
  const passRate    = answeredItems > 0 ? Math.round((passTotal / answeredItems) * 100) : 0;

  const sts = STATUS_STYLE[header.status] ?? STATUS_STYLE['In Progress'];

  /* ── Validation ───────────────────────────────────── */
  const totalImages = attachments.filter(a => a.mimeType?.startsWith('image/')).length
                    + pendingFiles.filter(pf => pf.mimeType?.startsWith('image/')).length;

  function validate() {
    if (converting > 0) {
      toast(`Please wait — ${converting} image(s) still being processed.`, 'error'); return false;
    }
    // Date must be today only
    const todayStr = new Date().toISOString().slice(0, 10);
    if (header.qcDate !== todayStr) {
      toast(`QC date must be today (${todayStr}). Past and future dates are not allowed.`, 'error'); return false;
    }
    if (!header.workOrderNo?.trim()) {
      toast('Work Order # is required.', 'error'); return false;
    }
    if (!header.quantity || Number(header.quantity) <= 0) {
      toast('Quantity is required and must be greater than 0.', 'error'); return false;
    }
    if (!header.remarks?.trim()) {
      toast('Remarks is required — describe the inspection outcome.', 'error'); return false;
    }
    if (activeSections.length === 0) {
      toast('At least one checklist section must be active (not all N/A).', 'error'); return false;
    }
    // Every active item must have a selection
    const unanswered = activeSections.reduce((acc, s) =>
      acc + s.items.filter(i => !checklist[s.name]?.[i] || checklist[s.name][i] === '').length, 0);
    if (unanswered > 0) {
      toast(`${unanswered} checklist item(s) have no selection. Please mark each item as Pass, Fail, or N/A before saving.`, 'error'); return false;
    }
    // #44 — at least 1 photo required for all saves
    if (totalImages < 1) {
      toast('At least 1 photo is required. Go to the Files tab to add a photo.', 'error'); return false;
    }
    // 3-image minimum enforced when marking as Passed
    if (header.status === 'Passed' && totalImages < 3) {
      toast(`Minimum 3 images required to mark as Passed — you have ${totalImages}. Go to the Files tab to add photos.`, 'error'); return false;
    }
    if (totalImages > 10) {
      toast(`Maximum 10 images allowed — you have ${totalImages}. Remove some before saving.`, 'error'); return false;
    }
    return true;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Top bar ── */}
      <div style={{ background: `linear-gradient(135deg,${C.teal} 0%,${C.tealMid} 100%)`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/qc')} type="button" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>← Back</button>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>{isEdit ? existing?.docNo ?? '…' : 'New QC Record'}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 }}>{isReadonly ? 'Read-only view' : isEdit ? 'Edit QC record' : 'Quality Control Module'}</div>
          </div>
          {existing?.status && <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sts.bg, color: sts.color }}>{existing.status}</span>}
          {isEdit && (
            <button type="button" onClick={() => window.open(`/qc/${id}/print`, '_blank')}
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', cursor: 'pointer', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {emptyTotal > 0 && <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#d97706' }}>{emptyTotal} Pending</span>}
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: C.passBg,  color: C.pass  }}>{passTotal} Pass</span>
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: C.failBg,  color: C.fail  }}>{failTotal} Fail</span>
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.15)', color: '#fff' }}>{naTotal + naSection} N/A</span>
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: emptyTotal > 0 ? '#fef3c7' : failTotal > 0 ? C.failBg : C.passBg, color: emptyTotal > 0 ? '#d97706' : failTotal > 0 ? C.fail : C.pass }}>{passRate}%</span>
        </div>
      </div>

      <form onSubmit={e => { e.preventDefault(); if (validate()) save({ ...header, checklistData: { ...checklist, __sectionNA: sectionNA } }); }}
        data-qc-tab={mobQcTab}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, width: '100%' }}>

        {/* ── Mobile tab bar — visible when window ≤ 1440px ── */}
        {isNarrow && (
          <div style={{ display: 'flex', flexShrink: 0, borderBottom: '2px solid var(--border2)', background: 'var(--surface)' }}>
            {[['details','📋','Details'],['checklist','✅','Checklist'],['info','📌','Info']].map(([key,ic,lbl]) => (
              <button key={key} type="button"
                onClick={() => setMobQcTab(key)}
                style={{ flex: 1, padding: '10px 6px', border: 'none', borderBottom: `2px solid ${mobQcTab === key ? 'var(--accent)' : 'transparent'}`, marginBottom: -2, background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: mobQcTab === key ? 'var(--accent)' : 'var(--text3)', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                {ic} {lbl}
              </button>
            ))}
          </div>
        )}

        {/* ── Three-panel row ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left panel */}
        <div className="ts-form-panel qc-panel-details" style={{ flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', display: isNarrow && mobQcTab !== 'details' ? 'none' : undefined, width: isNarrow ? '100%' : undefined }}>

          {/* Work Order — full width */}
          <div className="ts-field-group"><label className="ts-field-label">Work Order # <span style={{ color: C.fail }}>*</span></label>
            <SearchSelect options={woOptions} value={header.workOrderNo} onChange={onWorkOrderChange} placeholder="Production WOs…" disabled={isReadonly} /></div>

          {/* QC No + Date side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="ts-field-group"><label className="ts-field-label">QC Number</label>
              <input className="form-control ts-input ts-readonly" value={existing?.docNo ?? '(auto)'} readOnly /></div>
            <div className="ts-field-group"><label className="ts-field-label">Date</label>
              <input type="date" required className="form-control ts-input"
                value={header.qcDate} min={new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)}
                disabled={isReadonly} onChange={e => setHdr('qcDate', e.target.value)} /></div>
          </div>

          {/* Project ID — full width */}
          <div className="ts-field-group"><label className="ts-field-label">Project ID</label>
            <SearchSelect options={projOptions} value={header.projectCode} onChange={v => { const p = projects.find(x => (x.projectCode ?? x.projectId) === v); const raw = p?.projectName ?? ''; setHeader(h => ({ ...h, projectCode: v, projectName: raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw, customerName: p?.customerName ?? h.customerName })); }} placeholder="Search project…" disabled={isReadonly} /></div>

          {/* Project Name + Customer side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="ts-field-group"><label className="ts-field-label">Project Name</label>
              <input className="form-control ts-input ts-readonly" value={header.projectName} readOnly placeholder="Auto-filled" /></div>
            <div className="ts-field-group"><label className="ts-field-label">Customer</label>
              <input className="form-control ts-input ts-readonly" value={header.customerName} readOnly placeholder="Auto-filled" /></div>
          </div>

          {/* Sign Type — full width */}
          <div className="ts-field-group"><label className="ts-field-label">Sign Type</label>
            <input className="form-control ts-input" value={header.signType} disabled={isReadonly} onChange={e => setHdr('signType', e.target.value)} placeholder="e.g. Metal Fabrication" /></div>

          {/* Qty + Partial/Full side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="ts-field-group"><label className="ts-field-label">Qty <span style={{ color: C.fail }}>*</span></label>
              <input type="number" className="form-control ts-input" value={header.quantity} disabled={isReadonly} min={1} onChange={e => setHdr('quantity', e.target.value)} placeholder="1" /></div>
            <div className="ts-field-group"><label className="ts-field-label">Partial / Full</label>
              <select className="form-control ts-input" value={header.partialFull} disabled={isReadonly} onChange={e => setHdr('partialFull', e.target.value)}><option>Full</option><option>Partial</option></select></div>
          </div>

          {/* Inspector + Status side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="ts-field-group"><label className="ts-field-label">Inspector</label>
              <input className="form-control ts-input ts-readonly" value={header.qcInspector} readOnly /></div>
            <div className="ts-field-group"><label className="ts-field-label">Status</label>
              {isReadonly
                ? <input className="form-control ts-input ts-readonly" value={header.status} readOnly />
                : tsStatus === 'Passed'
                  ? <input className="form-control ts-input ts-readonly" value={header.status} readOnly title="Passed QC records cannot be changed to another status" />
                  : <select className="form-control ts-input" value={header.status} onChange={e => setHdr('status', e.target.value)}>{STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</select>}
            </div>
          </div>

          {/* Remarks — full width */}
          <div className="ts-field-group"><label className="ts-field-label">Remarks <span style={{ color: C.fail }}>*</span></label>
            <input className="form-control ts-input" value={header.remarks} disabled={isReadonly} onChange={e => setHdr('remarks', e.target.value)} placeholder="Required — describe inspection outcome" /></div>

          {/* Compact summary */}
          <div className="ts-divider" />
          <div style={{ padding: '8px 16px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 4px' }}>
            {[['Pass', passTotal, C.pass, C.passBg], ['Fail', failTotal, C.fail, C.failBg], ['Pending', emptyTotal, '#d97706', '#fef3c7'], ['N/A', naTotal, 'var(--text3)', 'var(--surface2)'], ['Sections', activeSections.length + '/' + QC_SECTIONS.length, 'var(--text2)', 'var(--surface2)'], ['Rate', passRate + '%', failTotal > 0 ? C.fail : C.pass, failTotal > 0 ? C.failBg : C.passBg]].map(([label, val, color, bg]) => (
              <div key={label} style={{ background: bg, borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color }}>{val}</div>
                <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ margin: '0 16px 12px', borderRadius: 4, overflow: 'hidden', height: 5, background: 'var(--border)' }}>
            <div style={{ height: '100%', width: `${passRate}%`, background: failTotal > 0 ? C.fail : C.pass, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Centre: checklist */}
        <div className="qc-panel-checklist" style={{ flex: 1, overflow: 'auto', padding: '16px 18px 80px', display: isNarrow && mobQcTab !== 'checklist' ? 'none' : 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Inspection Checklist — {QC_SECTIONS.length} sections · {allItems.length} items
            {naSection > 0 && <span style={{ color: C.na }}> · {naSection} section(s) N/A</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
            {QC_SECTIONS.map(section => (
              <SectionCard key={section.name} section={section}
                values={checklist[section.name] ?? {}}
                sectionNA={sectionNA[section.name] ?? false}
                onItemChange={(s, i, v) => setChecklist(p => ({ ...p, [s]: { ...p[s], [i]: v } }))}
                onSectionNA={v => setSectionNA(p => ({ ...p, [section.name]: v }))}
                readonly={isReadonly} />
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="qc-panel-info" style={{ flexShrink: 0, borderLeft: isNarrow ? 'none' : '1px solid var(--border2)', display: isNarrow && mobQcTab !== 'info' ? 'none' : 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden', width: isNarrow ? '100%' : undefined }}>
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border2)', flexShrink: 0 }}>
            {[['history', '📋', 'History'], ['comments', '💬', comments.length ? `(${comments.length})` : 'Comments'], ['files', '📎', attachments.length ? `(${attachments.length})` : 'Files']].map(([key, ic, lbl]) => (
              <button key={key} type="button" onClick={() => setActiveTab(key)}
                style={{ flex: 1, padding: '9px 4px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: activeTab === key ? C.teal : 'var(--text3)', borderBottom: activeTab === key ? `2px solid ${C.teal}` : '2px solid transparent', marginBottom: -2 }}>
                {ic} {lbl}
              </button>
            ))}
          </div>

          {activeTab === 'history' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* WO-level QC history */}
              {header.workOrderNo ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    QC Records for {header.workOrderNo}
                  </div>
                  {woHistory.length === 0 ? (
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '14px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
                      No other QC records for this work order
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {woHistory.map(rec => {
                        const s = STATUS_STYLE[rec.status] ?? STATUS_STYLE['In Progress'];
                        const isCurrent = String(rec.id) === String(id);
                        return (
                          <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${isCurrent ? C.teal + '40' : '#e2e8f0'}`, background: isCurrent ? C.tealLight : '#fff' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? C.teal : '#0f172a' }}>
                                {rec.docNo} {isCurrent && <span style={{ fontSize: 10, color: C.teal }}>(current)</span>}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>
                                {rec.qcDate ?? '—'} · {rec.qcInspector ?? '—'}
                              </div>
                            </div>
                            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, flexShrink: 0 }}>{rec.status}</span>
                            {!isCurrent && (
                              <button type="button" onClick={() => window.open(`/qc/${rec.id}/view`, '_blank')}
                                style={{ background: C.tealLight, border: 'none', color: C.teal, cursor: 'pointer', padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                View
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>📋</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Select a Work Order to see QC history</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {comments.length === 0 ? <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}><div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>💬</div><div style={{ fontSize: 13, fontWeight: 600 }}>No comments yet</div></div>
                  : comments.map(c => <Comment key={c.id} c={c} onDelete={deleteComment} canDelete={isApprover || c.authorName === (user?.displayName ?? user?.username)} currentUser={user} />)}
              </div>
              {isEdit && (
                <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
                  <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) { e.preventDefault(); postComment(newComment.trim()); } }} placeholder="Write a comment…" style={{ flex: 1, padding: '7px 10px', fontSize: 12, border: '1px solid var(--border2)', borderRadius: 8, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
                  <button type="button" onClick={() => { if (newComment.trim()) postComment(newComment.trim()); }} style={{ padding: '7px 12px', background: C.teal, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Send</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'files' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Upload/camera buttons — shown on create and edit, hidden only on /view */}
              {!isView && (
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Image count progress */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: converting > 0 ? '#fffbeb' : totalImages >= 3 && totalImages <= 10 ? C.passBg : '#fff7ed', border: `1px solid ${converting > 0 ? '#fde68a' : totalImages >= 3 && totalImages <= 10 ? C.passBd : '#fed7aa'}`, borderRadius: 6, padding: '5px 10px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: converting > 0 ? '#92400e' : totalImages >= 3 && totalImages <= 10 ? C.pass : '#c2410c' }}>
                      {converting > 0 ? `Processing ${converting} image(s)… please wait` : totalImages > 10 ? `${totalImages}/10 — max exceeded` : totalImages >= 3 ? `✓ ${totalImages}/10 images` : `${totalImages}/3 minimum required`}
                    </span>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i < totalImages ? (totalImages > 10 ? C.fail : C.pass) : '#d1d5db', transition: 'background 0.2s' }} />
                      ))}
                    </div>
                  </div>
                  {!isEdit && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚡</span> Files upload automatically when you save.
                    </div>
                  )}
                  {/* Upload from device */}
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: `1.5px dashed ${C.teal}60`, background: C.tealLight, color: C.teal, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload File
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />

                  {/* Camera — opens in-browser camera modal */}
                  <button type="button" onClick={() => setShowCamera(true)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--border2)', background: '#fff', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    Open Camera
                  </button>
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                {/* Pending files (create mode — not yet saved to DB) */}
                {pendingFiles.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, padding: '0 4px' }}>
                      Pending ({pendingFiles.length}) — uploads on save
                    </div>
                    {pendingFiles.map((pf, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', borderBottom: '1px solid var(--border)' }}>
                        {pf.mimeType?.startsWith('image/') ? (
                          <img src={pf.preview} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 30, height: 30, borderRadius: 6, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pf.name}</div>
                          <div style={{ fontSize: 10, color: '#d97706' }}>{pf.size ? `${Math.round(pf.size / 1024)} KB` : ''} · pending</div>
                        </div>
                        <button type="button" onClick={() => setPendingFiles(p => p.filter((_, j) => j !== i))} style={{ background: '#fee2e2', border: 'none', color: C.fail, cursor: 'pointer', padding: '3px 8px', borderRadius: 5, fontSize: 11 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Saved attachments (edit mode) */}
                {attachments.length === 0 && pendingFiles.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text3)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>📎</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>No files yet</div>
                    <div style={{ fontSize: 11, marginTop: 3 }}>Use the buttons above to attach files or capture photos</div>
                  </div>
                ) : attachments.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 6, background: C.tealLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.fileName}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{a.fileSize ? `${Math.round(a.fileSize / 1024)} KB` : ''}</div>
                    </div>
                    <button type="button" onClick={() => handleDownload(a)} style={{ background: C.tealLight, border: 'none', color: C.teal, cursor: 'pointer', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700 }}>↓</button>
                    {isEdit && !isView && <button type="button" onClick={() => { if (confirm('Remove?')) deleteAttach(a.id); }} style={{ background: '#fee2e2', border: 'none', color: C.fail, cursor: 'pointer', padding: '3px 8px', borderRadius: 5, fontSize: 11 }}>✕</button>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        </div>{/* end three-panel row */}

        {/* Footer */}
        <div className="ts-modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '10px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          {isReadonly ? (
            <button type="button" onClick={() => navigate('/qc')} className="btn btn-ghost">← Back to List</button>
          ) : (
            <>
              <button type="button" onClick={() => navigate('/qc')} className="btn btn-ghost">Cancel</button>
              <button type="submit" disabled={saving || converting > 0} style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${C.teal},${C.tealMid})`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: (saving || converting > 0) ? 'not-allowed' : 'pointer', opacity: (saving || converting > 0) ? 0.7 : 1 }}>
                {converting > 0 ? `Processing images…` : saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create QC Record'}
              </button>
            </>
          )}
        </div>
      </form>

      {/* Camera capture modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
