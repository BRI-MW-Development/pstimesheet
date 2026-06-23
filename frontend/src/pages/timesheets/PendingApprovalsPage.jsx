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
        {/* Header */}
        <div className="reject-modal__header">
          <div className="reject-modal__icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div>
            <div className="reject-modal__title">Reject Timesheet</div>
            <div className="reject-modal__doc">{docNo}</div>
          </div>
        </div>

        {/* Quick reason chips */}
        <div className="reject-modal__section-label">Quick reasons</div>
        <div className="reject-modal__chips">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              className={`reject-chip${reason === r ? ' reject-chip--active' : ''}`}
              onClick={() => setReason(reason === r ? '' : r)}
            >{r}</button>
          ))}
        </div>

        {/* Text area */}
        <div className="reject-modal__section-label" style={{ marginTop: 14 }}>
          Or write a custom reason <span style={{ color: '#9ca3af', fontWeight: 400 }}>(required)</span>
        </div>
        <textarea
          className="reject-modal__textarea"
          rows={4}
          maxLength={MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe the issue clearly so the employee can correct and resubmit…"
          autoFocus
        />
        <div className="reject-modal__counter" style={{ color: remaining < 30 ? '#ef4444' : '#9ca3af' }}>
          {remaining} characters remaining
        </div>

        {/* Footer */}
        <div className="reject-modal__footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={isPending}>Cancel</button>
          <button
            className="reject-modal__reject-btn"
            disabled={isPending || !canSubmit}
            onClick={() => mutate()}
          >
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

function editUrl(row) {
  const base = row.tsType === 'INST'
    ? `/timesheets/inst/${row.tsDocNo}/edit`
    : `/timesheets/prod/${row.tsDocNo}/edit`;
  return `${base}?from=approvals`;
}

export default function PendingApprovalsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rejectDocNo, setRejectDocNo] = useState(null);
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
      // Optimistically remove from list immediately
      queryClient.setQueryData(['pending-approvals'], (old = []) => old.filter((t) => t.tsDocNo !== docNo));
    },
    onSuccess: (_, docNo) => {
      queryClient.invalidateQueries({ queryKey: ['prod-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['inst-timesheets'] });
      toast('Timesheet approved.', 'success');
    },
    onError: (err, docNo) => {
      // Rollback optimistic removal
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      toast(err?.response?.data?.message ?? 'Approve failed.', 'error');
    },
    onSettled: (_, __, docNo) => {
      setApprovingSet((s) => { const n = new Set(s); n.delete(docNo); return n; });
    },
  });

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
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="wip-icon-btn wip-icon-btn-edit" title="Edit before approving"
            onClick={() => navigate(editUrl(row))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button
            className="wip-icon-btn wip-icon-btn-approve"
            title="Approve"
            disabled={approvingSet.has(row.tsDocNo)}
            onClick={() => approve(row.tsDocNo)}
            style={{ opacity: approvingSet.has(row.tsDocNo) ? 0.5 : 1 }}
          >
            {approvingSet.has(row.tsDocNo)
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            }
          </button>
          <button className="wip-icon-btn wip-icon-btn-delete" title="Reject"
            disabled={approvingSet.has(row.tsDocNo)}
            onClick={() => setRejectDocNo(row.tsDocNo)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
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
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
            queryClient.invalidateQueries({ queryKey: ['prod-timesheets'] });
            queryClient.invalidateQueries({ queryKey: ['inst-timesheets'] });
          }}
        />
      )}
    </div>
  );
}
