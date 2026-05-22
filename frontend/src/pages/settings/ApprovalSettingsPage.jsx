import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import api from '../../api/client';
import Table, { WipListHeader } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';

/* ── Module config ─────────────────────────────────────────────── */
const MODULES = [
  { value: 'ALL',  label: 'All Modules' },
  { value: 'PROD', label: 'Production Timesheet' },
  { value: 'INST', label: 'Installation Timesheet' },
  { value: 'PROJ', label: 'Projects Team Timesheet' },
  { value: 'WO',   label: 'WO Complete' },
];

const MODULE_BADGE = {
  ALL:  { bg: '#f3f4f6', color: '#374151' },
  PROD: { bg: '#dbeafe', color: '#1d4ed8' },
  INST: { bg: '#fef9c3', color: '#92400e' },
  PROJ: { bg: '#dcfce7', color: '#166534' },
  WO:   { bg: '#ede9fe', color: '#6d28d9' },
};

function ModuleBadge({ module }) {
  const style = MODULE_BADGE[module] ?? MODULE_BADGE.ALL;
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, ...style }}>
      {MODULES.find((m) => m.value === module)?.label ?? module}
    </span>
  );
}

/* ── Criteria field definitions ────────────────────────────────── */
const CRITERIA_FIELDS = [
  {
    value: 'department',   label: 'Department',
    type: 'select',  source: 'departments',
    getOptions: (data) => (data || []).map((r) => ({ value: r.departmentCode, label: r.departmentCode })),
  },
  {
    value: 'employeeName', label: 'Employee Name',
    type: 'suggest', source: 'employees',
    getOptions: (data) => (data || []).map((r) => {
      const name = [r.firstName, r.lastname].filter(Boolean).join(' ');
      return { value: name, label: name };
    }),
  },
  {
    value: 'shift',        label: 'Shift',
    type: 'select',  source: 'shifts',
    getOptions: (data) => (data || []).map((r) => ({ value: r.shiftCode, label: r.shiftName || r.shiftCode })),
  },
  {
    value: 'projectNo',    label: 'Project No',
    type: 'select',  source: 'projects',
    getOptions: (data) => (data || []).map((r) => ({
      value: r.projectCode,
      label: r.projectName ? `${r.projectCode} – ${r.projectName}` : r.projectCode,
    })),
  },
  {
    value: 'workOrderNo',  label: 'Work Order No',
    type: 'select',  source: 'work-orders',
    getOptions: (data) => (data || []).map((r) => ({ value: r.workOrderNumber, label: r.workOrderNumber })),
  },
  { value: 'jobCode',     label: 'Job Code',    type: 'text'   },
  { value: 'totalHours',  label: 'Total Hours', type: 'number' },
];

const OPERATORS_SELECT  = ['equals', 'not equals'];
const OPERATORS_SUGGEST = ['equals', 'not equals', 'contains', 'starts with'];
const OPERATORS_TEXT    = ['equals', 'not equals', 'contains', 'does not contain', 'starts with'];
const OPERATORS_NUMBER  = ['equals', 'not equals', 'greater than', 'less than', 'greater or equal', 'less or equal'];

function getOperators(fieldDef) {
  if (!fieldDef) return OPERATORS_TEXT;
  if (fieldDef.type === 'number')  return OPERATORS_NUMBER;
  if (fieldDef.type === 'select')  return OPERATORS_SELECT;
  if (fieldDef.type === 'suggest') return OPERATORS_SUGGEST;
  return OPERATORS_TEXT;
}

