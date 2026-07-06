import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';

const TABS = ['SMTP / Provider', 'Notification Rules', 'Templates', 'Email Log'];

const MODULE_LABELS = { PROD: 'Production Timesheet', INST: 'Installation Timesheet', PROJ: 'Projects Team', WO: 'WO Complete' };
const EVENT_LABELS  = { SUBMIT: 'Submitted', APPROVE: 'Approved', REJECT: 'Rejected', COMPLETE: 'Completed' };

function ruleLabel(rule) {
  const mod = MODULE_LABELS[rule.module] ?? rule.module;
  const evt = EVENT_LABELS[rule.event]  ?? rule.event;
  return `${mod} — ${evt}`;
}

export default function EmailSettingsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('SMTP / Provider');

  return (
    <div className="page-content">
      <div className="wip-list-header" style={{ marginBottom: 20 }}>
        <div className="wip-list-title">Email Settings</div>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        {TABS.map((t) => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'SMTP / Provider'     && <SmtpTab   toast={toast} queryClient={queryClient} />}
      {tab === 'Notification Rules'  && <RulesTab  toast={toast} queryClient={queryClient} />}
      {tab === 'Templates'           && <TemplatesTab toast={toast} queryClient={queryClient} />}
      {tab === 'Email Log'           && <LogTab    toast={toast} queryClient={queryClient} />}
    </div>
  );
}

// ── SMTP / Provider Tab ──────────────────────────────────────────────────────

