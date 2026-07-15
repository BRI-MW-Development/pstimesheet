import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';

export interface Role {
  roleCode: string;
  roleName: string;
  description: string | null;
  deptScope: string;
  dataScope: string;
  status: string;
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  module: string;
  canCreate: boolean;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canReport: boolean;
  canApprove: boolean;
}

export interface RoleUser {
  userId: string;
  username: string;
  displayName: string;
  email: string | null;
  status: string;
  employeeCode: string | null;
  lastLoginAt: string | null;
}

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);
  private schemaReady = false;

  constructor(@Inject(DEV_SQL_POOL) private readonly pool: ConnectionPool) {}

  async onModuleInit() {
    await this.ensureSchema();
  }

  private async ensureSchema() {
    if (this.schemaReady) return;
    try {
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsRoles') AND name='dataScope')
          ALTER TABLE PSTsRoles ADD dataScope NVARCHAR(10) NOT NULL DEFAULT 'All';
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsRoles') AND name='description')
          ALTER TABLE PSTsRoles ADD description NVARCHAR(500) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsRolePermissions') AND name='canApprove')
          ALTER TABLE PSTsRolePermissions ADD canApprove BIT NOT NULL DEFAULT 0;
      `);
      this.schemaReady = true;
    } catch (err) {
      this.logger.warn(`Schema migration failed: ${(err as Error)?.message}`);
    }
  }

  async findAll(): Promise<Role[]> {
    await this.ensureSchema();
    const res = await this.pool.request().query<Role>(`
      SELECT r.roleCode, r.roleName, r.description, r.deptScope, ISNULL(r.dataScope,'All') AS dataScope, r.status,
             (SELECT COUNT(*) FROM PSTsUsers u WHERE u.roleCode = r.roleCode) AS userCount,
             CONVERT(VARCHAR(24), r.createdAt, 126) AS createdAt,
             CONVERT(VARCHAR(24), r.updatedAt, 126) AS updatedAt
      FROM   PSTsRoles r ORDER BY r.roleCode
    `);
    return res.recordset;
  }

  async findOne(roleCode: string): Promise<Role> {
    const res = await this.pool.request()
      .input('roleCode', mssql.NVarChar(30), roleCode)
      .query<Role>(`
        SELECT r.roleCode, r.roleName, r.description, r.deptScope, ISNULL(r.dataScope,'All') AS dataScope, r.status,
               (SELECT COUNT(*) FROM PSTsUsers u WHERE u.roleCode = r.roleCode) AS userCount,
               CONVERT(VARCHAR(24), r.createdAt, 126) AS createdAt,
               CONVERT(VARCHAR(24), r.updatedAt, 126) AS updatedAt
        FROM   PSTsRoles r WHERE r.roleCode = @roleCode
      `);
    if (!res.recordset[0]) throw new NotFoundException(`Role '${roleCode}' not found`);
    return res.recordset[0];
  }

  async getPermissions(roleCode: string): Promise<RolePermission[]> {
    await this.findOne(roleCode);
    const res = await this.pool.request()
      .input('roleCode', mssql.NVarChar(30), roleCode)
      .query<RolePermission>(`
        SELECT module, canCreate, canRead, canWrite, canDelete, canReport,
               ISNULL(canApprove, 0) AS canApprove
        FROM   PSTsRolePermissions WHERE roleCode = @roleCode ORDER BY module
      `);
    return res.recordset;
  }

  async getUsersForRole(roleCode: string): Promise<RoleUser[]> {
    const res = await this.pool.request()
      .input('roleCode', mssql.NVarChar(30), roleCode)
      .query<RoleUser>(`
        SELECT u.userId, u.username, u.displayName, u.email, u.status, u.employeeCode,
               CONVERT(VARCHAR(24), ll.attemptAt, 126) AS lastLoginAt
        FROM   PSTsUsers u
        OUTER APPLY (
          SELECT TOP 1 l.attemptAt FROM PSTsLoginHistory l
          WHERE l.userId = u.userId AND l.success = 1
          ORDER BY l.attemptAt DESC
        ) ll
        WHERE  u.roleCode = @roleCode
        ORDER  BY u.displayName
      `);
    return res.recordset;
  }

  async getHistory(roleCode: string): Promise<any[]> {
    const res = await this.pool.request()
      .input('roleCode', mssql.NVarChar(30), roleCode)
      .query(`
        SELECT TOP 50 id, action, performedByName, details,
               CONVERT(VARCHAR(24), loggedAt, 126) AS createdAt
        FROM   PSTsAuditLog
        WHERE  docType = 'ROLE' AND docRef = @roleCode
        ORDER  BY loggedAt DESC
      `);
    return res.recordset;
  }

  async nextRoleCode(): Promise<string> {
    const res = await this.pool.request().query<{ maxNo: number }>(`
      SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(roleCode, 6, LEN(roleCode)) AS INT)), 0) AS maxNo
      FROM PSTsRoles WHERE roleCode LIKE 'ROLE-%'
    `);
    const next = (res.recordset[0]?.maxNo ?? 0) + 1;
    return `ROLE-${String(next).padStart(3, '0')}`;
  }

  async create(body: { roleName: string; description?: string; deptScope?: string; dataScope?: string; status?: string }): Promise<Role> {
    if (!body.roleName?.trim()) throw new BadRequestException('roleName is required');
    const roleCode = await this.nextRoleCode();

    try {
      await this.pool.request()
        .input('roleCode',    mssql.NVarChar(30),  roleCode)
        .input('roleName',    mssql.NVarChar(100), body.roleName.trim())
        .input('description', mssql.NVarChar(500), body.description?.trim() || null)
        .input('deptScope',   mssql.NVarChar(30),  body.deptScope  || 'All')
        .input('dataScope',   mssql.NVarChar(10),  body.dataScope  || 'All')
        .input('status',      mssql.NVarChar(10),  body.status     || 'Active')
        .query(`
          INSERT INTO PSTsRoles (roleCode, roleName, description, deptScope, dataScope, status)
          VALUES (@roleCode, @roleName, @description, @deptScope, @dataScope, @status)
        `);
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601)
        throw new BadRequestException(`Role '${roleCode}' already exists`);
      throw err;
    }
    return this.findOne(roleCode);
  }

  async update(roleCode: string, body: { roleName?: string; description?: string; deptScope?: string; dataScope?: string; status?: string }): Promise<Role> {
    const existing = await this.findOne(roleCode);

    await this.pool.request()
      .input('roleCode',    mssql.NVarChar(30),  existing.roleCode)
      .input('roleName',    mssql.NVarChar(100), body.roleName?.trim()  ?? existing.roleName)
      .input('description', mssql.NVarChar(500), body.description !== undefined ? (body.description?.trim() || null) : existing.description)
      .input('deptScope',   mssql.NVarChar(30),  body.deptScope         ?? existing.deptScope)
      .input('dataScope',   mssql.NVarChar(10),  body.dataScope         ?? existing.dataScope)
      .input('status',      mssql.NVarChar(10),  body.status            ?? existing.status)
      .query(`
        UPDATE PSTsRoles
        SET    roleName = @roleName, description = @description, deptScope = @deptScope,
               dataScope = @dataScope, status = @status, updatedAt = GETDATE()
        WHERE  roleCode = @roleCode
      `);
    return this.findOne(roleCode);
  }

  async clone(sourceRoleCode: string): Promise<Role> {
    const source = await this.findOne(sourceRoleCode);
    const perms  = await this.getPermissions(sourceRoleCode);
    const newCode = await this.nextRoleCode();

    await this.pool.request()
      .input('roleCode',    mssql.NVarChar(30),  newCode)
      .input('roleName',    mssql.NVarChar(100), `Copy of ${source.roleName}`)
      .input('description', mssql.NVarChar(500), source.description ?? null)
      .input('deptScope',   mssql.NVarChar(30),  source.deptScope || 'All')
      .input('dataScope',   mssql.NVarChar(10),  source.dataScope || 'All')
      .input('status',      mssql.NVarChar(10),  'Active')
      .query(`
        INSERT INTO PSTsRoles (roleCode, roleName, description, deptScope, dataScope, status)
        VALUES (@roleCode, @roleName, @description, @deptScope, @dataScope, @status)
      `);

    if (perms.length > 0) {
      await this.savePermissions(newCode, perms);
    }
    return this.findOne(newCode);
  }

  async savePermissions(roleCode: string, permissions: RolePermission[]): Promise<void> {
    await this.findOne(roleCode);
    const tx = this.pool.transaction();
    await tx.begin();
    try {
      for (const p of permissions) {
        await tx.request()
          .input('roleCode',   mssql.NVarChar(30), roleCode)
          .input('module',     mssql.NVarChar(50), p.module)
          .input('canCreate',  mssql.Bit,          p.canCreate  ? 1 : 0)
          .input('canRead',    mssql.Bit,          p.canRead    ? 1 : 0)
          .input('canWrite',   mssql.Bit,          p.canWrite   ? 1 : 0)
          .input('canDelete',  mssql.Bit,          p.canDelete  ? 1 : 0)
          .input('canReport',  mssql.Bit,          p.canReport  ? 1 : 0)
          .input('canApprove', mssql.Bit,          p.canApprove ? 1 : 0)
          .query(`
            MERGE PSTsRolePermissions AS target
            USING (SELECT @roleCode AS roleCode, @module AS module) AS src
              ON target.roleCode = src.roleCode AND target.module = src.module
            WHEN MATCHED THEN
              UPDATE SET canCreate=@canCreate, canRead=@canRead, canWrite=@canWrite,
                         canDelete=@canDelete, canReport=@canReport, canApprove=@canApprove
            WHEN NOT MATCHED THEN
              INSERT (roleCode, module, canCreate, canRead, canWrite, canDelete, canReport, canApprove)
              VALUES (@roleCode, @module, @canCreate, @canRead, @canWrite, @canDelete, @canReport, @canApprove);
          `);
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  async remove(roleCode: string): Promise<{ message: string }> {
    await this.findOne(roleCode);
    const users = await this.pool.request()
      .input('roleCode', mssql.NVarChar(30), roleCode)
      .query<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM PSTsUsers WHERE roleCode = @roleCode`);
    if (users.recordset[0]?.cnt > 0)
      throw new BadRequestException(`Cannot delete role with ${users.recordset[0].cnt} assigned user(s)`);

    await this.pool.request()
      .input('roleCode', mssql.NVarChar(30), roleCode)
      .query(`DELETE FROM PSTsRolePermissions WHERE roleCode = @roleCode`);
    await this.pool.request()
      .input('roleCode', mssql.NVarChar(30), roleCode)
      .query(`DELETE FROM PSTsRoles WHERE roleCode = @roleCode`);
    return { message: `Role '${roleCode}' deleted` };
  }
}