/* ── Smart Value Input ─────────────────────────────────────────── */
function ValueInput({ fieldDef, value, onChange, refData }) {
  if (!fieldDef) {
    return <input className="form-control" style={{ fontSize: 13 }} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Value" disabled />;
  }
  if (fieldDef.type === 'number') {
    return <input className="form-control" style={{ fontSize: 13 }} type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Value" />;
  }
  if (fieldDef.type === 'select') {
    const options = fieldDef.getOptions(refData[fieldDef.source] || []);
    return (
      <select className="form-control" style={{ fontSize: 13 }} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- Select --</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (fieldDef.type === 'suggest') {
    const listId = `criteria-${fieldDef.value}-list`;
    const options = fieldDef.getOptions(refData[fieldDef.source] || []);
    return (
      <>
        <input className="form-control" style={{ fontSize: 13 }} type="text" list={listId}
          value={value} onChange={(e) => onChange(e.target.value)} placeholder="Type to search…" />
        <datalist id={listId}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </datalist>
      </>
    );
  }
  return <input className="form-control" style={{ fontSize: 13 }} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Value" />;
}

/* ── Criteria summary for list ─────────────────────────────────── */
function criteriaSummary(criteria) {
  if (!criteria?.length) return <em style={{ color: 'var(--text3)' }}>No criteria (always applies)</em>;
  const parts = criteria.filter((c) => c.field && c.value).map((c, i) => {
    const fieldLabel = CRITERIA_FIELDS.find((f) => f.value === c.field)?.label ?? c.field;
    return `${i + 1}. ${fieldLabel} ${c.operator} "${c.value}"`;
  });
  return parts.length ? parts.join(' / ') : <em style={{ color: 'var(--text3)' }}>No criteria</em>;
}

/* ── Criteria Builder ──────────────────────────────────────────── */
function CriteriaBuilder({ criteria, onChange, filterLogic, onFilterLogicChange, refData }) {
  function updateRow(idx, key, val) {
    const next = criteria.map((c, i) => {
      if (i !== idx) return c;
      const updated = { ...c, [key]: val };
      if (key === 'field') {
        const fd = CRITERIA_FIELDS.find((f) => f.value === val);
        const ops = getOperators(fd);
        if (!ops.includes(updated.operator)) updated.operator = ops[0];
        updated.value = '';
      }
      return updated;
    });
    onChange(next);
  }
  function addRow() { onChange([...criteria, { field: '', operator: 'equals', value: '' }]); }
  function removeRow(idx) {
    const next = criteria.filter((_, i) => i !== idx);
    onChange(next.length ? next : [{ field: '', operator: 'equals', value: '' }]);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 150px 1fr 28px', gap: 6, marginBottom: 4 }}>
        <span />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Field</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Operator</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Value</span>
        <span />
      </div>
      {criteria.map((c, idx) => {
        const fieldDef = CRITERIA_FIELDS.find((f) => f.value === c.field);
        const operators = getOperators(fieldDef);
        return (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 150px 1fr 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'right' }}>{idx + 1}.</span>
            <select className="form-control" style={{ fontSize: 13 }} value={c.field}
              onChange={(e) => updateRow(idx, 'field', e.target.value)}>
              <option value="">-- None --</option>
              {CRITERIA_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select className="form-control" style={{ fontSize: 13 }} value={c.operator}
              onChange={(e) => updateRow(idx, 'operator', e.target.value)} disabled={!c.field}>
              {operators.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
            <ValueInput fieldDef={fieldDef} value={c.value}
              onChange={(v) => updateRow(idx, 'value', v)} refData={refData} />
            <button type="button" onClick={() => removeRow(idx)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={addRow} style={{ fontSize: 12 }}>+ Add Row</button>
        {criteria.length > 1 && (
          <button type="button" className="btn btn-ghost btn-sm"
            onClick={() => onChange([{ field: '', operator: 'equals', value: '' }])} style={{ fontSize: 12 }}>
            Remove All
          </button>
        )}
      </div>
      {criteria.length >= 2 && (
        <div style={{ marginTop: 12 }}>
          <label className="form-label" style={{ fontSize: 12 }}>
            Filter Logic
            <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11, marginLeft: 6 }}>
              e.g. 1 AND 2, (1 AND 2) OR 3 — leave blank to AND all rows
            </span>
          </label>
          <input className="form-control" style={{ fontSize: 13 }} type="text"
            value={filterLogic} onChange={(e) => onFilterLogicChange(e.target.value)}
            placeholder="e.g. 1 AND 2 OR 3" />
        </div>
      )}
    </div>
  );
}

/* ── User Picker ───────────────────────────────────────────────── */
function UserPicker({ selected, onChange, users }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedIds = new Set(selected.map((u) => u.userId));
  const filtered = (users || []).filter((u) => {
    if (selectedIds.has(u.userId)) return false;
    const q = search.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  }).slice(0, 10);

  function addUser(u) {
    onChange([...selected, { userId: u.userId, displayName: u.displayName, email: u.email || '' }]);
    setSearch('');
  }
  function removeUser(userId) {
    onChange(selected.filter((u) => u.userId !== userId));
  }

  return (
    <div ref={ref}>
      {/* Selected chips */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selected.map((u) => (
            <div key={u.userId} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px 4px 10px', borderRadius: 20,
              background: 'var(--primary-light, #dbeafe)', border: '1px solid var(--primary, #3b82f6)',
              fontSize: 12,
            }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--primary, #1d4ed8)', lineHeight: 1.2 }}>{u.displayName}</div>
                <div style={{ color: 'var(--text3)', fontSize: 11, lineHeight: 1.2 }}>{u.email || '—'}</div>
              </div>
              <button type="button" onClick={() => removeUser(u.userId)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 14, padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <input
          className="form-control"
          type="text"
          value={search}
          placeholder="Search by name, username or email…"
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        {open && (search || filtered.length > 0) && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
            background: 'var(--bg1)', border: '1px solid var(--border)',
            borderRadius: 6, marginTop: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            maxHeight: 240, overflowY: 'auto',
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text3)' }}>
                {search ? 'No users found' : 'All users already selected'}
              </div>
            ) : filtered.map((u) => (
              <div key={u.userId}
                onMouseDown={(e) => { e.preventDefault(); addUser(u); setOpen(false); }}
                style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{u.displayName}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.email || u.username}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Reconstruct approvers array from saved comma-separated data ─ */
function resolveApprovers(row, users) {
  if (!row) return [];
  const userList = users || [];
  // Try to match by userId first (most reliable)
  if (row.approverUserIds) {
    const ids = row.approverUserIds.split(',').map((s) => s.trim()).filter(Boolean);
    const matched = ids.map((id) => userList.find((u) => u.userId === id)).filter(Boolean);
    if (matched.length > 0) return matched.map((u) => ({ userId: u.userId, displayName: u.displayName, email: u.email || '' }));
  }
  // Fall back to matching by displayName
  if (row.approverNames) {
    const names = row.approverNames.split(',').map((s) => s.trim()).filter(Boolean);
    const emails = (row.approverEmails || '').split(',').map((s) => s.trim());
    return names.map((name, i) => {
      const user = userList.find((u) => u.displayName === name || u.username === name);
      return {
        userId:      user?.userId      ?? `__${i}`,
        displayName: user?.displayName ?? name,
        email:       user?.email       ?? emails[i] ?? '',
      };
    });
  }
  return [];
}

/* ── Add / Edit Form ───────────────────────────────────────────── */
function ApprovalForm({ initial, onSave, onClose, saving }) {
  const isEdit = Boolean(initial?.id);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    staleTime: 60000,
  });

  const [form, setForm] = useState({
    module:      initial?.module      ?? 'PROD',
    criteria:    initial?.criteria?.length ? initial.criteria : [{ field: '', operator: 'equals', value: '' }],
    filterLogic: initial?.filterLogic ?? '',
    approvers:   [],   // populated via useEffect once users load
    anyApprover: initial?.anyApprover !== false,
  });

  // Populate approvers once users list is available
  useEffect(() => {
    if (!users.length) return;
    setForm((f) => ({ ...f, approvers: resolveApprovers(initial, users) }));
  }, [users]); // eslint-disable-line

  function set(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  function handleSave() {
    onSave({
      module:          form.module,
      criteria:        form.criteria,
      filterLogic:     form.filterLogic,
      approverUserIds: form.approvers.map((a) => a.userId).join(', '),
      approverNames:   form.approvers.map((a) => a.displayName).join(', '),
      approverEmails:  form.approvers.map((a) => a.email).join(', '),
      anyApprover:     form.anyApprover,
    });
  }

  // Fetch criteria reference data
  const deptQ  = useQuery({ queryKey: ['departments'],      queryFn: () => api.get('/departments').then((r) => r.data),              staleTime: 60000 });
  const empQ   = useQuery({ queryKey: ['employees'],        queryFn: () => api.get('/employees').then((r) => r.data),                staleTime: 60000 });
  const shiftQ = useQuery({ queryKey: ['shifts'],           queryFn: () => api.get('/system-settings/shifts').then((r) => r.data),   staleTime: 60000 });
  const projQ  = useQuery({ queryKey: ['projects'],         queryFn: () => api.get('/projects').then((r) => r.data),                 staleTime: 60000 });
  const woQ    = useQuery({ queryKey: ['work-orders'],      queryFn: () => api.get('/work-orders').then((r) => r.data),              staleTime: 60000 });

  const refData = {
    departments:   deptQ.data  ?? [],
    employees:     empQ.data   ?? [],
    shifts:        shiftQ.data ?? [],
    projects:      projQ.data  ?? [],
    'work-orders': woQ.data    ?? [],
  };

  const hasApprover = form.approvers.length > 0;

  return (
    <Modal title={isEdit ? 'Edit Approval Rule' : 'Add Approval Rule'} onClose={onClose} size="lg">
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>

        {/* Module */}
        <div className="form-group">
          <label className="form-label">Module <span className="required">*</span></label>
          <select className="form-control" value={form.module} onChange={(e) => set('module', e.target.value)}>
            {MODULES.filter((m) => m.value !== 'ALL').map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Entry Criteria */}
        <div className="form-group">
          <label className="form-label" style={{ marginBottom: 8 }}>
            Entry Criteria
            <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11, marginLeft: 6 }}>
              rule applies only when all conditions match — leave blank to apply globally
            </span>
          </label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px', background: 'var(--bg2)' }}>
            <CriteriaBuilder
              criteria={form.criteria}
              onChange={(v) => set('criteria', v)}
              filterLogic={form.filterLogic}
              onFilterLogicChange={(v) => set('filterLogic', v)}
              refData={refData}
            />
          </div>
        </div>

        {/* Approvers — user picker */}
        <div className="form-group">
          <label className="form-label">
            Approver(s) <span className="required">*</span>
            <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11, marginLeft: 6 }}>
              linked from user access — name &amp; email auto-filled
            </span>
          </label>
          <UserPicker
            selected={form.approvers}
            onChange={(v) => set('approvers', v)}
            users={users}
          />
          {!hasApprover && (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>Select at least one approver.</div>
          )}
        </div>

        {/* Approval Logic */}
        <div className="form-group" style={{ marginTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" style={{ marginTop: 2 }} checked={form.anyApprover}
              onChange={(e) => set('anyApprover', e.target.checked)} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Any one approver is sufficient</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                If enabled, approval by any one person is sufficient. If disabled, all must approve.
              </div>
            </div>
          </label>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !hasApprover}>
            {saving ? 'Saving…' : 'Save Rule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── View Modal ────────────────────────────────────────────────── */
function ApprovalViewModal({ row, onClose, onEdit }) {
  const activeCriteria = (row.criteria || []).filter((c) => c.field && c.value);

  const names  = (row.approverNames  || '').split(',').map((s) => s.trim()).filter(Boolean);
  const emails = (row.approverEmails || '').split(',').map((s) => s.trim()).filter(Boolean);
  const approvers = names.map((name, i) => ({ name, email: emails[i] || '' }));

  const moduleLabel = MODULES.find((m) => m.value === row.module)?.label ?? row.module;

  return (
    <Modal title="Approval Rule" onClose={onClose} size="lg">
      <div className="modal-banner">
        <div>
          <div className="modal-banner-title">{moduleLabel}</div>
          <div className="modal-banner-sub">
            {approvers.length > 0
              ? approvers.map((a) => a.name).join(', ')
              : 'No approvers assigned'}
          </div>
        </div>
        <div className="modal-banner-right">
          <Badge variant={row.anyApprover ? 'active' : 'info'}>
            {row.anyApprover ? 'Any one' : 'All must'}
          </Badge>
          <ModuleBadge module={row.module} />
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-row"><span>Module</span><ModuleBadge module={row.module} /></div>
        <div className="detail-row">
          <span>Entry Criteria</span>
          <div style={{ textAlign: 'right' }}>
            {activeCriteria.length === 0
              ? <em style={{ color: 'var(--text3)' }}>No criteria — applies globally</em>
              : activeCriteria.map((c, i) => {
                  const fieldLabel = CRITERIA_FIELDS.find((f) => f.value === c.field)?.label ?? c.field;
                  return (
                    <div key={i} style={{ fontSize: 13 }}>
                      <strong>{i + 1}.</strong> {fieldLabel} <em>{c.operator}</em> &ldquo;{c.value}&rdquo;
                    </div>
                  );
                })
            }
            {row.filterLogic && activeCriteria.length >= 2 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Logic: {row.filterLogic}</div>
            )}
          </div>
        </div>
        <div className="detail-row">
          <span>Approver(s)</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            {approvers.length === 0
              ? <span>—</span>
              : approvers.map((a, i) => (
                  <div key={i} style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{a.name}</div>
                    {a.email && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.email}</div>}
                  </div>
                ))
            }
          </div>
        </div>
        <div className="detail-row">
          <span>Approval Logic</span>
          <span>{row.anyApprover ? 'Any one approver is sufficient' : 'All approvers must approve'}</span>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        <button type="button" className="btn btn-primary" onClick={() => { onClose(); onEdit(row); }}>Edit</button>
      </div>
    </Modal>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */
export default function ApprovalSettingsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch]   = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['approval-settings'],
    queryFn: () => api.get('/approval-settings').then((r) => r.data),
  });

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload) =>
      payload.id
        ? api.put(`/approval-settings/${payload.id}`, payload).then((r) => r.data)
        : api.post('/approval-settings', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-settings'] });
      toast(editing?.id ? 'Rule updated.' : 'Rule created.', 'success');
      setEditing(null);
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  const { mutate: deleteRow } = useMutation({
    mutationFn: (id) => api.delete(`/approval-settings/${id}`).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['approval-settings'] }); toast('Rule deleted.', 'success'); },
    onError: (err) => toast(err?.response?.data?.message ?? 'Delete failed.', 'error'),
  });

  const BLANK_FORM = {
    module: 'PROD',
    criteria: [{ field: '', operator: 'equals', value: '' }],
    filterLogic: '',
    approverUserIds: '', approverNames: '', approverEmails: '',
    anyApprover: true,
  };

  const filtered = rows.filter((r) =>
    !search ||
    r.approverNames?.toLowerCase().includes(search.toLowerCase()) ||
    MODULES.find((m) => m.value === r.module)?.label.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: '#', label: '#', num: true, sort: false, render: (_, i) => i + 1 },
    { key: 'module', label: 'Module', sort: true, render: (r) => <ModuleBadge module={r.module} /> },
    {
      key: 'criteria', label: 'Entry Criteria', sort: false,
      render: (r) => (
        <div style={{ fontSize: 12, maxWidth: 300, whiteSpace: 'normal', lineHeight: 1.5 }}>
          {criteriaSummary(r.criteria)}
        </div>
      ),
    },
    {
      key: 'approverNames', label: 'Approvers', sort: true,
      render: (r) => {
        const names = (r.approverNames || '').split(',').map((s) => s.trim()).filter(Boolean);
        if (!names.length) return <span style={{ color: 'var(--text3)' }}>—</span>;
        return (
          <div style={{ fontSize: 12 }}>
            {names.map((n, i) => <div key={i}>{n}</div>)}
          </div>
        );
      },
    },
    {
      key: 'anyApprover', label: 'Logic', sort: true,
      render: (r) => <Badge variant={r.anyApprover ? 'active' : 'info'}>{r.anyApprover ? 'Any one' : 'All must'}</Badge>,
    },
    {
      key: 'actions', label: '', sort: false,
      render: (row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="wip-icon-btn wip-icon-btn-view" title="View" onClick={() => setViewing(row)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button className="wip-icon-btn wip-icon-btn-edit" title="Edit" onClick={() => setEditing(row)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button className="wip-icon-btn wip-icon-btn-delete" title="Delete"
            onClick={() => { if (confirm('Delete this approval rule?')) deleteRow(row.id); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-content">
      <WipListHeader
        title="Approval Settings"
        count={filtered.length}
        search={search}
        onSearch={setSearch}
        actions={<button className="btn btn-primary btn-sm" onClick={() => setEditing(BLANK_FORM)}>+ Add Rule</button>}
      />
      <Table columns={columns} data={filtered} loading={isLoading} emptyText="No approval rules configured." />

      {viewing && <ApprovalViewModal row={viewing} onClose={() => setViewing(null)} onEdit={setEditing} />}
      {editing && (
        <ApprovalForm
          initial={editing}
          onSave={(payload) => save(editing.id ? { ...payload, id: editing.id } : payload)}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
