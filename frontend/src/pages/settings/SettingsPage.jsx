import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function SettingsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['approval-settings'],
    queryFn: () => api.get('/approval-settings').then((r) => r.data),
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: (payload) =>
      api.put('/approval-settings', { rows: payload }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-settings'] });
      toast('Approval settings saved.', 'success');
      setEdits(null);
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const { mutate: deleteRow } = useMutation({
    mutationFn: (id) => api.delete(`/approval-settings/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-settings'] });
      toast('Row deleted.', 'success');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Delete failed.', 'error'),
  });

  const display = edits ?? rows;

  function setField(idx, field, val) {
    const next = display.map((r, i) => i === idx ? { ...r, [field]: val } : r);
    setEdits(next);
  }

  function addRow() {
    setEdits([...(edits ?? rows), { department: '', approverNames: '', approverEmails: '' }]);
  }

  if (isLoading) return <div className="page-content"><p>Loading…</p></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Approval Settings</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost" onClick={addRow}>+ Add Row</button>
          <button className="btn btn-primary" disabled={isPending || !edits}
            onClick={() => save(display)}>
            {isPending ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
        Configure which approvers receive notifications per department. Leave department blank for a global fallback.
      </p>

      <div className="wip-table-wrap">
        <table className="wip-table">
          <thead>
            <tr>
              <th>Department Code</th>
              <th>Approver Names</th>
              <th>Approver Emails (comma-separated)</th>
              <th style={{ width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {display.map((row, i) => (
              <tr key={i}>
                <td>
                  <input type="text" value={row.department ?? ''}
                    onChange={(e) => setField(i, 'department', e.target.value)}
                    style={{ width: '160px' }} placeholder="All / Dept code" />
                </td>
                <td>
                  <input type="text" value={row.approverNames ?? ''}
                    onChange={(e) => setField(i, 'approverNames', e.target.value)}
                    placeholder="e.g. John Smith" />
                </td>
                <td>
                  <input type="text" value={row.approverEmails ?? ''}
                    onChange={(e) => setField(i, 'approverEmails', e.target.value)}
                    placeholder="approver@example.com" />
                </td>
                <td>
                  {row.id && (
                    <button className="btn-icon" title="Delete"
                      onClick={() => { if (confirm('Delete this row?')) deleteRow(row.id); }}>
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {display.length === 0 && (
              <tr><td colSpan={4} className="table-empty">No settings configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
