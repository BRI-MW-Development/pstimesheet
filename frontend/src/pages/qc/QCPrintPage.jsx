import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';

const QC_SECTIONS = [
  { name: 'Letter Moulding',                   items: ['Workmanship', 'Surface Finish', 'Quantity', 'Depth of Material', 'Edges and Side Finish'] },
  { name: 'Metal Fabrication',                 items: ['Structural & Support', 'Material Type / Size', 'Surface Finish', 'Fixing Methods & Assembly', 'Quantity'] },
  { name: 'CNC Laser Cutting',                 items: ['Quantity', 'Cutting Quality', 'Verify Cutting Files', 'Material Types'] },
  { name: 'Acrylic',                           items: ['Fixing', 'Workmanship', 'Material Specification', 'Quantity', 'Surface Finish'] },
  { name: 'Packaging',                         items: ['Cleaning', 'Physical Damages', 'Workmanship', 'Quantity'] },
  { name: 'Electricals',                       items: ['LED Brand', 'Quantity', 'KELVIN Temperature & Illumination', 'Verify Electrical Components', 'Visual Checkup (Darkspots)'] },
  { name: 'Painting',                          items: ['Quantity', 'Workmanship', 'Surface Finish', 'Colour / Coat'] },
  { name: 'Vinyl / Graphics / ScreenPrinting', items: ['Material Specification', 'Print Quality', 'Workmanship', 'Surface Finish'] },
  { name: 'Polishing',                         items: ['Surface Finish', 'Workmanship'] },
  { name: 'Outsourced & Fixing Materials',     items: ['Quantity', 'Material Specification', 'Surface Finish', 'Workmanship'] },
  { name: 'Sanding',                           items: ['Powder Coating Coat', 'Workmanship', 'Surface Finish'] },
];

const TEAL    = '#1a7a7a';
const TEAL_DK = '#1e5f6a';
const ORANGE  = '#e87722';
const PASS    = '#15803d';
const FAIL    = '#dc2626';
const NA      = '#9ca3af';
const BORDER  = '#e2e8f0';
const MUTED   = '#6b7280';
const TEXT    = '#1e293b';

const statusCfg = s => ({
  Passed:        { color: PASS,   bg: '#dcfce7', label: '✓ Passed' },
  Failed:        { color: FAIL,   bg: '#fee2e2', label: '✗ Failed' },
  'In Progress': { color: ORANGE, bg: '#fff7ed', label: '⏳ In Progress' },
}[s] ?? { color: TEAL, bg: '#e6f3f3', label: s || 'Unknown' });

function getVal(cl, snNA, sec, item) {
  if (snNA[sec]) return 'N/A';
  return cl[sec]?.[item] ?? 'Pass';
}