function SmtpTab({ toast, queryClient }) {
  const [form, setForm] = useState(null);
  const [testTo, setTestTo] = useState('');
  const [showTestInput, setShowTestInput] = useState(false);

  const { data: smtpData, isLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: () => api.get('/email-settings').then((r) => r.data),
  });

  useEffect(() => {
    if (smtpData && !form) setForm({ ...smtpData, provider: smtpData.provider || 'smtp' });
  }, [smtpData]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (payload) => api.post('/email-settings', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      toast('Settings saved.', 'success');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const { mutate: testSend, isPending: isTesting } = useMutation({
    mutationFn: (to) => api.post('/email-settings/test-send', { to }).then((r) => r.data),
    onSuccess: (data) => toast(data?.message ?? 'Test email sent.', data?.ok ? 'success' : 'error'),
    onError: (err) => toast(err?.response?.data?.message ?? 'Test failed.', 'error'),
  });

  if (isLoading || !form) return <p>Loading…</p>;

  function set(field, val) { setForm((f) => ({ ...f, [field]: val })); }
  const isGraph = form.provider === 'graph';

  return (
    <div style={{ maxWidth: 580 }}>
      {/* Provider toggle */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><div className="card-title">Email Provider</div></div>
        <div className="card-body" style={{ display: 'flex', gap: 12 }}>
          {[
            { value: 'smtp',  label: 'SMTP',              desc: 'Standard email via SMTP server' },
            { value: 'graph', label: 'Microsoft 365',     desc: 'Send via Microsoft Graph API (O365)' },
          ].map(({ value, label, desc }) => (
            <label key={value} style={{
              flex: 1, border: `2px solid ${form.provider === value ? 'var(--accent)' : 'var(--border2)'}`,
              borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
              background: form.provider === value ? 'var(--accent-light,#e8f4fd)' : 'transparent',
            }}>
              <input type="radio" name="provider" value={value} checked={form.provider === value}
                onChange={() => set('provider', value)} style={{ marginRight: 8 }} />
              <strong style={{ fontSize: 13 }}>{label}</strong>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{desc}</div>
            </label>
          ))}
        </div>
      </div>

      {/* SMTP fields */}
      {!isGraph && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head"><div className="card-title">SMTP Configuration</div></div>
          <div className="card-body">
            <div className="form-grid-2">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">SMTP Host</label>
                <input className="form-control" type="text" value={form.smtpHost ?? ''}
                  onChange={(e) => set('smtpHost', e.target.value)} placeholder="smtp.office365.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Port</label>
                <input className="form-control" type="number" value={form.smtpPort ?? 587}
                  onChange={(e) => set('smtpPort', e.target.value)} placeholder="587" />
              </div>
              <div className="form-group">
                <label className="form-label">Encryption</label>
                <select className="form-control" value={form.encryption ?? 'tls'}
                  onChange={(e) => set('encryption', e.target.value)}>
                  <option value="tls">TLS / STARTTLS</option>
                  <option value="ssl">SSL</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-control" type="text" value={form.smtpUser ?? ''}
                  onChange={(e) => set('smtpUser', e.target.value)} autoComplete="off" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graph fields */}
      {isGraph && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head"><div className="card-title">Microsoft Graph / O365 Configuration</div></div>
          <div className="card-body">
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1e40af' }}>
              Requires an Azure App Registration with <strong>Mail.Send</strong> application permission (not delegated).
              The app must be granted admin consent in your tenant.
            </div>
            <div className="form-group">
              <label className="form-label">Tenant ID</label>
              <input className="form-control" type="text" value={form.graphTenantId ?? ''}
                onChange={(e) => set('graphTenantId', e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </div>
            <div className="form-group">
              <label className="form-label">Client ID (Application ID)</label>
              <input className="form-control" type="text" value={form.graphClientId ?? ''}
                onChange={(e) => set('graphClientId', e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </div>
            <div className="form-group">
              <label className="form-label">Client Secret</label>
              <input className="form-control" type="password" value={form.graphClientSecret ?? ''}
                onChange={(e) => set('graphClientSecret', e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </div>
          </div>
        </div>
      )}

      {/* From address (shared) */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><div className="card-title">Sender Identity</div></div>
        <div className="card-body">
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">From Email</label>
              <input className="form-control" type="email" value={form.fromEmail ?? ''}
                onChange={(e) => set('fromEmail', e.target.value)} placeholder="noreply@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">From Name</label>
              <input className="form-control" type="text" value={form.fromName ?? ''}
                onChange={(e) => set('fromName', e.target.value)} placeholder="PS TimeSheet" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Password</label>
              <input className="form-control" type="password" value={form.smtpPass ?? ''}
                onChange={(e) => set('smtpPass', e.target.value)} autoComplete="new-password" placeholder="••••••••" />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={!!form.enabled}
                onChange={(e) => set('enabled', e.target.checked)} />
              <span>Email notifications enabled</span>
            </label>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={isPending} onClick={() => save(form)}>
          {isPending ? 'Saving…' : 'Save Settings'}
        </button>
        {!showTestInput ? (
          <button className="btn btn-ghost" onClick={() => setShowTestInput(true)}>Send Test Email</button>
        ) : (
          <>
            <input className="form-control" type="email" value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="recipient@example.com"
              style={{ width: 220 }} />
            <button className="btn btn-ghost" disabled={isTesting || !testTo}
              onClick={() => testSend(testTo)}>
              {isTesting ? 'Sending…' : 'Send'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setShowTestInput(false); setTestTo(''); }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Notification Rules Tab ───────────────────────────────────────────────────

function RulesTab({ toast, queryClient }) {
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['email-notification-rules'],
    queryFn: () => api.get('/email-notification-rules').then((r) => r.data),
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: (payload) => api.put('/email-notification-rules', { rules: payload }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-notification-rules'] });
      toast('Notification rules saved.', 'success');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const [edits, setEdits] = useState(null);
  const display = edits ?? rules;

  useEffect(() => { if (rules.length && !edits) setEdits(null); }, [rules]);

  if (isLoading) return <p>Loading…</p>;

  function toggle(idx, field) {
    const updated = display.map((r, i) => i === idx ? { ...r, [field]: !r[field] } : r);
    setEdits(updated);
  }

  function setCC(idx, val) {
    const updated = display.map((r, i) => i === idx ? { ...r, ccEmails: val } : r);
    setEdits(updated);
  }

  return (
    <div>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
        Control which events trigger email notifications and who receives them.
      </p>
      <div className="wip-table-wrap">
        <table className="wip-table">
          <thead>
            <tr>
              <th>Event</th>
              <th style={{ width: 90, textAlign: 'center' }}>Enabled</th>
              <th style={{ width: 130, textAlign: 'center' }}>Notify Submitter</th>
              <th>CC Emails</th>
            </tr>
          </thead>
          <tbody>
            {display.length === 0 && (
              <tr><td colSpan={4} className="table-empty">No notification rules configured.</td></tr>
            )}
            {display.map((rule, i) => (
              <tr key={`${rule.module}-${rule.event}-${i}`}>
                <td style={{ fontSize: 13 }}>{ruleLabel(rule)}</td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={!!rule.enabled} onChange={() => toggle(i, 'enabled')} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={!!rule.sendToSubmitter} onChange={() => toggle(i, 'sendToSubmitter')} />
                </td>
                <td>
                  <input type="text" value={rule.ccEmails ?? ''}
                    onChange={(e) => setCC(i, e.target.value)}
                    placeholder="email1@co.com, email2@co.com"
                    style={{ width: '100%', fontSize: 12 }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-primary" disabled={isPending || !edits}
          onClick={() => save(display)}>
          {isPending ? 'Saving…' : 'Save Rules'}
        </button>
      </div>
    </div>
  );
}

// ── Templates Tab ────────────────────────────────────────────────────────────

const TEMPLATE_KEYS = [
  { key: 'TIMESHEET_SUBMIT',  label: 'Timesheet Submitted' },
  { key: 'TIMESHEET_APPROVE', label: 'Timesheet Approved' },
  { key: 'TIMESHEET_REJECT',  label: 'Timesheet Rejected' },
  { key: 'WO_COMPLETE',       label: 'WO Complete' },
];

function TemplatesTab({ toast, queryClient }) {
  const [selectedKey, setSelectedKey] = useState(TEMPLATE_KEYS[0].key);
  const [body, setBody]       = useState('');
  const [subject, setSubject] = useState('');

  const { data: tplData, isLoading } = useQuery({
    queryKey: ['email-template', selectedKey],
    queryFn: () => api.get(`/email-templates/${selectedKey}`).then((r) => r.data),
  });

  useEffect(() => {
    if (tplData) {
      setSubject(tplData.subject ?? '');
      setBody(tplData.bodyHtml ?? '');
    }
  }, [tplData, selectedKey]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.put(`/email-templates/${selectedKey}`, { subject, bodyHtml: body }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-template', selectedKey] });
      toast('Template saved.', 'success');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const { mutate: reset, isPending: isResetting } = useMutation({
    mutationFn: () => api.post(`/email-templates/${selectedKey}/reset`).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['email-template', selectedKey] });
      if (data) { setSubject(data.subject ?? ''); setBody(data.bodyHtml ?? ''); }
      toast('Template reset to default.', 'success');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Reset failed.', 'error'),
  });

  const [showPreview, setShowPreview] = useState(false);

  return (
    <div>
      <div className="form-group" style={{ maxWidth: 300, marginBottom: 16 }}>
        <label className="form-label">Template</label>
        <select className="form-control" value={selectedKey}
          onChange={(e) => { setSelectedKey(e.target.value); setShowPreview(false); }}>
          {TEMPLATE_KEYS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {isLoading ? <p>Loading…</p> : (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* Editor */}
          <div style={{ flex: '0 0 480px', minWidth: 0 }}>
            <div className="form-group">
              <label className="form-label">Subject</label>
              <input className="form-control" type="text" value={subject}
                onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Body (HTML)</label>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                Variables: {'{{docNo}}'}, {'{{type}}'}, {'{{submitter}}'}, {'{{approver}}'}, {'{{department}}'}, {'{{date}}'}, {'{{reason}}'}, {'{{workOrder}}'}
              </div>
              <textarea rows={18} value={body} onChange={(e) => setBody(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 12, width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" disabled={isPending} onClick={() => save()}>
                {isPending ? 'Saving…' : 'Save Template'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowPreview(p => !p)}>
                {showPreview ? 'Hide Preview' : 'Preview'}
              </button>
              <button className="btn btn-ghost" disabled={isResetting}
                onClick={() => { if (confirm('Reset to default template?')) reset(); }}>
                {isResetting ? 'Resetting…' : 'Reset to Default'}
              </button>
            </div>
          </div>

          {/* Live preview */}
          {showPreview && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Preview</div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#f3f4f6', padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  <strong>Subject:</strong> {subject}
                </div>
                <iframe
                  srcDoc={body}
                  style={{ width: '100%', minHeight: 520, border: 'none', borderRadius: 6, background: '#fff' }}
                  title="Email preview"
                  sandbox=""
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Email Log Tab ────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const MODULES = ['PROD','INST','PROJ','WOC','QC'];
const STATUS_COLOR = { sent: '#16a34a', failed: '#dc2626', skipped: '#6b7280' };

function LogTab({ toast, queryClient }) {
  const [filters, setFilters] = useState({ status: '', module: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(0);

  const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  if (filters.status)   params.set('status',   filters.status);
  if (filters.module)   params.set('module',   filters.module);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo)   params.set('dateTo',   filters.dateTo);

  const { data: result = {}, isLoading, refetch } = useQuery({
    queryKey: ['email-logs', filters, page],
    queryFn:  () => api.get(`/email-logs?${params}`).then(r => r.data),
    refetchInterval: 30000,
  });

  const logs  = result.data  ?? [];
  const total = result.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { mutate: clear, isPending: isClearing } = useMutation({
    mutationFn: () => api.delete('/email-logs').then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-logs'] }); setPage(0); toast('Email log cleared.', 'success'); },
    onError: (err) => toast(err?.response?.data?.message ?? 'Clear failed.', 'error'),
  });

  function setF(k, v) { setFilters(f => ({ ...f, [k]: v })); setPage(0); }

  /* CSV export */
  function exportCSV() {
    const header = ['Time','Recipient','Subject','Module','Event','Status','Error'];
    const rows   = logs.map(l => [
      l.sentAt ? new Date(l.sentAt).toLocaleString('en-GB') : '',
      l.recipient, l.subject, l.module ?? '', l.event ?? '', l.status, l.errorMsg ?? '',
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `email-log-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-control" style={{ width: 120, fontSize: 12 }} value={filters.status} onChange={e => setF('status', e.target.value)}>
          <option value="">All Status</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        <select className="form-control" style={{ width: 110, fontSize: 12 }} value={filters.module} onChange={e => setF('module', e.target.value)}>
          <option value="">All Modules</option>
          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" className="form-control" style={{ width: 140, fontSize: 12 }} value={filters.dateFrom} onChange={e => setF('dateFrom', e.target.value)} />
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>to</span>
        <input type="date" className="form-control" style={{ width: 140, fontSize: 12 }} value={filters.dateTo} onChange={e => setF('dateTo', e.target.value)} />
        {(filters.status || filters.module || filters.dateFrom || filters.dateTo) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilters({ status:'', module:'', dateFrom:'', dateTo:'' }); setPage(0); }}>Clear Filters</button>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{total} entries</span>
        <button className="btn btn-ghost btn-sm" onClick={() => refetch()}>↺ Refresh</button>
        <button className="btn btn-ghost btn-sm" disabled={logs.length === 0} onClick={exportCSV}>⬇ Export CSV</button>
        <button className="btn btn-ghost btn-sm" disabled={isClearing || total === 0}
          onClick={() => { if (confirm('Clear ALL email logs? This cannot be undone.')) clear(); }}>
          {isClearing ? 'Clearing…' : '🗑 Clear Log'}
        </button>
      </div>

      {/* ── Table ── */}
      {isLoading ? <p>Loading…</p> : (
        <div className="wip-table-wrap">
          <table className="wip-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Recipient</th>
                <th>Subject</th>
                <th style={{ width: 110 }}>Module / Event</th>
                <th style={{ width: 80 }}>Status</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={6} className="table-empty">No email logs match the current filters.</td></tr>}
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{log.sentAt ? new Date(log.sentAt).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}</td>
                  <td style={{ fontSize: 12 }}>{log.recipient}</td>
                  <td style={{ fontSize: 12 }}>{log.subject}</td>
                  <td style={{ fontSize: 11 }}>{log.module ? `${log.module} / ${log.event}` : '—'}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[log.status] ?? '#374151' }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: '#dc2626' }}>{log.errorMsg ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center', justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(0)}>«</button>
          <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Page {page + 1} of {pages} · {total} total</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>›</button>
          <button className="btn btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => setPage(pages - 1)}>»</button>
        </div>
      )}
    </div>
  );
}
