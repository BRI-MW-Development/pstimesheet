import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../store/authStore';

const NOTIF_TYPES = [
  {
    key:         'pending_approvals',
    label:       'Pending Approvals',
    description: 'Timesheets waiting for your approval — shows a digest when more than 3, highlights overdue ones.',
    audience:    'Managers / Approvers',
    privileged:  true,
  },
  {
    key:         'ts_approved',
    label:       'Timesheet Approved',
    description: 'Alert when one of your submitted timesheets gets approved.',
    audience:    'All users',
    privileged:  false,
  },
  {
    key:         'ts_rejected',
    label:       'Timesheet Rejected',
    description: 'Alert when one of your submitted timesheets is rejected, with the rejection reason.',
    audience:    'All users',
    privileged:  false,
  },
  {
    key:         'forgotten_drafts',
    label:       'Forgotten Drafts',
    description: 'Reminder when you have draft timesheets sitting unsubmitted for more than 2 days.',
    audience:    'All users',
    privileged:  false,
  },
  {
    key:         'qc_status',
    label:       'QC Result',
    description: 'Notification when a QC record you are the inspector for passes or fails (last 7 days).',
    audience:    'Inspectors / Privileged',
    privileged:  false,
  },
  {
    key:         'qc_woc_eligible',
    label:       'WO Ready for Completion',
    description: 'Alert when a Work Order has a completed Full QC inspection but no WO Complete record yet.',
    audience:    'Managers / Approvers',
    privileged:  true,
  },
  {
    key:         'woc_conflict',
    label:       'WO Completion Conflict',
    description: 'Warning when a WO is marked complete but related timesheets are still in Draft or Submitted.',
    audience:    'Managers / Approvers',
    privileged:  true,
  },
  {
    key:         'woc_new',
    label:       'New WO Complete',
    description: 'Notification when a new WO Complete record is created (last 7 days).',
    audience:    'Managers / Approvers',
    privileged:  true,
  },
  {
    key:         'login_failures',
    label:       'Failed Login Alert',
    description: 'Security alert when 5 or more failed login attempts occur within the last hour.',
    audience:    'Admins only',
    privileged:  true,
  },
];

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        position:        'relative',
        display:         'inline-flex',
        alignItems:      'center',
        width:           44,
        height:          24,
        borderRadius:    12,
        border:          'none',
        cursor:          disabled ? 'default' : 'pointer',
        background:      checked ? 'var(--accent, #2563eb)' : 'var(--border2, #cbd5e1)',
        transition:      'background 0.2s',
        flexShrink:      0,
        opacity:         disabled ? 0.5 : 1,
        padding:         0,
      }}
    >
      <span style={{
        position:   'absolute',
        left:       checked ? 22 : 2,
        width:      20,
        height:     20,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow:  '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const toast        = useToast();
  const queryClient  = useQueryClient();
  const user         = useAuthStore((s) => s.user);
  const code         = ((user?.roleCode ?? '')).toUpperCase();
  const isPrivileged = code.includes('ADMIN') || code.includes('MANAGER') || code.includes('APPROVER');

  const { data: savedPrefs, isLoading } = useQuery({
    queryKey: ['notif-preferences'],
    queryFn:  () => api.get('/notifications/preferences').then((r) => r.data),
  });

  const [local, setLocal] = useState(null);

  // Sync server prefs into local state once loaded
  useEffect(() => {
    if (savedPrefs && !local) setLocal(savedPrefs);
  }, [savedPrefs]);

  const isDirty = local && savedPrefs &&
    NOTIF_TYPES.some((t) => local[t.key] !== savedPrefs[t.key]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (payload) => api.patch('/notifications/preferences', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notif-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast('Notification preferences saved.', 'success');
    },
    onError: (err) => toast(err?.response?.data?.message ?? 'Save failed.', 'error'),
  });

  function toggle(key, val) {
    setLocal((prev) => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    save(local);
  }

  function handleReset() {
    setLocal(savedPrefs ? { ...savedPrefs } : null);
  }

  const prefs = local ?? savedPrefs ?? {};

  if (isLoading) return <div className="page-content"><p>Loading…</p></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Notification Settings</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleReset} disabled={!isDirty || isPending}>
            Reset
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!isDirty || isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Choose which notifications appear in your notification panel. Some types are only shown to privileged roles even when enabled.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NOTIF_TYPES.map((t) => {
          const applicable = !t.privileged || isPrivileged;
          const enabled    = prefs[t.key] !== false;
          return (
            <div key={t.key} style={{
              display:        'flex',
              alignItems:     'center',
              gap:            16,
              padding:        '14px 16px',
              background:     'var(--surface)',
              border:         '1px solid var(--border)',
              borderRadius:   8,
            }}>
              {/* Toggle */}
              <Toggle
                checked={enabled}
                onChange={(v) => toggle(t.key, v)}
                disabled={false}
              />

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{t.label}</span>
                  <span style={{
                    fontSize: 11, padding: '1px 7px', borderRadius: 10,
                    background: t.privileged ? 'var(--warning-bg, #fef3c7)' : 'var(--surface2, #f1f5f9)',
                    color:      t.privileged ? 'var(--warning-text, #92400e)' : 'var(--text2)',
                    fontWeight: 500,
                  }}>
                    {t.audience}
                  </span>
                  {!applicable && (
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
                      Not applicable to your role
                    </span>
                  )}
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                  {t.description}
                </p>
              </div>

              {/* State label */}
              <span style={{
                fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: 'right',
                color: enabled && applicable ? 'var(--accent, #2563eb)' : 'var(--text3, #94a3b8)',
              }}>
                {enabled ? 'On' : 'Off'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