/* ── Compact section card — white bg, colored text only ── */
function Section({ section, cl, snNA }) {
  const items  = section.items.map(i => ({ label: i, value: getVal(cl, snNA, section.name, i) }));
  const passed = items.filter(x => x.value === 'Pass').length;
  const failed = items.filter(x => x.value === 'Fail').length;
  const active = items.filter(x => x.value !== 'N/A').length;
  const hdrBg  = failed > 0 ? FAIL : TEAL;

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden', pageBreakInside: 'avoid', background: '#fff' }}>
      {/* Header */}
      <div style={{ background: hdrBg, padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#fff', fontSize: 8, fontWeight: 800 }}>{section.name}</span>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 7, fontWeight: 700 }}>
          {passed}/{active} Pass {failed > 0 && `· ${failed} Fail`}
        </span>
      </div>
      {/* Items — 2 col grid, plain white bg */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '4px 6px 5px', gap: '3px 8px' }}>
        {items.map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `1px solid #f1f5f9`, paddingBottom: 2, paddingTop: 2 }}>
            <span style={{ fontSize: 7.5, color: MUTED, flex: 1, lineHeight: 1.3, paddingRight: 4 }}>{label}</span>
            <span style={{ fontSize: 8, fontWeight: 800, color: value === 'Pass' ? PASS : value === 'Fail' ? FAIL : NA, flexShrink: 0 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QCPrintPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const pageRef   = useRef(null);
  const [imgs,    setImgs]      = useState({});
  const [ready,   setReady]     = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Fetch current user profile — used as fallback when record has no inspectorImageKey yet
  const { data: currentUser } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/auth/profile').then(r => r.data).catch(() => null),
    staleTime: 30 * 60 * 1000,
  });

  /* Inject print CSS */
  useEffect(() => {
    const el = document.createElement('style');
    el.id = '__qcprint';
    el.textContent = `
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
      body { background: #e2e8f0; }
      @media print {
        body { background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .__toolbar { display: none !important; }
        .__preview { padding: 0 !important; background: transparent !important; }
        .__page    { width: 100% !important; box-shadow: none !important; margin: 0 !important; page-break-after: avoid; }
        @page { size: A4 portrait; margin: 7mm 9mm; }
      }
    `;
    document.head.appendChild(el);
    return () => document.getElementById('__qcprint')?.remove();
  }, []);

  const { data: rec }              = useQuery({ queryKey: ['qc', id],             queryFn: () => api.get(`/qc/${id}`).then(r => r.data) });
  const { data: comments = [] }    = useQuery({ queryKey: ['qc-comments', id],    queryFn: () => api.get(`/qc/${id}/comments`).then(r => r.data) });
  const { data: attachments = [] } = useQuery({ queryKey: ['qc-attachments', id], queryFn: () => api.get(`/qc/${id}/attachments`).then(r => r.data) });

  const photos = attachments.filter(a => a.mimeType?.startsWith('image/')).slice(0, 10);

  useEffect(() => {
    if (!photos.length) { setReady(true); return; }
    let n = photos.length;
    photos.forEach(a => {
      if (imgs[a.id]) { if (!--n) setReady(true); return; }
      api.get(`/qc/attachments/${a.id}/download`)
        .then(r => { if (r.data?.fileData) setImgs(p => ({ ...p, [a.id]: r.data.fileData })); })
        .finally(() => { if (!--n) setReady(true); });
    });
  }, [attachments.length]);

  let cl = {}, snNA = {};
  if (rec?.checklistData) {
    try { const p = JSON.parse(rec.checklistData); snNA = p.__sectionNA ?? {}; cl = p; } catch {}
  }

  const activeSections = QC_SECTIONS.filter(s => !snNA[s.name]);
  const allVals   = activeSections.flatMap(s => s.items.map(i => getVal(cl, snNA, s.name, i)));
  const active    = allVals.filter(v => v !== 'N/A').length;
  const passCount = allVals.filter(v => v === 'Pass').length;
  const failCount = allVals.filter(v => v === 'Fail').length;
  const naCount   = allVals.filter(v => v === 'N/A').length;
  const pct       = active > 0 ? Math.round((passCount / active) * 100) : 100;
  const sc        = statusCfg(rec?.status ?? '');
  const isLoading = !rec || !ready;

  // Resolve inspector avatar: stored S3 URL from record → current user if names match → null
  const inspectorImageUrl = rec?.inspectorImageUrl ||
    (currentUser?.displayName === rec?.qcInspector ? currentUser?.profileImageUrl : null) ||
    null;

  /* ── Pad col: number of empty cells to fill the last row of 3-col grid ── */
  const padCount = activeSections.length % 3 === 0 ? 0 : 3 - (activeSections.length % 3);

  /* ── Download PDF at full quality via jsPDF + html2canvas ── */
  async function downloadPDF() {
    if (!pageRef.current || downloading) return;
    setDownloading(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const element = pageRef.current;
      const canvas  = await html2canvas(element, {
        scale: 2,            // 2× resolution — crisp text and images
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        imageTimeout: 15000,
        logging: false,
      });

      const imgData   = canvas.toDataURL('image/jpeg', 1.0); // full quality JPEG
      const pdf       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });
      const pdfW      = pdf.internal.pageSize.getWidth();
      const pdfH      = pdf.internal.pageSize.getHeight();
      const canvasH   = (canvas.height * pdfW) / canvas.width;

      if (canvasH <= pdfH) {
        // Fits on one page
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, canvasH, undefined, 'NONE');
      } else {
        // Multi-page: slice canvas into A4-height chunks
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width  = canvas.width;
        const pixelsPerPage = Math.floor((canvas.width * pdfH) / pdfW);
        let yOffset = 0;
        let first   = true;
        while (yOffset < canvas.height) {
          const sliceH = Math.min(pixelsPerPage, canvas.height - yOffset);
          pageCanvas.height = sliceH;
          const ctx = pageCanvas.getContext('2d');
          ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const sliceData = pageCanvas.toDataURL('image/jpeg', 1.0);
          const slicePdfH = (sliceH * pdfW) / canvas.width;
          if (!first) pdf.addPage();
          pdf.addImage(sliceData, 'JPEG', 0, 0, pdfW, slicePdfH, undefined, 'NONE');
          yOffset += sliceH;
          first = false;
        }
      }

      const docNo = rec?.docNo ?? 'QC-Report';
      pdf.save(`${docNo}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      // Fallback to browser print
      window.print();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      {/* ── Screen toolbar ── */}
      <div className="__toolbar" style={{ position: 'sticky', top: 0, zIndex: 999, background: '#0f172a', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => window.close()}
            style={{ padding: '7px 14px', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ← Back
          </button>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>{rec?.docNo ?? '…'} — Print Preview</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!ready && photos.length > 0 && <span style={{ fontSize: 12, color: '#64748b' }}>Loading photos {Object.keys(imgs).length}/{photos.length}…</span>}
          {/* Browser print */}
          <button onClick={() => window.print()} disabled={isLoading || downloading}
            style={{ padding: '8px 16px', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
          {/* High-quality PDF download */}
          <button onClick={downloadPDF} disabled={isLoading || downloading}
            style={{ padding: '8px 20px', background: isLoading || downloading ? '#334155' : TEAL, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: isLoading || downloading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {downloading ? 'Generating PDF…' : isLoading ? 'Loading…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Scrollable preview area ── */}
      <div className="__preview" style={{ padding: '24px 0 60px', overflowY: 'auto' }}>
        <div ref={pageRef} className="__page" style={{ width: 794, margin: '0 auto', background: '#fff', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', color: TEXT }}>

          {!rec ? <div style={{ padding: 80, textAlign: 'center', color: MUTED }}>Loading…</div> : (<>

            {/* ══ HEADER ══════════════════════════════════════════════ */}
            <div style={{ borderTop: `5px solid ${ORANGE}`, padding: '12px 24px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src="/BRI_PS_60x60.png" alt="PS" style={{ height: 44 }} />
                <div>
                  <div style={{ fontSize: 7.5, color: MUTED, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>Professional Signs LLC</div>
                  <div style={{ fontSize: 8, color: TEAL, fontWeight: 700 }}>www.professional-signs.com</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: TEAL, letterSpacing: '0.03em' }}>Quality Check</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: sc.bg, padding: '3px 12px', borderRadius: 20, marginTop: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: sc.color }}>{sc.label}</span>
                </div>
              </div>
            </div>

            {/* ══ INSPECTOR + STATS ═══════════════════════════════════ */}
            <div style={{ background: '#f8fafc', borderBottom: `1px solid ${BORDER}`, padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: TEAL, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                  {inspectorImageUrl
                    ? <img src={inspectorImageUrl} alt={rec.qcInspector} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display='none'; }} />
                    : (rec.qcInspector || '?')[0].toUpperCase()
                  }
                </div>
                <div>
                  <div style={{ fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>QC Inspector</div>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>{rec.qcInspector || '—'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ l:'Pass', v:passCount, c:PASS, bg:'#dcfce7' }, { l:'Fail', v:failCount, c:FAIL, bg:'#fee2e2' }, { l:'N/A', v:naCount, c:NA, bg:'#f3f4f6' }, { l:'Pass Rate', v:`${pct}%`, c:pct>=100?PASS:ORANGE, bg:pct>=100?'#dcfce7':'#fff7ed' }].map((s,i) => (
                  <div key={i} style={{ textAlign:'center', background:s.bg, padding:'4px 12px', borderRadius:8, minWidth:48 }}>
                    <div style={{ fontSize:15, fontWeight:900, color:s.c, lineHeight:1 }}>{s.v}</div>
                    <div style={{ fontSize:7, color:s.c, fontWeight:700, marginTop:2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ══ META FIELDS ═════════════════════════════════════════ */}
            <div style={{ padding: '8px 24px 6px', borderBottom: `2px solid ${TEAL}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0 20px' }}>
                {[
                  ['Project Name',   rec.projectName ],
                  ['Sign Type',      rec.signType    ],
                  ['QC Number',      rec.docNo       ],
                  ['Client Name',    rec.customerName],
                  ['Partial / Full', rec.partialFull ],
                  ['Date',           rec.qcDate      ],
                  ['Project ID',     rec.projectCode ],
                  ['WO Number',      rec.workOrderNo ],
                  ['Quantity',       rec.quantity    ],
                ].map(([label, value]) => (
                  <div key={label} style={{ paddingBottom: 6 }}>
                    <div style={{ fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>{label}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.35 }}>{value || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ══ DEPARTMENTAL PROCESS CHECKS ═════════════════════════ */}
            <div style={{ background: TEAL_DK, color: '#fff', textAlign: 'center', padding: '6px 0', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Departmental Process Checks
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: '8px 24px 8px', background: '#f8fafc' }}>
              {activeSections.map(s => <Section key={s.name} section={s} cl={cl} snNA={snNA} />)}
              {Array.from({ length: padCount }).map((_, i) => <div key={i} />)}
            </div>

            {/* ══ COMMENTS ════════════════════════════════════════════ */}
            {(comments.length > 0 || rec.remarks) && (
              <>
                <div style={{ background: TEAL_DK, color: '#fff', padding: '5px 24px', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  Final Comment Section
                </div>
                <div style={{ padding: '8px 24px 8px', borderBottom: `1px solid ${BORDER}` }}>
                  {(comments.length > 0 ? comments : [{ authorName: rec.qcInspector, createdAt: rec.qcDate, commentText: rec.remarks, id: '__r' }]).map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: TEAL, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 10, flexShrink: 0 }}>
                        {c.authorName === rec.qcInspector && inspectorImageUrl
                          ? <img src={inspectorImageUrl} alt={c.authorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display='none'; }} />
                          : (c.authorName || '?')[0].toUpperCase()
                        }
                      </div>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                          <span style={{ fontSize: 10, fontWeight: 700 }}>{c.authorName}</span>
                          <span style={{ fontSize: 8, color: MUTED }}>{typeof c.createdAt === 'string' && c.createdAt.includes('T') ? new Date(c.createdAt).toLocaleString('en-GB') : c.createdAt}</span>
                        </div>
                        <div style={{ fontSize: 9.5, color: '#374151', marginTop: 2, lineHeight: 1.5 }}>{c.commentText}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ══ PHOTOS — 5 columns, small square ════════════════════ */}
            {photos.length > 0 && (
              <>
                <div style={{ background: TEAL_DK, color: '#fff', padding: '5px 24px', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  QC Inspection Photos ({photos.length})
                </div>
                <div style={{ padding: '7px 24px 8px', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
                    {photos.map((a, i) => (
                      <div key={a.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 3, overflow: 'hidden', background: '#f8fafc' }}>
                        {imgs[a.id]
                          ? <img src={imgs[a.id]} alt={`Photo ${i+1}`} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                          : <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: MUTED }}>Loading…</div>
                        }
                        <div style={{ padding: '2px 4px', fontSize: 7, color: MUTED, textAlign: 'center', background: '#f1f5f9' }}>Photo {i+1}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ══ FOOTER ══════════════════════════════════════════════ */}
            <div style={{ borderTop: `4px solid ${ORANGE}`, padding: '8px 24px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, fontWeight: 800, color: TEXT, marginBottom: 3 }}>Disclaimer</div>
                <div style={{ fontSize: 7.5, color: MUTED, lineHeight: 1.6, fontStyle: 'italic' }}>
                  This system-generated report, provided by Professional Signs LLC, is utilized for both internal quality control assessment and may be
                  distributed externally at the discretion of the company. It is confidential and proprietary to Professional Signs, and any reproduction
                  or distribution without prior written consent is strictly prohibited.
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, paddingTop: 2 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: TEAL }}>www.professional-signs.com</div>
                <div style={{ fontSize: 7.5, color: MUTED, marginTop: 4 }}>
                  Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>

          </>)}
        </div>
      </div>
    </>
  );
}
