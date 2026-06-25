import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import Badge from '../components/ui/Badge';

const STATUS_VARIANT = { Draft: 'draft', Submitted: 'submitted', Approved: 'approved', Rejected: 'rejected' };
const TYPE_LABEL     = { INST: 'Installation', PROJ: 'Projects', PROD: 'Production' };
const TYPE_VARIANT   = { INST: 'submitted', PROJ: 'info', PROD: 'active' };
const ACTIVITY_COLOR = { Draft: 'var(--text3)', Submitted: 'var(--amber)', Approved: 'var(--green)', Rejected: 'var(--red)' };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function fmtDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }).toLowerCase();
}

function KpiCard({ label, value, sub, color, onClick }) {
  return (
    <div className="kpi-card" style={{ cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value ?? '—'}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const user        = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const dataScope   = useAuthStore((s) => s.dataScope);
  const navigate    = useNavigate();

  // ── Permission flags ──────────────────────────────────────────────────────
  const hasProd    = permissions.some(p => p.module === 'PROD'        && p.canRead);
  const hasInst    = permissions.some(p => p.module === 'INST'        && p.canRead);
  const hasProj    = permissions.some(p => p.module === 'PROJ'        && p.canRead);
  const hasWoc     = permissions.some(p => p.module === 'WO_COMPLETE' && p.canRead);
  const canApprove = permissions.some(p => ['PROD','INST','PROJ'].includes(p.module) && p.canWrite && p.canReport);
  const isOwnScope = dataScope === 'Own';
  const tsTypeCount = [hasProd, hasInst, hasProj].filter(Boolean).length;

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: stats = {} } = useQuery({
    queryKey: ['dashboard-stats', user?.userId],
    queryFn:  () => api.get('/auth/dashboard-stats').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: audit = null } = useQuery({
    queryKey: ['login-audit', user?.userId],
    queryFn:  () => api.get('/auth/login-audit').then(r => r.data),
  });

  const ts       = stats.timesheets    ?? {};
  const woc      = stats.woComplete    ?? {};
  // hasQc derived from API response — not from stale local permissions store
  const qc       = stats.qc ?? null;
  const hasQc    = qc !== null;
  const recentTs = stats.recentTimesheets ?? [];

  const failColor = (audit?.failuresToday ?? 0) > 0 ? 'var(--red)' : 'var(--green)';
  const pwExpiry  = audit?.passwordExpiry ? (() => {
    const daysLeft = Math.ceil((new Date(audit.passwordExpiry) - new Date()) / 86_400_000);
    return daysLeft <= 7 ? 'var(--red)' : daysLeft <= 30 ? 'var(--amber)' : 'var(--text1)';
  })() : 'var(--text1)';

  // ── Overview cells — only show accessible types ───────────────────────────
  const overviewCells = [
    hasProd && { label: 'Production',   value: ts.prodCount,  color: 'var(--blue)'   },
    hasInst && { label: 'Installation', value: ts.instCount,  color: 'var(--accent)' },
    hasProj && { label: 'Projects',     value: ts.projCount,  color: 'var(--green)'  },
    { label: 'Draft',     value: ts.draft,     color: 'var(--text3)' },
    { label: 'Submitted', value: ts.submitted, color: 'var(--amber)' },
    { label: 'Approved',  value: ts.approved,  color: 'var(--green)' },
  ].filter(Boolean);

  // ── "This Month" label changes when user only sees their own records ───────
  const thisMonthLabel = isOwnScope ? 'My Timesheets' : 'This Month';
  const thisMonthSub   = isOwnScope ? 'Created by me' : 'Timesheets created';

  return (
    <div className="page-content">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="page-title">
            {greeting()}, {user?.displayName?.split(' ')[0] ?? user?.username}
          </div>
          <div className="page-sub">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        {canApprove && (ts.submitted ?? 0) > 0 && (
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/timesheets/pending-approvals')}>
            {ts.submitted} Pending Approval{ts.submitted !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ── KPI Row ── */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KpiCard
          label={thisMonthLabel}
          value={ts.thisMonth}
          sub={thisMonthSub}
          color="var(--blue)"
        />
        {canApprove && (
          <KpiCard
            label="Pending Approval"
            value={ts.submitted}
            sub="Awaiting review"
            color="var(--amber)"
            onClick={() => navigate('/timesheets/pending-approvals')}
          />
        )}
        <KpiCard
          label={isOwnScope ? 'My Approved' : 'Approved'}
          value={ts.approved}
          sub="Total approved"
          color="var(--green)"
        />
        {hasWoc && (
          <KpiCard
            label="WO Completed"
            value={woc.thisMonth}
            sub="This month"
            color="var(--accent)"
          />
        )}
        {hasQc && (
          <KpiCard
            label="QC Passed"
            value={qc.passed}
            sub="Total passed"
            color="var(--green)"
            onClick={() => navigate('/qc')}
          />
        )}
        {hasQc && (qc.failed ?? 0) > 0 && (
          <KpiCard
            label="QC Failed"
            value={qc.failed}
            sub="Needs attention"
            color="var(--red)"
            onClick={() => navigate('/qc')}
          />
        )}
      </div>

      {/* ── Timesheet Overview — only types the user can access ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div className="card-title">Timesheet Overview</div>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {ts.total ?? 0} total{isOwnScope ? ' (mine)' : ''}
          </span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${overviewCells.length}, 1fr)`,
          gap: 0, padding: '0 4px 4px',
        }}>
          {overviewCells.map(({ label, value, color }, i) => (
            <div key={label} style={{
              padding: '12px 16px',
              borderRight: i < overviewCells.length - 1 ? '1px solid var(--border2)' : undefined,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{value ?? 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── QC Overview ── */}
      {hasQc && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <div className="card-title">QC Overview</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/qc')}>View All →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
            {[
              { label: 'Total Records',  value: qc.total,      color: 'var(--text)'    },
              { label: 'In Progress',    value: qc.inProgress, color: 'var(--amber)'   },
              { label: 'Passed',         value: qc.passed,     color: 'var(--green)'   },
              { label: 'Failed',         value: qc.failed,     color: qc.failed > 0 ? 'var(--red)' : 'var(--text3)' },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{
                padding: '16px 20px', cursor: 'pointer',
                borderRight: i < arr.length - 1 ? '1px solid var(--border2)' : undefined,
              }} onClick={() => navigate('/qc')}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Timesheets + Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>

        <div className="card">
          <div className="card-head">
            <div className="card-title">{isOwnScope ? 'My Recent Timesheets' : 'Recent Timesheets'}</div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Document No</th>
                {tsTypeCount > 1 && <th>Type</th>}
                <th>Entered By</th>
                <th>Project</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTs.length === 0 ? (
                <tr>
                  <td colSpan={tsTypeCount > 1 ? 6 : 5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 28, fontSize: 12 }}>
                    No timesheets yet
                  </td>
                </tr>
              ) : recentTs.map((r) => {
                const type = (r.tsType ?? '').toUpperCase();
                return (
                  <tr key={r.tsDocNo ?? r.docNo}>
                    <td><span className="wip-link">{r.tsDocNo ?? r.docNo}</span></td>
                    {tsTypeCount > 1 && (
                      <td><Badge variant={TYPE_VARIANT[type] ?? 'draft'}>{TYPE_LABEL[type] ?? type}</Badge></td>
                    )}
                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>{r.entered_by_name ?? '—'}</td>
                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>{r.projectName ?? '—'}</td>
                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>{fmtDate(r.entryDate)}</td>
                    <td><Badge variant={STATUS_VARIANT[r.status] ?? 'draft'}>{r.status}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">Recent Activity</div>
          </div>
          <div className="card-body-sm">
            {recentTs.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 12, padding: '8px 0' }}>No activity yet</div>
            ) : recentTs.slice(0, 8).map((r, i) => {
              const type   = (r.tsType ?? '').toUpperCase();
              const color  = ACTIVITY_COLOR[r.status] ?? 'var(--text3)';
              const action = r.status === 'Submitted' ? 'Submitted for approval'
                           : r.status === 'Approved'  ? 'Approved'
                           : r.status === 'Rejected'  ? 'Rejected'
                           : 'Created (draft)';
              return (
                <div key={i} className="notif-item">
                  <div className="notif-dot-lg" style={{ background: color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="notif-msg" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="wip-link" style={{ fontSize: 12 }}>{r.tsDocNo ?? r.docNo}</span>
                      {tsTypeCount > 1 && (
                        <Badge variant={TYPE_VARIANT[type] ?? 'draft'} style={{ fontSize: 10 }}>
                          {TYPE_LABEL[type] ?? type}
                        </Badge>
                      )}
                    </div>
                    <div className="notif-time">{action} · {fmtDate(r.entryDate)}</div>
                    {r.entered_by_name && (
                      <div className="notif-time" style={{ marginTop: 1 }}>{r.entered_by_name}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Login Audit ── */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">My Login Audit</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {[
            { label: 'Previous Login',       val: fmtDateTime(audit?.previousLogin),       color: 'var(--text1)', large: false },
            { label: 'Successful Today',      val: audit?.successfulToday ?? '—',           color: 'var(--green)',  large: true  },
            { label: 'Failed Today',          val: audit?.failuresToday   ?? '—',           color: failColor,       large: true  },
            { label: 'Last Password Change',  val: fmtDateTime(audit?.lastPasswordChange),  color: 'var(--text1)', large: false },
            { label: 'Previous Mobile Login', val: fmtDateTime(audit?.previousMobileLogin), color: 'var(--text1)', large: false },
            { label: 'Password Expiration',   val: fmtDateTime(audit?.passwordExpiry),      color: pwExpiry,       large: false },
          ].map(({ label, val, color, large }, i) => (
            <div key={label} style={{
              padding: '14px 20px',
              borderRight: (i + 1) % 3 !== 0 ? '1px solid var(--border2)' : undefined,
              borderTop: i >= 3 ? '1px solid var(--border2)' : undefined,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ fontSize: large ? 24 : 13, fontWeight: large ? 700 : 500, color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
