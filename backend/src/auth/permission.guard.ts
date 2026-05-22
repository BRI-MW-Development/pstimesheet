import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';
import { PERMISSION_KEY, RequiredPermission } from './permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DEV_SQL_POOL) private readonly pool: ConnectionPool,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<RequiredPermission>(PERMISSION_KEY, ctx.getHandler());
    if (!required) return true;

    const req      = ctx.switchToHttp().getRequest();
    const roleCode = req.currentUser?.roleCode;
    if (!roleCode) throw new ForbiddenException('No role assigned');

    const res = await this.pool.request()
      .input('roleCode', mssql.NVarChar(30), roleCode)
      .input('module',   mssql.NVarChar(50), required.module)
      .query<Record<string, boolean>>(`
        SELECT canCreate, canRead, canWrite, canDelete, canReport
        FROM   PSTsRolePermissions
        WHERE  roleCode = @roleCode AND module = @module
      `).catch(() => ({ recordset: [] as any[] }));

    const row = res.recordset[0];
    if (!row || !row[required.action])
      throw new ForbiddenException(`Requires ${required.module}.${required.action}`);

    return true;
  }
}
