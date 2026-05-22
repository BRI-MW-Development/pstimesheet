import { SetMetadata } from '@nestjs/common';

export interface RequiredPermission {
  module: string;
  action: 'canCreate' | 'canRead' | 'canWrite' | 'canDelete' | 'canReport';
}

export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (module: string, action: RequiredPermission['action']) =>
  SetMetadata(PERMISSION_KEY, { module, action });
