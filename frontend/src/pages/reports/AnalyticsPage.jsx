import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
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

/* ── Timesheet sub-tab (shared by Prod & Inst) ──── */
function TSTab({ data, color, label, navPath }) {
  const navigate = useNavigate();
  const s   = data?.summary      ?? {};
  const mo  = data?.monthly      ?? [];
  const dep = data?.byDepartment ?? [];

  const approvalRate = s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0;
  const statusDonut = [
    { name:'Approved',  value: s.approved  ?? 0, fill: C.green  },
    { name:'Submitted', value: s.submitted ?? 0, fill: C.amber  },
    { name:'Draft',     value: s.draft     ?? 0, fill: C.gray   },
    { name:'Rejected',  value: s.rejected  ?? 0, fill: C.red    },
  ].filter(d => d.value > 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* KPIs */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <KPI label="Total"          value={s.total}     color={color}    bg={color+'20'} icon="📋" />
        <KPI label="Approved"       value={s.approved}  color={C.green}  bg={C.greenL}   icon="✅" sub={`${approvalRate}% approval rate`} />
        <KPI label="Pending"        value={s.submitted} color={C.amber}  bg={C.amberL}   icon="⏳"
          sub={<button style={{background:'none',border:'none',color:C.amber,cursor:'pointer',fontSize:11,padding:0,fontWeight:600}} onClick={()=>navigate('/timesheets/pending-approvals')}>Review →</button>} />
        <KPI label="Draft"          value={s.draft}     color={C.gray}   bg={C.grayL}    icon="📝" />
        <KPI label="Rejected"       value={s.rejected}  color={C.red}    bg={C.redL}     icon="❌" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        {/* Monthly trend */}
        <Card title={`${label} Timesheets — Monthly Trend`}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={mo.map(r=>({...r,month:fmtM(r.month)}))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{fontSize:11,fill:'var(--text3)'}} />
              <YAxis tick={{fontSize:11,fill:'var(--text3)'}} allowDecimals={false} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{fontSize:12}} />
              <Line type="monotone" dataKey="total"     name="Total"     stroke={color}   strokeWidth={2.5} dot={{r:3}} />
              <Line type="monotone" dataKey="approved"  name="Approved"  stroke={C.green} strokeWidth={2}   dot={{r:3}} />
              <Line type="monotone" dataKey="submitted" name="Submitted" stroke={C.amber} strokeWidth={1}   strokeDasharray="4 2" dot={false} />
              <Line type="monotone" dataKey="rejected"  name="Rejected"  stroke={C.red}   strokeWidth={1}   strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Status donut */}
        <Card title="Status Distribution">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={statusDonut} dataKey="value" innerRadius={42} outerRadius={65} paddingAngle={3}>
                {statusDonut.map((d,i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip {...TT} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:8 }}>
            {statusDonut.map(d => (
              <div key={d.name} style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:10,height:10,borderRadius:2,background:d.fill }} />
                  <span style={{ color:'var(--text2)' }}>{d.name}</span>
                </div>
                <strong style={{ color:d.fill }}>{d.value}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Stacked monthly bar */}
        <Card title="Monthly Volume by Status">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mo.map(r=>({...r,month:fmtM(r.month)}))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{fontSize:10,fill:'var(--text3)'}} />
              <YAxis tick={{fontSize:10,fill:'var(--text3)'}} allowDecimals={false} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{fontSize:11}} />
              <Bar dataKey="approved"  name="Approved"  fill={C.green} stackId="s" />
              <Bar dataKey="submitted" name="Submitted" fill={C.amber} stackId="s" />
              <Bar dataKey="rejected"  name="Rejected"  fill={C.red}   stackId="s" />
              <Bar dataKey="draft"     name="Draft"     fill={C.gray}  stackId="s" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Approval rate line */}
        <Card title="Monthly Approval Rate (%)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={mo.map(r=>({ month:fmtM(r.month), rate: r.total>0?Math.round(r.approved/r.total*100):0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{fontSize:10,fill:'var(--text3)'}} />
              <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fontSize:10,fill:'var(--text3)'}} />
              <Tooltip {...TT} formatter={v=>`${v}%`} />
              <Line type="monotone" dataKey="rate" name="Approval Rate" stroke={color} strokeWidth={2.5} dot={{r:4,fill:color}} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top departments */}
      {dep.length > 0 && (
        <Card title="Top Departments">
          <ResponsiveContainer width="100%" height={Math.max(160, dep.length * 30)}>
            <BarChart data={dep} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:10,fill:'var(--text3)'}} allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={100} tick={{fontSize:10,fill:'var(--text3)'}} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{fontSize:11}} />
              <Bar dataKey="total"    name="Total"    fill={color}   radius={[0,4,4,0]} />
              <Bar dataKey="approved" name="Approved" fill={C.green} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

