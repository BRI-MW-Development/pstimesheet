import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';

const YEAR = new Date().getFullYear();

function preview(prefix, digits) {
  const p = (prefix || '??').replace(/-+$/, '');
  return `${p}-${YEAR}-${String(1).padStart(digits ?? 5, '0')}`;
}

const DOCS = [
  { key: 'prodPrefix',       docType: 'PROD', label: 'Production Timesheet',    placeholder: 'TS-PROD' },
  { key: 'instPrefix',       docType: 'INST', label: 'Installation Timesheet',  placeholder: 'TS-INST' },
  { key: 'projTeamPrefix',   docType: 'PROJ', label: 'Projects Team Timesheet', placeholder: 'TS-PROJ' },
  { key: 'woCompletePrefix', docType: 'WOC',  label: 'WO Complete',             placeholder: 'WO-COMP' },
  { key: 'qcPrefix',         docType: 'QC',   label: 'Quality Control (QC)',    placeholder: 'QC'      },
];

export default function DocNumberingPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['doc-numbering'],
    queryFn: () => api.get('/timesheets/doc-numbering').then((r) => r.data),
  });

  const [form, setForm] = useState({
    prodPrefix:       'TS-PROD',
    instPrefix:       'TS-INST',
    projTeamPrefix:   'TS-PROJ',
    woCompletePrefix: 'WO-COMP',
    qcPrefix:         'QC',
    sequenceDigits:   5,
    yearReset:        'Annual (Jan 1)',
  });

  // currentNo per docType for display
  const [seqMap, setSeqMap] = useState({});

  useEffect(() => {
    if (!data) return;
    const rows = Array.isArray(data) ? data : [];
    const rowMap = {};
    rows.forEach((r) => { rowMap[r.docType] = r; });

    const map = {};
    DOCS.forEach(({ docType }) => { map[docType] = rowMap[docType]?.currentNo ?? 0; });
    setSeqMap(map);

    setForm((f) => ({
      ...f,
      prodPrefix:       rowMap['PROD']?.prefix        ?? f.prodPrefix,
      instPrefix:       rowMap['INST']?.prefix        ?? f.instPrefix,
      projTeamPrefix:   rowMap['PROJ']?.prefix        ?? f.projTeamPrefix,
      woCompletePrefix: rowMap['WOC']?.prefix          ?? f.woCompletePrefix,
      qcPrefix:         rowMap['QC']?.prefix           ?? f.qcPrefix,
      sequenceDigits:   rowMap['PROD']?.sequenceDigits ?? f.sequenceDigits,
    }));
  }, [data]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (payload) => {
      const digits = Number(payload.sequenceDigits) || 5;
      const rows = DOCS.map(({ key, docType }) => ({
        docType,
        prefix: (payload[key] || '').replace(/-+$/, ''),
        sequenceDigits: digits,
      }));
      return api.put('/timesheets/doc-numbering', { rows }).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doc-numbering'] });
      toast('Document numbering saved.', 'success');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  function set(field, val) { setForm((f) => ({ ...f, [field]: val })); }
  const digits = Number(form.sequenceDigits) || 5;

  if (isLoading) return <div className="page-content"><p>Loading…</p></div>;

  return (
    <div className="page-content">
      <div className="wip-list-header" style={{ marginBottom: 20 }}>
        <div className="wip-list-title">Document Numbering</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Settings */}
        <div className="card">
          <div className="card-head"><div className="card-title">Prefix Settings</div></div>
          <div className="card-body">
            {DOCS.map(({ key, docType, label, placeholder }) => (
              <div className="form-group" key={key}>
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{label}</span>
                  {seqMap[docType] !== undefined && (
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>
                      Last seq: <strong>{seqMap[docType]}</strong>
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={form[key]}
                  placeholder={placeholder}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
              <div className="form-group">
                <label>Sequence Digits</label>
                <select className="form-control" value={form.sequenceDigits}
                  onChange={(e) => set('sequenceDigits', parseInt(e.target.value))}>
                  <option value={4}>4 digits (0001)</option>
                  <option value={5}>5 digits (00001)</option>
                  <option value={6}>6 digits (000001)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Year Reset</label>
                <select className="form-control" value={form.yearReset}
                  onChange={(e) => set('yearReset', e.target.value)}>
                  <option>Annual (Jan 1)</option>
                  <option>Never</option>
                </select>
              </div>
            </div>

            <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }}
              disabled={isPending} onClick={() => save(form)}>
              {isPending ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="card">
          <div className="card-head"><div className="card-title">Preview — First document of {YEAR}</div></div>
          <div className="card-body">
            {DOCS.map(({ key, docType, label }, i) => (
              <div key={key} style={{ margin: i === 0 ? 0 : '12px 0 0' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>
                  {label}
                </div>
                <div className="doc-num-big">{preview(form[key] || '??', digits)}</div>
                {seqMap[docType] > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {seqMap[docType]} document{seqMap[docType] !== 1 ? 's' : ''} created this year
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
