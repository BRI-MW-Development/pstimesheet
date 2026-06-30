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

function viewUrl(row) {
  const base = row.tsType === 'INST'
    ? `/timesheets/inst/${row.tsDocNo}/view`
    : `/timesheets/prod/${row.tsDocNo}/view`;
  return `${base}?from=approvals`;
}

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

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function PendingApprovalsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rejectDocNo, setRejectDocNo] = useState(null);
  const [filter, setFilter] = useState('');

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: () => api.get('/timesheets/pending-approvals').then((r) => r.data),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
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
          onClick={() => navigate(viewUrl(row))}>
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
