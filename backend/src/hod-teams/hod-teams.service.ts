import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';

const CACHE_TTL_MS = 60_000; // 60 seconds

@Injectable()
export class HodTeamsService implements OnModuleInit {
  private readonly logger = new Logger(HodTeamsService.name);

  // In-memory cache: hodCode → { codes, expiresAt }
  private readonly teamCache = new Map<string, { codes: string[]; expiresAt: number }>();

  constructor(
    @Inject(DEV_SQL_POOL) private readonly devPool: ConnectionPool,
  ) {}

  async onModuleInit() {
    try {
      await this.devPool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PSHodTeamMembers')
        CREATE TABLE PSHodTeamMembers (
          id            INT           IDENTITY(1,1) PRIMARY KEY,
          hodCode       NVARCHAR(30)  NOT NULL,
          employeeCode  NVARCHAR(30)  NOT NULL,
          createdAt     DATETIME      NOT NULL DEFAULT GETDATE(),
          CONSTRAINT UQ_HodTeamMembers UNIQUE (hodCode, employeeCode)
        )
      `);
      this.logger.log('PSHodTeamMembers table ready');
    } catch (err) {
      this.logger.warn(`Schema init skipped: ${(err as Error)?.message}`);
    }
  }

  async getAll(): Promise<any[]> {
    const result = await this.devPool.request().query(`
      SELECT hodCode, employeeCode, createdAt FROM PSHodTeamMembers ORDER BY hodCode, employeeCode
    `);
    return result.recordset;
  }

  async getTeamByHod(hodCode: string): Promise<string[]> {
    if (!hodCode) return [];

    const cached = this.teamCache.get(hodCode);
    if (cached && cached.expiresAt > Date.now()) return cached.codes;

    const req = this.devPool.request();
    req.input('hodCode', mssql.NVarChar(30), hodCode);
    const result = await req.query(`
      SELECT employeeCode FROM PSHodTeamMembers WHERE hodCode = @hodCode
    `);
    const codes = result.recordset.map((r: any) => r.employeeCode);
    this.teamCache.set(hodCode, { codes, expiresAt: Date.now() + CACHE_TTL_MS });
    return codes;
  }

  private invalidateCache(hodCode: string) {
    this.teamCache.delete(hodCode);
  }

  async addMember(hodCode: string, employeeCode: string): Promise<void> {
    const req = this.devPool.request();
    req.input('hodCode',      mssql.NVarChar(30), hodCode);
    req.input('employeeCode', mssql.NVarChar(30), employeeCode);
    await req.query(`
      IF NOT EXISTS (SELECT 1 FROM PSHodTeamMembers WHERE hodCode = @hodCode AND employeeCode = @employeeCode)
        INSERT INTO PSHodTeamMembers (hodCode, employeeCode) VALUES (@hodCode, @employeeCode)
    `);
    this.invalidateCache(hodCode);
  }

  async removeMember(hodCode: string, employeeCode: string): Promise<void> {
    const req = this.devPool.request();
    req.input('hodCode',      mssql.NVarChar(30), hodCode);
    req.input('employeeCode', mssql.NVarChar(30), employeeCode);
    await req.query(`
      DELETE FROM PSHodTeamMembers WHERE hodCode = @hodCode AND employeeCode = @employeeCode
    `);
    this.invalidateCache(hodCode);
  }
}
