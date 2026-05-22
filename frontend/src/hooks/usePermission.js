import { useAuthStore } from '../store/authStore';

// Maps friendly action names to DB field names.
const ACTION_MAP = {
  view:   'canRead',
  read:   'canRead',
  create: 'canCreate',
  write:  'canWrite',
  delete: 'canDelete',
  report: 'canReport',
  // Also accept the DB field names directly
  canRead:   'canRead',
  canCreate: 'canCreate',
  canWrite:  'canWrite',
  canDelete: 'canDelete',
  canReport: 'canReport',
};

export function usePermission(module, action = 'canRead') {
  const permissions = useAuthStore((s) => s.permissions);
  const field = ACTION_MAP[action] ?? action;
  return permissions.some((p) => p.module === module && p[field] === true);
}

export function useRole() {
  const user = useAuthStore((s) => s.user);
  return user?.roleCode ?? null;
}

// Checks by stable roleCode, not the mutable roleName display string.
export function useIsAdmin() {
  const user = useAuthStore((s) => s.user);
  return user?.roleCode === 'ROLE-001';
}
