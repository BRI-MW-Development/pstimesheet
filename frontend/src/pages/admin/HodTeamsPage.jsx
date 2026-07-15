import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function Avatar({ name, size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.36, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

export default function HodTeamsPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [selectedHod, setSelectedHod] = useState(null); // { employeeNo, firstName, lastname }
  const [search, setSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then(r => {
      // Deduplicate by employeeNo in case the API returns multiple rows per employee
      const seen = new Set();
      return r.data.filter(e => {
        if (seen.has(e.employeeNo)) return false;
        seen.add(e.employeeNo);
        return true;
      });
    }),
  });

  const { data: allMappings = [] } = useQuery({
    queryKey: ['hod-teams'],
    queryFn: () => api.get('/hod-teams').then(r => r.data),
  });

  const { data: teamCodes = [] } = useQuery({
    queryKey: ['hod-teams', selectedHod?.employeeNo],
    queryFn: () => api.get(`/hod-teams/${selectedHod.employeeNo}`).then(r => r.data),
    enabled: !!selectedHod,
  });

  const addMutation = useMutation({
    mutationFn: ({ hodCode, employeeCode }) => api.post('/hod-teams', { hodCode, employeeCode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hod-teams'] });
      toast.success('Member added');
    },
    onError: () => toast.error('Failed to add member'),
  });

  const removeMutation = useMutation({
    mutationFn: ({ hodCode, employeeCode }) => api.delete(`/hod-teams/${hodCode}/${employeeCode}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hod-teams'] });
      toast.success('Member removed');
    },
    onError: () => toast.error('Failed to remove member'),
  });

  const hodSet = new Set(allMappings.map(m => m.hodCode));

  // Deduplicate at the point of use in case the API/cache returns duplicate rows
  const uniqueEmployees = [...new Map(employees.map(e => [e.employeeNo, e])).values()];

  const filteredEmployees = uniqueEmployees.filter(e => {
    const name = `${e.firstName ?? ''} ${e.lastname ?? ''}`.toLowerCase();
    const code = (e.employeeNo ?? '').toLowerCase();
    return name.includes(search.toLowerCase()) || code.includes(search.toLowerCase());
  });

  const teamMembers = uniqueEmployees.filter(e => teamCodes.includes(e.employeeNo));
  const nonMembers  = uniqueEmployees.filter(e =>
    !teamCodes.includes(e.employeeNo) &&
    e.employeeNo !== selectedHod?.employeeNo
  );

  const filteredNonMembers = nonMembers.filter(e => {
    const name = `${e.firstName ?? ''} ${e.lastname ?? ''}`.toLowerCase();
    return name.includes(memberSearch.toLowerCase()) || (e.employeeNo ?? '').toLowerCase().includes(memberSearch.toLowerCase());
  });

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden' }}>

      {/* ── Left: HOD list ── */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border2)', display: 'flex', flexDirection: 'column', background: 'var(--surface2)' }}>
        <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>HOD / Supervisors</div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee…"
            style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredEmployees.map(emp => {
            const isHod      = hodSet.has(emp.employeeNo);
            const isSelected = selectedHod?.employeeNo === emp.employeeNo;
            return (
              <div key={emp.employeeNo}
                   onClick={() => { setSelectedHod(emp); setMemberSearch(''); }}
                   style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', background: isSelected ? 'var(--accent)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                <Avatar name={`${emp.firstName} ${emp.lastname}`} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#fff' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {emp.firstName} {emp.lastname}
                  </div>
                  <div style={{ fontSize: 10, color: isSelected ? 'rgba(255,255,255,0.75)' : 'var(--text3)' }}>{emp.employeeNo}</div>
                </div>
                {isHod && (
                  <span style={{ fontSize: 9, fontWeight: 700, background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--accent)', color: '#fff', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>HOD</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Team panel ── */}
      {!selectedHod ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Select an employee on the left to manage their team
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface2)', flexShrink: 0 }}>
            <Avatar name={`${selectedHod.firstName} ${selectedHod.lastname}`} size={36} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{selectedHod.firstName} {selectedHod.lastname}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{selectedHod.employeeNo} · {teamCodes.length} team member{teamCodes.length !== 1 ? 's' : ''}</div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* Current team members */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border2)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Current Team</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Click × to remove a member</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {teamMembers.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No members yet — add from the right panel</div>
                ) : teamMembers.map(emp => (
                  <div key={emp.employeeNo} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                    <Avatar name={`${emp.firstName} ${emp.lastname}`} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.firstName} {emp.lastname}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{emp.employeeNo}</div>
                    </div>
                    <button
                      onClick={() => removeMutation.mutate({ hodCode: selectedHod.employeeNo, employeeCode: emp.employeeNo })}
                      style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Available to add */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Add Members</div>
                <input
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Search to add…"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredNonMembers.map(emp => (
                  <div key={emp.employeeNo} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                    <Avatar name={`${emp.firstName} ${emp.lastname}`} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.firstName} {emp.lastname}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{emp.employeeNo}</div>
                    </div>
                    <button
                      onClick={() => addMutation.mutate({ hodCode: selectedHod.employeeNo, employeeCode: emp.employeeNo })}
                      style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700 }}>
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
