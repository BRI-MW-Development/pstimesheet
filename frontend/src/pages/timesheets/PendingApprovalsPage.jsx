import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/format';

const STATUS_VARIANT = { Draft: 'draft', Submitted: 'submitted', Approved: 'approved', Rejected: 'rejected' };

const QUICK_REASONS = [
  'Incorrect work order',
  'Missing labour details',
  'Duplicate entry',
  'Wrong date / shift',
  'Incomplete information',
];

function editUrl(row) {
  const base = row.tsType === 'INST'
    ? `/timesheets/inst/${row.tsDocNo}/edit`
    : `/timesheets/prod/${row.tsDocNo}/edit`;
  return `${base}?from=approvals`;
}

/* ── Reject reason modal ──────────────────────────────────────────────────── */
function RejectModal({ docNo, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const toast = useToast();
  const { mutate, isPending } = useMutation({
    mutationFn: () => api.post(`/timesheets/${docNo}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => { toast('Timesheet rejected.', 'success'); onDone(); onClose(); },
    onError: (err) => toast(err?.response?.data?.message ?? 'Reject failed.', 'error'),
  });

  const MAX = 300;
  const remaining = MAX - reason.length;
  const canSubmit = reason.trim().length >= 5 && reason.length <= MAX;

  return (
    <Modal onClose={onClose} title="">
      <div className="reject-modal">
        <div className="reject-modal__header">
          <div className="reject-modal__icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div>
            <div className="reject-modal__title">Reject Timesheet</div>
            <div className="reject-modal__doc">{docNo}</div>
          </div>
        </div>

        <div className="reject-modal__section-label">Quick reasons</div>
        <div className="reject-modal__chips">
          {QUICK_REASONS.map((r) => (
            <button key={r} type="button"
              className={`reject-chip${reason === r ? ' reject-chip--active' : ''}`}
              onClick={() => setReason(reason === r ? '' : r)}
            >{r}</button>
          ))}
        </div>

        <div className="reject-modal__section-label" style={{ marginTop: 14 }}>
          Or write a custom reason <span style={{ color: '#9ca3af', fontWeight: 400 }}>(required)</span>
        </div>
        <textarea
          className="reject-modal__textarea"
          rows={4} maxLength={MAX} value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe the issue clearly so the employee can correct and resubmit…"
          autoFocus
        />
        <div className="reject-modal__counter" style={{ color: remaining < 30 ? '#ef4444' : '#9ca3af' }}>
          {remaining} characters remaining
        </div>

        <div className="reject-modal__footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={isPending}>Cancel</button>
          <button className="reject-modal__reject-btn" disabled={isPending || !canSubmit} onClick={() => mutate()}>
            {isPending
              ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Rejecting…</>
              : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Reject Timesheet</>
            }
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── View modal ───────────────────────────────────────────────────────────── */
function ViewModal({ row, onClose, onApprove, onReject, onEdit, approving }) {
  const fmtMins = (m) => {
    if (!m) return '—';
    const h = Math.floor(m / 60), mn = m % 60;
    return h ? `${h}h ${mn}m` : `${mn}m`;
  };

  return (
    <Modal title="" onClose={onClose} size="md">
      {/* Header bar */}
      <div style={{
        background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
        margin: '-20px -20px 20px',
        padding: '18px 20px',
        borderRadius: '8px 8px 0 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-mono)' }}>{row.tsDocNo}</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>
            {row.tsType} · {formatDate(row.entryDate)}
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[row.status] ?? 'submitted'}>{row.status}</Badge>
      </div>

      {/* Details grid */}
      <div className="detail-grid" style={{ marginBottom: 20 }}>
        {[
          ['Employee',   row.entered_by_name ?? '—'],
          ['Department', row.department_code  ?? '—'],
          ['Work Order', row.workOrderNo      ?? '—'],
          ['Project',    row.projectName      ?? row.projectId ?? '—'],
          ['Shift',      row.shiftCode        ?? '—'],
          ['Duration',   fmtMins(row.totalDuration)],
          ['Submitted',  row.submittedAt ? formatDate(row.submittedAt) : '—'],
        ].map(([label, val]) => (
          <div className="detail-row" key={label}>
            <span>{label}</span><span>{val}</span>
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {/* Edit — navigates to form */}
        <button className="btn btn-ghost" onClick={() => { onClose(); onEdit(row); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>

        {/* Reject */}
        <button
          disabled={approving}
          onClick={() => { onClose(); onReject(row.tsDocNo); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 6, border: '1px solid #fca5a5',
            background: '#fff1f1', color: '#dc2626', fontWeight: 600, fontSize: 13,
            cursor: approving ? 'not-allowed' : 'pointer', opacity: approving ? 0.5 : 1,
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          Reject
        </button>

        {/* Approve */}
        <button
          disabled={approving}
          onClick={() => { onApprove(row.tsDocNo); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: '#16a34a', color: '#fff', fontWeight: 600, fontSize: 13,
            cursor: approving ? 'not-allowed' : 'pointer', opacity: approving ? 0.5 : 1,
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Approve
        </button>
      </div>
    </Modal>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function PendingApprovalsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rejectDocNo, setRejectDocNo] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [filter, setFilter] = useState('');
  const [approvingSet, setApprovingSet] = useState(new Set());

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: () => api.get('/timesheets/pending-approvals').then((r) => r.data),
    refetchInterval: 60000,
  });

  const { mutate: approve } = useMutation({
    mutationFn: (docNo) => api.post(`/timesheets/${docNo}/approve`).then((r) => r.data),
    onMutate: (docNo) => {
      setApprovingSet((s) => new Set([...s, docNo]));
      queryClient.setQueryData(['pending-approvals'], (old = []) => old.filter((t) => t.tsDocNo !== docNo));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prod-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['inst-timesheets'] });
      toast('Timesheet approved.', 'success');
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      toast('Approve failed.', 'error');
    },
    onSettled: (_, __, docNo) => {
      setApprovingSet((s) => { const n = new Set(s); n.delete(docNo); return n; });
    },
  });

  function handleDone() {
    queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    queryClient.invalidateQueries({ queryKey: ['prod-timesheets'] });
    queryClient.invalidateQueries({ queryKey: ['inst-timesheets'] });
  }

  const filtered = timesheets.filter(
    (ts) =>
      !filter ||
      ts.tsDocNo?.toLowerCase().includes(filter.toLowerCase()) ||
      ts.entered_by_name?.toLowerCase().includes(filter.toLowerCase()) ||
      ts.department_code?.toLowerCase().includes(filter.toLowerCase())
  );

  const columns = [
    { key: '#',              label: '#',          num: true,  sort: false, render: (_, i) => i + 1 },
    { key: 'tsDocNo',        label: 'Doc No',     sort: true, render: (r) => <span className="wip-link">{r.tsDocNo}</span> },
    { key: 'tsType',         label: 'Type',       sort: true },
    { key: 'entryDate',      label: 'Date',       sort: true, render: (r) => formatDate(r.entryDate) },
    { key: 'entered_by_name',label: 'Employee',   sort: true },
    { key: 'department_code',label: 'Department', sort: true },
    { key: 'workOrderNo',    label: 'Work Order', sort: true },
    {
      key: 'status', label: 'Status', sort: true,
      render: (row) => <Badge variant={STATUS_VARIANT[row.status] ?? 'submitted'}>{row.status}</Badge>,
    },
    {
      key: 'actions', label: '', sort: false,
      render: (row) => (
        <button className="wip-icon-btn wip-icon-btn-view" title="View"
          onClick={() => setViewRow(row)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      ),
    },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="Pending Approvals"
        count={filtered.length}
        search={filter}
        onSearch={setFilter}
      />
      <Table columns={columns} data={filtered} loading={isLoading} emptyText="No timesheets pending approval." />

      {viewRow && (
        <ViewModal
          row={viewRow}
          onClose={() => setViewRow(null)}
          onApprove={(docNo) => approve(docNo)}
          onReject={(docNo) => setRejectDocNo(docNo)}
          onEdit={(row) => navigate(editUrl(row))}
          approving={approvingSet.has(viewRow.tsDocNo)}
        />
      )}

      {rejectDocNo && (
        <RejectModal
          docNo={rejectDocNo}
          onClose={() => setRejectDocNo(null)}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