/* ── QC Tab ────────────────────────────────────────── */
function QCTab({ data }) {
  const s   = data?.summary   ?? {};
  const mo  = data?.monthly   ?? [];
  const sec = data?.bySection ?? [];

  const qcDonut = [
    { name:'Passed',      value: s.passed     ?? 0, fill: C.green },
    { name:'Failed',      value: s.failed     ?? 0, fill: C.red   },
    { name:'In Progress', value: s.inProgress ?? 0, fill: C.amber },
  ].filter(d => d.value > 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <KPI label="Total QC Records" value={s.total}      color={C.teal}  bg={C.tealL}  icon="🔍" />
        <KPI label="Passed"           value={s.passed}     color={C.green} bg={C.greenL} icon="✅" />
        <KPI label="Failed"           value={s.failed}     color={C.red}   bg={C.redL}   icon="❌" />
        <KPI label="In Progress"      value={s.inProgress} color={C.amber} bg={C.amberL} icon="⏳" />
        <KPI label="Overall Pass Rate" value={`${s.passRate??0}%`}
          color={s.passRate>=80?C.green:s.passRate>=60?C.amber:C.red}
          bg={s.passRate>=80?C.greenL:s.passRate>=60?C.amberL:C.redL} icon="📊" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        <Card title="Monthly QC Trend">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={mo.map(r=>({...r,month:fmtM(r.month)}))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{fontSize:11,fill:'var(--text3)'}} />
              <YAxis tick={{fontSize:11,fill:'var(--text3)'}} allowDecimals={false} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{fontSize:12}} />
              <Bar dataKey="passed"     name="Passed"      fill={C.green} stackId="q" />
              <Bar dataKey="inProgress" name="In Progress" fill={C.amber} stackId="q" />
              <Bar dataKey="failed"     name="Failed"      fill={C.red}   stackId="q" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Result Distribution">
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <div style={{ position:'relative', width:'100%', height:150 }}>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={qcDonut} dataKey="value" innerRadius={42} outerRadius={65} paddingAngle={3}>
                    {qcDonut.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none' }}>
                <div style={{ fontSize:22,fontWeight:900,color:s.passRate>=80?C.green:C.amber }}>{s.passRate??0}%</div>
                <div style={{ fontSize:9,color:'var(--text3)' }}>pass rate</div>
              </div>
            </div>
            {qcDonut.map((d,i)=>(
              <div key={d.name} style={{ display:'flex',justifyContent:'space-between',width:'100%',fontSize:12 }}>
                <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                  <div style={{ width:10,height:10,borderRadius:2,background:d.fill }}/><span style={{ color:'var(--text2)' }}>{d.name}</span>
                </div>
                <strong style={{ color:d.fill }}>{d.value}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {mo.length > 1 && (
        <Card title="Pass Rate Trend (%)">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={mo.map(r=>({ month:fmtM(r.month), rate:r.total>0?Math.round(r.passed/r.total*100):0, total:r.total }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{fontSize:11,fill:'var(--text3)'}} />
              <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fontSize:11,fill:'var(--text3)'}} />
              <Tooltip {...TT} formatter={v=>`${v}%`} />
              <Legend wrapperStyle={{fontSize:12}} />
              <Line type="monotone" dataKey="rate"  name="Pass Rate" stroke={C.teal}  strokeWidth={2.5} dot={{r:4}} />
              <Line type="monotone" dataKey="total" name="Total QCs" stroke={C.gray}  strokeWidth={1}   strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {sec.length > 0 && (
        <Card title="Inspection Checklist — Section Pass Rates">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px' }}>
            {sec.map(s => (
              <div key={s.name}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                  <span style={{ color:'var(--text2)', fontWeight:500 }}>{s.name}</span>
                  <div style={{ display:'flex', gap:8 }}>
                    <span style={{ fontSize:11, color:'var(--text3)' }}>{s.pass}✓ {s.fail}✗</span>
                    <span style={{ fontWeight:800, color:s.passRate>=80?C.green:s.passRate>=60?C.amber:C.red }}>{s.passRate}%</span>
                  </div>
                </div>
                <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${s.passRate}%`, background:s.passRate>=80?C.green:s.passRate>=60?C.amber:C.red, borderRadius:3 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
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
  const [tab,       setTab]       = useState('prod');
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

  const activeTab = TABS.find(t => t.key === tab);

  return (
    <div className="page-content">
      <div style={{ marginBottom:20 }}>
        <div className="page-title">Analytics</div>
        <div className="page-sub">Separate performance reports — Production, Installation, QC, WO Complete</div>
      </div>

      {/* Tab bar + date filter */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:0, background:'var(--surface2)', borderRadius:10, padding:4, border:'1px solid var(--border)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                background: tab===t.key ? t.color : 'transparent',
                color: tab===t.key ? '#fff' : 'var(--text3)',
                display:'flex', alignItems:'center', gap:6, transition:'all 0.15s',
                boxShadow: tab===t.key ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
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
        tab === 'prod' ? <TSTab  data={data?.production}   color={C.blue}   label="Production"   navPath="/timesheets/prod" /> :
        tab === 'inst' ? <TSTab  data={data?.installation} color={C.sky}    label="Installation" navPath="/timesheets/inst" /> :
        tab === 'qc'   ? <QCTab  data={data?.qc} /> :
                         <WOCTab prodData={data?.wocProduction} instData={data?.wocInstallation} />
      )}
    </div>
  );
}
