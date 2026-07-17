import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, ComposedChart, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import api from '../../api/client';

/* ── Palette ──────────────────────────────────────── */
const C = {
  green:  '#16a34a', greenL:  '#dcfce7',
  red:    '#dc2626', redL:    '#fee2e2',
  blue:   '#2563eb', blueL:   '#dbeafe',
  amber:  '#d97706', amberL:  '#fef3c7',
  violet: '#7c3aed', violetL: '#ede9fe',
  teal:   '#0f7173', tealL:   '#e6f3f3',
  sky:    '#0284c7', skyL:    '#e0f2fe',
  gray:   '#9ca3af', grayL:   '#f3f4f6',
};

const TABS = [
  { key: 'prod', label: 'Production',    icon: '🔩', color: C.blue,   bg: C.blueL   },
  { key: 'inst', label: 'Installation',  icon: '🏗️', color: C.sky,    bg: C.skyL    },
  { key: 'qc',   label: 'Quality Control', icon: '🔍', color: C.teal,   bg: C.tealL   },
  { key: 'woc',  label: 'WO Complete',   icon: '🏁', color: C.violet, bg: C.violetL },
];

/* ── Date helpers ──────────────────────────────────── */
const pad = n => String(n).padStart(2, '0');
function today()    { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function firstDay() { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`; }
function monthsAgo(n) { const d=new Date(); d.setMonth(d.getMonth()-n); d.setDate(1); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`; }
function fmtM(m) { if(!m) return ''; const [y,mo]=m.split('-'); return new Date(+y,+mo-1).toLocaleString('en-GB',{month:'short',year:'2-digit'}); }

const PRESETS = [
  { label:'This Month',  from: firstDay,        to: today },
  { label:'Last 3 Mo',   from:()=>monthsAgo(3), to: today },
  { label:'Last 6 Mo',   from:()=>monthsAgo(6), to: today },
  { label:'This Year',   from:()=>`${new Date().getFullYear()}-01-01`, to: today },
  { label:'Custom' },
];

const TT = {
  contentStyle:{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:8, fontSize:12, color:'var(--text)' },
  labelStyle:{ color:'var(--text2)', fontWeight:700 },
};

/* ── Shared UI components ─────────────────────────── */
function KPI({ label, value, sub, color='var(--text)', bg='var(--surface2)', icon }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:10, padding:'14px 16px', display:'flex', gap:12, alignItems:'center', flex:1, minWidth:0 }}>
      {icon && <div style={{ width:40,height:40,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>{icon}</div>}
      <div>
        <div style={{ fontSize:11,color:'var(--text3)',fontWeight:600,marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:24,fontWeight:900,color,lineHeight:1 }}>{value??'—'}</div>
        {sub && <div style={{ fontSize:11,color:'var(--text3)',marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}
function Card({ title, children, style }) {
  return (
    <div style={{ background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:10,overflow:'hidden',...style }}>
      {title && <div style={{ padding:'10px 16px',borderBottom:'1px solid var(--border)',fontWeight:700,fontSize:13,color:'var(--text)' }}>{title}</div>}
      <div style={{ padding:16 }}>{children}</div>
    </div>
  );
}

/* ── Shared month fill ───────────────────────────── */
function fillMonths(from, to, rows, defaults = {}) {
  const months = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const key   = `${y}-${String(m).padStart(2,'0')}`;
    const found = rows.find(r => r.month === key);
    months.push(found ?? { month: key, nil: true, ...defaults });
    if (++m > 12) { m = 1; y++; }
  }
  return months;
}

/* ── Timesheet tab (shared by Prod & Inst) ────────── */
function TSTab({ data, color, label, from, to }) {
  const navigate = useNavigate();
  const s  = data?.summary ?? {};
  const mo = fillMonths(from, to, data?.monthly ?? [], { total:0, approved:0, submitted:0, draft:0, rejected:0 });

  const approvalRate = s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0;

  const statusDonut = [
    { name:'Approved',  value: s.approved  ?? 0, fill: C.green },
    { name:'Submitted', value: s.submitted ?? 0, fill: C.amber },
    { name:'Draft',     value: s.draft     ?? 0, fill: C.gray  },
    { name:'Rejected',  value: s.rejected  ?? 0, fill: C.red   },
  ].filter(d => d.value > 0);

  const rateData = mo.map(r => ({
    month: fmtM(r.month),
    rate:  r.nil ? null : (r.total > 0 ? Math.round(r.approved / r.total * 100) : 0),
  }));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* KPIs */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <KPI label="Total"    value={s.total}     color={color}   bg={color+'20'} icon="📋" />
        <KPI label="Approved" value={s.approved}  color={C.green} bg={C.greenL}   icon="✅" sub={`${approvalRate}% approval rate`} />
        <KPI label="Pending"  value={s.submitted} color={C.amber} bg={C.amberL}   icon="⏳"
          sub={<button style={{background:'none',border:'none',color:C.amber,cursor:'pointer',fontSize:11,padding:0,fontWeight:600}} onClick={()=>navigate('/timesheets/pending-approvals')}>Review →</button>} />
        <KPI label="Draft"    value={s.draft}     color={C.gray}  bg={C.grayL}    icon="📝" />
        <KPI label="Rejected" value={s.rejected}  color={C.red}   bg={C.redL}     icon="❌" />
      </div>

      {/* Charts */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, alignItems:'start' }}>

        {/* Approval rate trend */}
        <Card title="Monthly Approval Rate (%)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={rateData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{fontSize:11,fill:'var(--text3)'}} />
              <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fontSize:11,fill:'var(--text3)'}} />
              <Tooltip {...TT} formatter={v => v === null ? ['—', 'Approval Rate'] : [`${v}%`, 'Approval Rate']} />
              <Line
                type="monotone" dataKey="rate" name="Approval Rate"
                stroke={color} strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.rate === null) return null;
                  return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />;
                }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Status distribution */}
        <Card title="Status Distribution">
          <div style={{ position:'relative', width:'100%', height:160 }}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={statusDonut} dataKey="value" innerRadius={44} outerRadius={68} paddingAngle={3}>
                  {statusDonut.map((d,i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip {...TT} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none' }}>
              <div style={{ fontSize:22,fontWeight:900,color:approvalRate>=80?C.green:approvalRate>=60?C.amber:C.red }}>{approvalRate}%</div>
              <div style={{ fontSize:9,color:'var(--text3)' }}>approved</div>
            </div>
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:6,marginTop:10 }}>
            {statusDonut.map(d => (
              <div key={d.name} style={{ display:'flex',justifyContent:'space-between',fontSize:12 }}>
                <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                  <div style={{ width:10,height:10,borderRadius:2,background:d.fill }} />
                  <span style={{ color:'var(--text2)' }}>{d.name}</span>
                </div>
                <strong style={{ color:d.fill }}>{d.value}</strong>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
}

/* ── QC Tab helpers ────────────────────────────────── */

function isoWeek(d) {
  const day = d.getDay() || 7;
  const t = new Date(d);
  t.setDate(t.getDate() + 4 - day);
  const ys = new Date(t.getFullYear(), 0, 1);
  return Math.ceil(((t - ys) / 86400000 + 1) / 7);
}

function allWeeksInRange(from, to) {
  const weeks = [];
  const d = new Date(from);
  const end = new Date(to);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
  while (d <= end) {
    const w = isoWeek(d);
    if (!weeks.includes(w)) weeks.push(w);
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

const QC_SECTIONS = [
  { key: 'Letter Moulding',                   label: 'Letter Moulding',                   items: ['Workmanship', 'Surface Finish', 'Quantity', 'Depth of Material', 'Edges and Side Finish'] },
  { key: 'Metal Fabrication',                 label: 'Metal Fabrication',                 items: ['Structural & Support', 'Material Type / Size', 'Surface Finish', 'Fixing Methods & Assembly', 'Quantity'] },
  { key: 'CNC Laser Cutting',                 label: 'CNC Laser Cutting',                 items: ['Quantity', 'Cutting Quality', 'Verify Cutting Files', 'Material Types'] },
  { key: 'Acrylic',                           label: 'Acrylic',                           items: ['Fixing', 'Workmanship', 'Material Specification', 'Quantity', 'Surface Finish'] },
  { key: 'Packaging',                         label: 'Packaging',                         items: ['Cleaning', 'Physical Damages', 'Workmanship', 'Quantity'] },
  { key: 'Electricals',                       label: 'Electricals',                       items: ['LED Brand', 'Quantity', 'KELVIN Temperature & Illumination', 'Verify Electrical Components', 'Visual Checkup (Darkspots)'] },
  { key: 'Painting',                          label: 'Painting',                          items: ['Quantity', 'Workmanship', 'Surface Finish', 'Colour / Coat'] },
  { key: 'Vinyl / Graphics / ScreenPrinting', label: 'Vinyl / Graphics / ScreenPrinting', items: ['Material Specification', 'Print Quality', 'Workmanship', 'Surface Finish'] },
  { key: 'Polishing',                         label: 'Polishing',                         items: ['Surface Finish', 'Workmanship'] },
  { key: 'Outsourced & Fixing Materials',     label: 'Outsourced & Fixing Materials',     items: ['Quantity', 'Material Specification', 'Surface Finish', 'Workmanship'] },
  { key: 'Sanding',                           label: 'Sanding',                           items: ['Powder Coating Coat', 'Workmanship', 'Surface Finish'] },
];

/* ── QC Tab ────────────────────────────────────────── */
function QCTab({ data, from, to }) {
  const s   = data?.summary ?? {};
  const mo  = fillMonths(from, to, data?.monthly ?? [], { total:0, passed:0, failed:0, inProgress:0 });
  const wbs = data?.weeklyBySection ?? {};

  const [activeSection, setActiveSection] = useState(QC_SECTIONS[0].key);

  const weeks       = allWeeksInRange(from, to);
  const secEntry    = wbs[activeSection] ?? {};
  const secRaw      = secEntry.weekly ?? [];
  const itemsRaw    = secEntry.items  ?? {};
  const activeDef   = QC_SECTIONS.find(s => s.key === activeSection);

  const weekData = weeks.map(w => {
    const found = secRaw.find(r => r.week === w);
    return found
      ? { week: `W${w}`, passed: found.passed, inProgress: found.inProgress, failed: found.failed, total: found.total }
      : { week: `W${w}`, passed: 0, inProgress: 0, failed: 0, total: 0, nil: true };
  });

  const sectionHasData = (key) => (wbs[key]?.weekly ?? []).length > 0;
  const totalRejections = secRaw.reduce((s, r) => s + r.total, 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* KPIs */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <KPI label="Total QC Records"  value={s.total}      color={C.teal}  bg={C.tealL}  icon="🔍" />
        <KPI label="Passed"            value={s.passed}     color={C.green} bg={C.greenL} icon="✅" />
        <KPI label="Failed"            value={s.failed}     color={C.red}   bg={C.redL}   icon="❌" />
        <KPI label="In Progress"       value={s.inProgress} color={C.amber} bg={C.amberL} icon="⏳" />
        <KPI label="Overall Pass Rate" value={`${s.passRate??0}%`}
          color={s.passRate>=80?C.green:s.passRate>=60?C.amber:C.red}
          bg={s.passRate>=80?C.greenL:s.passRate>=60?C.amberL:C.redL} icon="📊" />
      </div>

      {/* Monthly trend */}
      <Card title="Monthly QC Trend">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={mo.map(r=>({...r,month:fmtM(r.month)}))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{fontSize:11,fill:'var(--text3)'}} />
            <YAxis tick={{fontSize:11,fill:'var(--text3)'}} allowDecimals={false} />
            <Tooltip {...TT} formatter={(v, name, props) => props.payload?.nil ? ['Nil', name] : [v, name]} />
            <Legend wrapperStyle={{fontSize:12}} />
            <Bar dataKey="passed"     name="Passed"      fill={C.green} stackId="q" />
            <Bar dataKey="inProgress" name="In Progress" fill={C.amber} stackId="q" />
            <Bar dataKey="failed"     name="Failed"      fill={C.red}   stackId="q" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Section rejection chart */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:10, overflow:'hidden' }}>
        {/* Card header */}
        <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:13, color:'var(--text)' }}>
          QC Rejections by Section
        </div>

        {/* Section tabs */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg2)' }}>
          {QC_SECTIONS.map(sec => {
            const hasData = sectionHasData(sec.key);
            const isActive = activeSection === sec.key;
            return (
              <button key={sec.key} onClick={() => setActiveSection(sec.key)}
                style={{
                  padding:'5px 12px', borderRadius:6, border:'1px solid', cursor:'pointer', fontSize:12, fontWeight:isActive ? 700 : 500,
                  borderColor: isActive ? C.teal : 'var(--border2)',
                  background:  isActive ? C.teal : 'var(--surface)',
                  color:       isActive ? '#fff'  : hasData ? 'var(--text)' : 'var(--text3)',
                  position: 'relative',
                }}>
                {sec.label}
                {hasData && !isActive && (
                  <span style={{ position:'absolute', top:3, right:3, width:5, height:5, borderRadius:'50%', background:C.red }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Chart */}
        <div style={{ padding:'12px 16px 16px' }}>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10 }}>
            <strong style={{ color:'var(--text)' }}>{QC_SECTIONS.find(sec=>sec.key===activeSection)?.label}</strong>
            {' — '}
            {totalRejections > 0
              ? <span>{totalRejections} rejection{totalRejections !== 1 ? 's' : ''} recorded</span>
              : <span style={{ color:C.green }}>No rejections in this period ✓</span>}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{fontSize:10,fill:'var(--text3)'}} />
              <YAxis tick={{fontSize:10,fill:'var(--text3)'}} allowDecimals={false} />
              <Tooltip {...TT} formatter={(v, name, props) => props.payload?.nil ? ['—', name] : [v, name]} />
              <Legend wrapperStyle={{fontSize:11}} />
              <Bar dataKey="passed"     name="Passed"      fill={C.green} stackId="s" />
              <Bar dataKey="inProgress" name="In Progress" fill={C.amber} stackId="s" />
              <Bar dataKey="failed"     name="Failed"      fill={C.red}   stackId="s" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Per-criteria charts */}
          {activeDef?.items?.length > 0 && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>
                Criteria Breakdown — {activeDef.label}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:12 }}>
                {activeDef.items.map(item => {
                  const raw  = itemsRaw[item] ?? [];
                  const data = weeks.map(w => {
                    const found = raw.find(r => r.week === w);
                    return { week: `W${w}`, count: found?.count ?? 0, nil: !found };
                  });
                  const total = raw.reduce((s, r) => s + r.count, 0);
                  return (
                    <div key={item} style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{item}</span>
                        <span style={{
                          fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:10,
                          background: total > 0 ? C.redL : C.greenL,
                          color:      total > 0 ? C.red  : C.green,
                        }}>
                          {total > 0 ? `${total} fail${total !== 1 ? 's' : ''}` : 'No fails'}
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={110}>
                        <ComposedChart data={data} barCategoryGap="35%">
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="week" tick={{fontSize:9,fill:'var(--text3)'}} tickLine={false} axisLine={false} />
                          <YAxis tick={{fontSize:9,fill:'var(--text3)'}} allowDecimals={false} width={20} />
                          <Tooltip {...TT} formatter={(v, name, props) => props.payload?.nil ? ['—', 'Failures'] : [v, 'Failures']} />
                          <Bar dataKey="count" name="Failures" fill={C.red} fillOpacity={0.75} radius={[3,3,0,0]} />
                          <Line type="monotone" dataKey="count" stroke={C.red} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── WO Complete Tab ───────────────────────────────── */
function WOCTab({ prodData, instData }) {
  const navigate = useNavigate();
  const ps = prodData?.summary ?? {};
  const pm = prodData?.monthly ?? [];
  const is = instData?.summary ?? {};
  const im = instData?.monthly ?? [];

  const peak = (mo) => mo.reduce((mx,r) => r.count>(mx?.count??0)?r:mx, null);
  const avg  = (mo) => mo.length>0 ? Math.round(mo.reduce((s,r)=>s+r.count,0)/mo.length) : 0;

  function MiniWOC({ label, summary, monthly, color, icon }) {
    const pk = peak(monthly);
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <KPI label="Total Completed" value={summary?.total} color={color} bg={color+'20'} icon={icon} />
          <KPI label="Monthly Average"  value={avg(monthly)}  color={C.blue}   bg={C.blueL}   icon="📊" sub="per month" />
          <KPI label="Peak Month"       value={pk?.count}     color={C.green}  bg={C.greenL}  icon="🏆" sub={pk?fmtM(pk.month):'—'} />
        </div>
        <Card title={`${label} — Monthly WO Completions`}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly.map(r=>({...r,month:fmtM(r.month)}))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{fontSize:11,fill:'var(--text3)'}} />
              <YAxis tick={{fontSize:11,fill:'var(--text3)'}} allowDecimals={false} />
              <Tooltip {...TT} />
              <Bar dataKey="count" name="WO Completed" radius={[6,6,0,0]}>
                {monthly.map((_,i)=><Cell key={i} fill={i===monthly.indexOf(pk)?C.green:color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      <div style={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:13, color:'var(--text2)' }}>
          WO Complete records require all timesheets approved + full QC inspection.
        </div>
        <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/woc')}>View All Records →</button>
      </div>

      {/* Production section */}
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <div style={{ width:4, height:20, borderRadius:2, background:C.blue }} />
          <span style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>🔩 Production WO Complete</span>
        </div>
        <MiniWOC label="Production" summary={ps} monthly={pm} color={C.blue} icon="🔩" />
      </div>

      <div style={{ borderTop:'2px dashed var(--border2)', paddingTop:8 }} />

      {/* Installation section */}
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <div style={{ width:4, height:20, borderRadius:2, background:C.sky }} />
          <span style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>🏗️ Installation WO Complete</span>
        </div>
        <MiniWOC label="Installation" summary={is} monthly={im} color={C.sky} icon="🏗️" />
      </div>

      {/* Comparison bar */}
      {(ps.total > 0 || is.total > 0) && (
        <Card title="Production vs Installation — Side by Side">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {[['Production', ps.total ?? 0, C.blue], ['Installation', is.total ?? 0, C.sky]].map(([l,v,c])=>(
              <div key={l} style={{ background:c+'18', borderRadius:10, padding:'20px', textAlign:'center', border:`1px solid ${c}40` }}>
                <div style={{ fontSize:36, fontWeight:900, color:c }}>{v}</div>
                <div style={{ fontSize:13, color:'var(--text2)', marginTop:4, fontWeight:600 }}>{l}</div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                  {(ps.total+is.total)>0 ? `${Math.round(v/(ps.total+is.total)*100)}% of total` : '—'}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ══ Main page ══════════════════════════════════════ */
export default function AnalyticsPage() {
  const { type } = useParams();
  const navigate = useNavigate();
  const VALID_TABS = ['prod', 'inst', 'qc', 'woc'];
  const activeType = VALID_TABS.includes(type) ? type : 'prod';

  const [presetIdx, setPresetIdx] = useState(2);
  const [cFrom,     setCFrom]     = useState(monthsAgo(6));
  const [cTo,       setCTo]       = useState(today());

  const isCustom = presetIdx === PRESETS.length - 1;
  const from = isCustom ? cFrom : (PRESETS[presetIdx].from?.() ?? cFrom);
  const to   = isCustom ? cTo   : (PRESETS[presetIdx].to?.()   ?? cTo);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', from, to],
    queryFn:  () => api.get('/analytics', { params: { from, to } }).then(r => r.data),
    staleTime: 60_000,
  });

  const activeTab = TABS.find(t => t.key === activeType);

  return (
    <div className="page-content">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div className="page-title">{activeTab?.icon} {activeTab?.label} Analytics</div>
          <div className="page-sub">Performance overview for {activeTab?.label}</div>
        </div>

        {/* Date range presets */}
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {PRESETS.map((p,i) => (
            <button key={i} onClick={() => setPresetIdx(i)}
              style={{
                padding:'6px 12px', borderRadius:6, border:'1px solid var(--border2)', cursor:'pointer', fontSize:12, fontWeight:600,
                background: presetIdx===i ? (activeTab?.color ?? 'var(--accent)') : 'var(--surface)',
                color: presetIdx===i ? '#fff' : 'var(--text3)',
              }}>
              {p.label}
            </button>
          ))}
          {isCustom && (
            <>
              <input type="date" value={cFrom} onChange={e=>setCFrom(e.target.value)}
                style={{ padding:'5px 8px',fontSize:12,border:'1px solid var(--border2)',borderRadius:6,background:'var(--surface)',color:'var(--text)' }} />
              <span style={{ color:'var(--text3)',fontSize:12 }}>→</span>
              <input type="date" value={cTo} onChange={e=>setCTo(e.target.value)}
                style={{ padding:'5px 8px',fontSize:12,border:'1px solid var(--border2)',borderRadius:6,background:'var(--surface)',color:'var(--text)' }} />
            </>
          )}
        </div>
      </div>

      <div style={{ fontSize:12,color:'var(--text3)',marginBottom:16,display:'flex',alignItems:'center',gap:6 }}>
        <span style={{ width:10,height:10,borderRadius:'50%',background:activeTab?.color,display:'inline-block' }}/>
        <strong>{activeTab?.label}</strong> · {from} → {to}
        {isLoading && <span style={{ marginLeft:8 }}>Loading…</span>}
      </div>

      {!isLoading && (
        activeType === 'prod' ? <TSTab  data={data?.production}   color={C.blue}   label="Production"   from={from} to={to} /> :
        activeType === 'inst' ? <TSTab  data={data?.installation} color={C.sky}    label="Installation" from={from} to={to} /> :
        activeType === 'qc'   ? <QCTab  data={data?.qc} from={from} to={to} /> :
                                <WOCTab prodData={data?.wocProduction} instData={data?.wocInstallation} />
      )}
    </div>
  );
}
