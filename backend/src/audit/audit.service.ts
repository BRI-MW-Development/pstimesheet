import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';

export interface AuditEntry {
  docType: string;
  docRef: string;
  action: string;
  performedBy?: string;
  performedByName?: string;
  details?: string;
}

export interface AuditRow {
  id: number;
  loggedAt: string;
  docType: string;
  docRef: string;
  action: string;
  performedBy: string | null;
  performedByName: string | null;
  details: string | null;
}

interface QueryFilters {
  docType?: string;
  action?: string;
  performedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DEV_SQL_POOL) private readonly pool: ConnectionPool) {}

  async onModuleInit() {
    try {
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='PSTsAuditLog' AND xtype='U')
        CREATE TABLE PSTsAuditLog (
          id              BIGINT IDENTITY(1,1) PRIMARY KEY,
          loggedAt        DATETIME2 NOT NULL DEFAULT GETDATE(),
          docType         NVARCHAR(30)  NOT NULL,
          docRef          NVARCHAR(100) NOT NULL,
          action          NVARCHAR(20)  NOT NULL,
          performedBy     NVARCHAR(30)  NULL,
          performedByName NVARCHAR(100) NULL,
          details         NVARCHAR(500) NULL
        )
      `);
    } catch (err) {
      this.logger.warn(`Schema init skipped (will retry on next request): ${(err as Error)?.message}`);
    }
  }

  diff(oldObj: Record<string, any>, newBody: Record<string, any>, fields: string[]): string {
    const changes = fields
      .filter(f => newBody[f] !== undefined && newBody[f] !== null && String(newBody[f]).trim() !== String(oldObj[f] ?? '').trim())
      .map(f => `${f}: "${oldObj[f] ?? ''}" → "${newBody[f]}"`);
    return changes.length ? changes.join(' | ') : 'No changes';
  }

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.pool.request()
        .input('docType',         mssql.NVarChar(30),  entry.docType)
        .input('docRef',          mssql.NVarChar(100), entry.docRef)
        .input('action',          mssql.NVarChar(20),  entry.action)
        .input('performedBy',     mssql.NVarChar(30),  entry.performedBy     || null)
        .input('performedByName', mssql.NVarChar(100), entry.performedByName || null)
        .input('details',         mssql.NVarChar(500), entry.details         || null)
        .query(`
          INSERT INTO PSTsAuditLog (docType, docRef, action, performedBy, performedByName, details)
          VALUES (@docType, @docRef, @action, @performedBy, @performedByName, @details)
        `);
    } catch (err) { this.logger.warn(`Audit log failed: ${(err as Error)?.message}`); }
  }

  private addFilters(req: ReturnType<ConnectionPool['request']>, filters: QueryFilters): string {
    const conds: string[] = [];
    if (filters.docType) { conds.push('docType = @docType'); req.input('docType', mssql.NVarChar(30), filters.docType); }
    if (filters.action)  { conds.push('action = @action');   req.input('action',  mssql.NVarChar(20), filters.action); }
    if (filters.performedBy) { conds.push('performedBy = @performedBy'); req.input('performedBy', mssql.NVarChar(30), filters.performedBy); }
    if (filters.dateFrom) { conds.push('loggedAt >= @dateFrom'); req.input('dateFrom', mssql.NVarChar(30), filters.dateFrom); }
    if (filters.dateTo)   { conds.push('loggedAt < DATEADD(day,1,CAST(@dateTo AS DATE))'); req.input('dateTo', mssql.NVarChar(30), filters.dateTo); }
    if (filters.search)   { conds.push('(docRef LIKE @search OR performedByName LIKE @search OR details LIKE @search)'); req.input('search', mssql.NVarChar(110), `%${filters.search}%`); }
    return conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  }

  async query(filters: QueryFilters): Promise<{ rows: AuditRow[]; total: number }> {
    const limit  = Math.min(Math.max(1, Math.floor(Number(filters.limit  ?? 200))), 500);
    const offset = Math.max(0, Math.floor(Number(filters.offset ?? 0)));

    const dataReq  = this.pool.request();
    const countReq = this.pool.request();
    const where = this.addFilters(dataReq, filters);
    this.addFilters(countReq, filters);

    const [dataRes, countRes] = await Promise.all([
      dataReq.query<AuditRow>(`
        SELECT id, CONVERT(VARCHAR(24), loggedAt, 126) AS loggedAt,
               docType, docRef, action, performedBy, performedByName, details
        FROM   PSTsAuditLog ${where}
        ORDER  BY loggedAt DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `),
      countReq.query<{ total: number }>(`
        SELECT COUNT(*) AS total FROM PSTsAuditLog ${where}
      `).catch(() => ({ recordset: [{ total: 0 }] })),
    ]);

    return { rows: dataRes.recordset, total: countRes.recordset[0]?.total ?? 0 };
  }
}
