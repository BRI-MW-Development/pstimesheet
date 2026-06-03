import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject(DEV_SQL_POOL) private readonly pool: ConnectionPool) {}

  async onModuleInit() {
    try {
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='PsNotifSeen' AND xtype='U')
        CREATE TABLE PsNotifSeen (
          id       BIGINT IDENTITY(1,1) PRIMARY KEY,
          userId   NVARCHAR(30)  NOT NULL,
          notifKey NVARCHAR(100) NOT NULL,
          seenAt   DATETIME2 DEFAULT SYSUTCDATETIME(),
          CONSTRAINT UQ_PsNotifSeen UNIQUE (userId, notifKey)
        )
      `);
    } catch (err) {
      this.logger.warn(`Schema init skipped (will retry on next request): ${(err as Error)?.message}`);
    }
  }

  async getForUser(userId: string, roleCode: string): Promise<any[]> {
    const items: any[] = [];
    const code = (roleCode ?? '').toUpperCase();
    const isPrivileged = code.includes('ADMIN') || code.includes('MANAGER') || code.includes('APPROVER');

    // Pending timesheets awaiting approval
    if (isPrivileged) {
      try {
        const res = await this.pool.request().query(`
          SELECT TOP 20 tsId, tsDocNo, tsType,
                 entered_by_name AS enteredBy,
                 shiftDate, department_code AS department,
                 CONVERT(VARCHAR(24), createdAt, 126) AS createdAt
          FROM PSTsHeader
          WHERE status = 'Submitted' AND isDeleted = 0
          ORDER BY createdAt ASC
        `);
        for (const r of res.recordset) {
          const typeLabel = r.tsType === 'INST' ? 'Installation' : r.tsType === 'PROJ' ? 'Projects' : 'Production';
          items.push({
            id: `ts-submitted-${r.tsId}`,
            notifKey: `ts-submitted-${r.tsId}`,
            message: `${typeLabel} timesheet ${r.tsDocNo} pending approval`,
            detail: `Submitted by ${r.enteredBy ?? '—'}${r.department ? ` · ${r.department}` : ''}${r.shiftDate ? ` · ${r.shiftDate}` : ''}`,
            level: 'warning',
            link: '/timesheets/pending-approvals',
            time: r.createdAt ? new Date(r.createdAt).toLocaleString('en-GB') : null,
            isRead: false,
          });
        }
      } catch { /* table may not exist in all envs */ }
    }

    // My recently approved timesheets (last 7 days) — notify submitter
    try {
      const cutoff7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const approvedRes = await this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .input('cutoff', mssql.DateTime2,    cutoff7)
        .query(`
          SELECT TOP 10 tsId, tsDocNo, tsType, updatedAt,
                 CONVERT(VARCHAR(24), updatedAt, 126) AS updatedAtStr
          FROM PSTsHeader
          WHERE status = 'Approved' AND isDeleted = 0
            AND enteredByUserId = @userId AND updatedAt >= @cutoff
          ORDER BY updatedAt DESC
        `);
      for (const r of approvedRes.recordset) {
        const typeLabel = r.tsType === 'INST' ? 'Installation' : r.tsType === 'PROJ' ? 'Projects' : 'Production';
        items.push({
          id: `ts-approved-${r.tsId}`,
          notifKey: `ts-approved-${r.tsId}`,
          message: `${typeLabel} timesheet ${r.tsDocNo} has been approved`,
          detail: `Approved recently`,
          level: 'success',
          link: `/timesheets/${r.tsType?.toLowerCase() === 'inst' ? 'inst' : 'prod'}/${r.tsDocNo}/view`,
          time: r.updatedAtStr ? new Date(r.updatedAtStr).toLocaleString('en-GB') : null,
          isRead: false,
        });
      }
    } catch { /* skip */ }

    // My recently rejected timesheets (last 7 days) — notify submitter
    try {
      const cutoff7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const rejectedRes = await this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .input('cutoff', mssql.DateTime2,    cutoff7)
        .query(`
          SELECT TOP 10 tsId, tsDocNo, tsType, remarks, updatedAt,
                 CONVERT(VARCHAR(24), updatedAt, 126) AS updatedAtStr
          FROM PSTsHeader
          WHERE status = 'Rejected' AND isDeleted = 0
            AND enteredByUserId = @userId AND updatedAt >= @cutoff
          ORDER BY updatedAt DESC
        `);
      for (const r of rejectedRes.recordset) {
        const typeLabel = r.tsType === 'INST' ? 'Installation' : r.tsType === 'PROJ' ? 'Projects' : 'Production';
        items.push({
          id: `ts-rejected-${r.tsId}`,
          notifKey: `ts-rejected-${r.tsId}`,
          message: `${typeLabel} timesheet ${r.tsDocNo} was rejected`,
          detail: r.remarks ? `Reason: ${r.remarks}` : 'Please correct and resubmit',
          level: 'error',
          link: `/timesheets/${r.tsType?.toLowerCase() === 'inst' ? 'inst' : 'prod'}/${r.tsDocNo}/edit`,
          time: r.updatedAtStr ? new Date(r.updatedAtStr).toLocaleString('en-GB') : null,
          isRead: false,
        });
      }
    } catch { /* skip */ }

    // QC records passed/failed (last 7 days) — for inspector
    try {
      const cutoff7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const qcRes = await this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .input('cutoff', mssql.DateTime2,    cutoff7)
        .query(`
          SELECT TOP 10 id, docNo, status, qcInspector, workOrderNo,
                 CONVERT(VARCHAR(24), updatedAt, 126) AS updatedAtStr
          FROM PsQcRecord
          WHERE isDeleted = 0 AND status IN ('Passed','Failed')
            AND updatedAt >= @cutoff
            AND (qcInspector IN (
              SELECT displayName FROM PSTsUsers WHERE userId = @userId
            ) OR ${isPrivileged ? '1=1' : '1=0'})
          ORDER BY updatedAt DESC
        `);
      for (const r of qcRes.recordset) {
        items.push({
          id: `qc-${r.status?.toLowerCase()}-${r.id}`,
          notifKey: `qc-${r.status?.toLowerCase()}-${r.id}`,
          message: `QC ${r.docNo} ${r.status === 'Passed' ? '✓ Passed' : '✗ Failed'}`,
          detail: `WO: ${r.workOrderNo ?? '—'} · Inspector: ${r.qcInspector ?? '—'}`,
          level: r.status === 'Passed' ? 'success' : 'error',
          link: `/qc/${r.id}/view`,
          time: r.updatedAtStr ? new Date(r.updatedAtStr).toLocaleString('en-GB') : null,
          isRead: false,
        });
      }
    } catch { /* skip */ }

    // Recent WO Complete entries (last 7 days) — for approvers/admins
    if (isPrivileged) {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const wocRes = await this.pool.request()
        .input('cutoff', mssql.DateTime2, cutoff)
        .query(`
          SELECT TOP 10 id, docNo, status, enteredBy,
                 CONVERT(VARCHAR(24), createdAt, 126) AS createdAt
          FROM PsWoComplete
          WHERE isDeleted = 0 AND createdAt >= @cutoff
          ORDER BY createdAt DESC
        `);
      for (const r of wocRes.recordset) {
        items.push({
          id: `woc-${r.id}`,
          notifKey: `woc-${r.id}`,
          message: `WO Complete ${r.docNo} created`,
          detail: `By ${r.enteredBy ?? '—'} · Status: ${r.status ?? '—'}`,
          level: 'info',
          link: '/woc',
          time: r.createdAt ? new Date(r.createdAt).toLocaleString('en-GB') : null,
          isRead: false,
        });
      }
    } catch { /* table may not exist */ }
    }

    if (items.length === 0) return [];

    // Overlay read state from PsNotifSeen
    const seenRes = await this.pool.request()
      .input('userId', mssql.NVarChar(30), userId)
      .query(`SELECT notifKey FROM PsNotifSeen WHERE userId = @userId`);
    const seenSet = new Set(seenRes.recordset.map((r) => r.notifKey));

    return items.map((i) => ({ ...i, isRead: seenSet.has(i.notifKey) }));
  }

  async markRead(userId: string, notifKey: string): Promise<void> {
    await this.pool.request()
      .input('userId',   mssql.NVarChar(30),  userId)
      .input('notifKey', mssql.NVarChar(100), notifKey)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM PsNotifSeen WHERE userId = @userId AND notifKey = @notifKey)
          INSERT INTO PsNotifSeen (userId, notifKey) VALUES (@userId, @notifKey)
      `);
  }

  async markAllRead(userId: string, roleCode: string): Promise<void> {
    const items = await this.getForUser(userId, roleCode);
    await this.pool.request()
      .input('userId', mssql.NVarChar(30), userId)
      .query(`DELETE FROM PsNotifSeen WHERE userId = @userId`);
    for (const item of items) {
      await this.pool.request()
        .input('userId',   mssql.NVarChar(30),  userId)
        .input('notifKey', mssql.NVarChar(100), item.notifKey)
        .query(`INSERT INTO PsNotifSeen (userId, notifKey) VALUES (@userId, @notifKey)`);
    }
  }
}
