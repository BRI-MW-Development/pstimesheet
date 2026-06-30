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
        );
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='PsNotifPreferences' AND xtype='U')
        CREATE TABLE PsNotifPreferences (
          id         BIGINT IDENTITY(1,1) PRIMARY KEY,
          userId     NVARCHAR(30)  NOT NULL,
          notifType  NVARCHAR(50)  NOT NULL,
          enabled    BIT           NOT NULL DEFAULT 1,
          updatedAt  DATETIME2     DEFAULT SYSUTCDATETIME(),
          CONSTRAINT UQ_PsNotifPrefs UNIQUE (userId, notifType)
        )
      `);
    } catch (err) {
      this.logger.warn(`Schema init skipped (will retry on next request): ${(err as Error)?.message}`);
    }
  }

  // All known types with their defaults (all on by default)
  static readonly NOTIF_TYPES = [
    'pending_approvals',
    'ts_approved',
    'ts_rejected',
    'forgotten_drafts',
    'proj_missing',
    'qc_status',
    'qc_woc_eligible',
    'woc_conflict',
    'woc_new',
    'login_failures',
  ] as const;

  async getPreferences(userId: string): Promise<Record<string, boolean>> {
    try {
      const res = await this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .query(`SELECT notifType, enabled FROM PsNotifPreferences WHERE userId = @userId`);
      const saved = new Map(res.recordset.map((r: any) => [r.notifType as string, !!r.enabled]));
      // All unknown types default to true
      const out: Record<string, boolean> = {};
      for (const t of NotificationsService.NOTIF_TYPES) {
        out[t] = saved.has(t) ? (saved.get(t) as boolean) : true;
      }
      return out;
    } catch {
      // If table not yet ready, return all defaults
      return Object.fromEntries(NotificationsService.NOTIF_TYPES.map((t) => [t, true]));
    }
  }

  async setPreferences(userId: string, prefs: Record<string, boolean>): Promise<void> {
    const valid = NotificationsService.NOTIF_TYPES.filter((t) => t in prefs);
    if (!valid.length) return;
    for (const t of valid) {
      await this.pool.request()
        .input('userId',    mssql.NVarChar(30), userId)
        .input('notifType', mssql.NVarChar(50), t)
        .input('enabled',   mssql.Bit,          prefs[t] ? 1 : 0)
        .query(`
          MERGE PsNotifPreferences AS target
          USING (SELECT @userId AS userId, @notifType AS notifType) AS src
            ON target.userId = src.userId AND target.notifType = src.notifType
          WHEN MATCHED    THEN UPDATE SET enabled = @enabled, updatedAt = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (userId, notifType, enabled) VALUES (@userId, @notifType, @enabled);
        `);
    }
  }

  async getForUser(userId: string, roleCode: string): Promise<any[]> {
    const items: any[] = [];
    const code = (roleCode ?? '').toUpperCase();
    const isPrivileged = code.includes('ADMIN') || code.includes('MANAGER') || code.includes('APPROVER');
    const isAdmin      = code.includes('ADMIN');
    const cutoff7      = new Date(Date.now() - 7  * 24 * 3600 * 1000);
    const cutoff30     = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const prefs = await this.getPreferences(userId);
    const on = (type: string) => prefs[type] !== false;

    // ── 1. Pending approvals ───────────────────────────────────────────────────
    // ≤ 3 submitted: show individual cards
    // > 3 submitted: show one digest to avoid overwhelming the panel
    if (isPrivileged && on('pending_approvals')) {
      try {
        const res = await this.pool.request().query(`
          SELECT TOP 20
            tsId, tsDocNo, tsType,
            entered_by_name  AS enteredBy,
            department_code  AS department,
            CONVERT(VARCHAR(24), createdAt, 126)     AS createdAtStr,
            DATEDIFF(HOUR, createdAt, GETDATE())     AS hoursWaiting
          FROM PSTsHeader
          WHERE status = 'Submitted' AND isDeleted = 0
          ORDER BY createdAt ASC
        `);
        const rows = res.recordset;
        if (rows.length > 3) {
          const oldest      = rows[0];
          const h           = oldest.hoursWaiting ?? 0;
          const ageStr      = h >= 48 ? `oldest ${Math.floor(h / 24)} days ago` : `oldest ${h}h ago`;
          const hasOverdue  = rows.some((r: any) => (r.hoursWaiting ?? 0) >= 48);
          items.push({
            notifKey: 'ts-pending-digest',
            message:  `${rows.length} timesheets awaiting approval`,
            detail:   ageStr,
            level:    hasOverdue ? 'error' : 'warning',
            link:     '/timesheets/pending-approvals',
            time:     null,
          });
        } else {
          for (const r of rows) {
            const typeLabel = r.tsType === 'INST' ? 'Installation' : r.tsType === 'PROJ' ? 'Projects' : 'Production';
            const overdue   = (r.hoursWaiting ?? 0) >= 48;
            items.push({
              notifKey: `ts-submitted-${r.tsId}`,
              message:  `${typeLabel} timesheet ${r.tsDocNo} pending approval${overdue ? ' — overdue' : ''}`,
              detail:   `Submitted by ${r.enteredBy ?? '—'}${r.department ? ` · ${r.department}` : ''}`,
              level:    overdue ? 'error' : 'warning',
              link:     '/timesheets/pending-approvals',
              time:     r.createdAtStr ? new Date(r.createdAtStr).toLocaleString('en-GB') : null,
            });
          }
        }
      } catch { /* skip */ }
    }

    // ── 2. My timesheet approved (last 7 days) — notify the submitter ──────────
    if (on('ts_approved')) try {
      const approvedRes = await this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .input('cutoff', mssql.DateTime2,    cutoff7)
        .query(`
          SELECT TOP 10 tsId, tsDocNo, tsType,
                 CONVERT(VARCHAR(24), updatedAt, 126) AS updatedAtStr
          FROM PSTsHeader
          WHERE status = 'Approved' AND isDeleted = 0
            AND entered_by_user_id = @userId AND updatedAt >= @cutoff
          ORDER BY updatedAt DESC
        `);
      for (const r of approvedRes.recordset) {
        const typeLabel = r.tsType === 'INST' ? 'Installation' : r.tsType === 'PROJ' ? 'Projects' : 'Production';
        items.push({
          notifKey: `ts-approved-${r.tsId}`,
          message:  `${typeLabel} timesheet ${r.tsDocNo} approved`,
          detail:   'Approved — no further action needed',
          level:    'success',
          link:     `/timesheets/${r.tsType?.toLowerCase() === 'inst' ? 'inst' : 'prod'}/${r.tsDocNo}/view`,
          time:     r.updatedAtStr ? new Date(r.updatedAtStr).toLocaleString('en-GB') : null,
        });
      }
    } catch { /* skip */ }

    // ── 3. My timesheet rejected (last 7 days) — notify the submitter ─────────
    if (on('ts_rejected')) try {
      const rejectedRes = await this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .input('cutoff', mssql.DateTime2,    cutoff7)
        .query(`
          SELECT TOP 10 tsId, tsDocNo, tsType, remarks,
                 CONVERT(VARCHAR(24), updatedAt, 126) AS updatedAtStr
          FROM PSTsHeader
          WHERE status = 'Rejected' AND isDeleted = 0
            AND entered_by_user_id = @userId AND updatedAt >= @cutoff
          ORDER BY updatedAt DESC
        `);
      for (const r of rejectedRes.recordset) {
        const typeLabel = r.tsType === 'INST' ? 'Installation' : r.tsType === 'PROJ' ? 'Projects' : 'Production';
        items.push({
          notifKey: `ts-rejected-${r.tsId}`,
          message:  `${typeLabel} timesheet ${r.tsDocNo} was rejected`,
          detail:   r.remarks ? `Reason: ${r.remarks}` : 'Please correct and resubmit',
          level:    'error',
          link:     `/timesheets/${r.tsType?.toLowerCase() === 'inst' ? 'inst' : 'prod'}/${r.tsDocNo}/edit`,
          time:     r.updatedAtStr ? new Date(r.updatedAtStr).toLocaleString('en-GB') : null,
        });
      }
    } catch { /* skip */ }

    // ── 4. Forgotten drafts — Draft for > 2 days, entered by this user ─────────
    if (on('forgotten_drafts')) try {
      const draftsRes = await this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .query(`
          SELECT TOP 3
            tsId, tsDocNo, tsType,
            DATEDIFF(DAY, createdAt, GETDATE()) AS daysOld
          FROM PSTsHeader
          WHERE status = 'Draft' AND isDeleted = 0
            AND entered_by_user_id = @userId
            AND createdAt < DATEADD(DAY, -2, GETDATE())
          ORDER BY createdAt ASC
        `);
      for (const r of draftsRes.recordset) {
        const typeLabel = r.tsType === 'INST' ? 'Installation' : r.tsType === 'PROJ' ? 'Projects' : 'Production';
        const route     = r.tsType === 'INST' ? 'inst' : 'prod';
        items.push({
          notifKey: `draft-forgotten-${r.tsId}`,
          message:  `${typeLabel} draft not submitted`,
          detail:   `${r.tsDocNo} has been in draft for ${r.daysOld} day${r.daysOld !== 1 ? 's' : ''} — submit or delete`,
          level:    'warning',
          link:     `/timesheets/${route}/${r.tsDocNo}/edit`,
          time:     null,
        });
      }
    } catch { /* skip */ }

    // ── 5. Weekly PROJ not started (Wednesday or later in the week) ────────────
    if (on('proj_missing')) try {
      const projPermRes = await this.pool.request()
        .input('rc', mssql.NVarChar(30), roleCode)
        .query(`SELECT TOP 1 1 AS ok FROM PSTsRolePermissions WHERE roleCode = @rc AND module = 'PROJ' AND canRead = 1`);
      const hasProj   = projPermRes.recordset.length > 0;
      const now       = new Date();
      const dow       = now.getDay(); // 0=Sun 1=Mon … 6=Sat
      const isLateWeek = dow >= 3 && dow <= 6; // Wed–Sat

      if (hasProj && isLateWeek) {
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
        const weekStart = monday.toISOString().slice(0, 10);

        const projCheckRes = await this.pool.request()
          .input('userId',    mssql.NVarChar(30), userId)
          .input('weekStart', mssql.Date,         monday)
          .query(`
            SELECT TOP 1 tsId FROM PSTsHeader
            WHERE tsType = 'PROJ' AND isDeleted = 0
              AND entered_by_user_id = @userId
              AND entryDate >= @weekStart
          `);
        if (projCheckRes.recordset.length === 0) {
          items.push({
            notifKey: `proj-missing-${weekStart}`,
            message:  'Weekly project timesheet not started',
            detail:   `No PROJ timesheet submitted for the week of ${weekStart}`,
            level:    'warning',
            link:     '/timesheets/proj',
            time:     null,
          });
        }
      }
    } catch { /* skip */ }

    // ── 6. QC records passed/failed (last 7 days) — inspector + privileged ─────
    if (on('qc_status')) try {
      const qcRes = await this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .input('cutoff', mssql.DateTime2,    cutoff7)
        .query(`
          SELECT TOP 10 id, docNo, status, qcInspector, workOrderNo,
                 CONVERT(VARCHAR(24), updatedAt, 126) AS updatedAtStr
          FROM PsQcRecord
          WHERE isDeleted = 0 AND status IN ('Passed','Failed')
            AND updatedAt >= @cutoff
            AND (qcInspector IN (SELECT displayName FROM PSTsUsers WHERE userId = @userId)
                 OR ${isPrivileged ? '1=1' : '1=0'})
          ORDER BY updatedAt DESC
        `);
      for (const r of qcRes.recordset) {
        items.push({
          notifKey: `qc-${r.status?.toLowerCase()}-${r.id}`,
          message:  `QC ${r.docNo} ${r.status === 'Passed' ? '✓ Passed' : '✗ Failed'}`,
          detail:   `WO: ${r.workOrderNo ?? '—'} · Inspector: ${r.qcInspector ?? '—'}`,
          level:    r.status === 'Passed' ? 'success' : 'error',
          link:     `/qc/${r.id}/view`,
          time:     r.updatedAtStr ? new Date(r.updatedAtStr).toLocaleString('en-GB') : null,
        });
      }
    } catch { /* skip */ }

    // ── 7. WO eligible for completion (Full QC done, WO not yet completed) ─────
    if (isPrivileged && on('qc_woc_eligible')) {
      try {
        const eligibleRes = await this.pool.request()
          .input('cutoff', mssql.DateTime2, cutoff7)
          .query(`
            SELECT TOP 5
              r.id, r.docNo AS qcDocNo, r.workOrderNo,
              CONVERT(VARCHAR(24), r.updatedAt, 126) AS updatedAtStr
            FROM PsQcRecord r
            WHERE r.isDeleted = 0
              AND r.partialFull = 'Full'
              AND r.workOrderNo IS NOT NULL AND r.workOrderNo <> ''
              AND r.updatedAt >= @cutoff
              AND NOT EXISTS (
                SELECT 1 FROM PsWoComplete w
                WHERE w.workOrderNumber = r.workOrderNo AND w.isDeleted = 0
              )
            ORDER BY r.updatedAt DESC
          `);
        for (const r of eligibleRes.recordset) {
          items.push({
            notifKey: `qc-woc-eligible-${r.id}`,
            message:  `WO ${r.workOrderNo} ready for completion`,
            detail:   `Full QC ${r.qcDocNo} completed — eligible to mark as WO Complete`,
            level:    'info',
            link:     '/woc',
            time:     r.updatedAtStr ? new Date(r.updatedAtStr).toLocaleString('en-GB') : null,
          });
        }
      } catch { /* skip */ }
    }

    // ── 8. WO Completed but linked timesheets still in Draft/Submitted ─────────
    if (isPrivileged && on('woc_conflict')) {
      try {
        const conflictRes = await this.pool.request()
          .input('cutoff', mssql.DateTime2, cutoff30)
          .query(`
            SELECT TOP 3
              w.id AS wocId, w.docNo AS wocDocNo, w.workOrderNumber,
              COUNT(h.tsId) AS pendingCount
            FROM PsWoComplete w
            JOIN PSTsHeader h ON h.workOrderNo = w.workOrderNumber
              AND h.status IN ('Draft','Submitted') AND h.isDeleted = 0
            WHERE w.isDeleted = 0 AND w.createdAt >= @cutoff
            GROUP BY w.id, w.docNo, w.workOrderNumber
            HAVING COUNT(h.tsId) > 0
            ORDER BY w.createdAt DESC
          `);
        for (const r of conflictRes.recordset) {
          items.push({
            notifKey: `woc-conflict-${r.wocId}`,
            message:  `WO ${r.workOrderNumber} completed with pending timesheets`,
            detail:   `${r.pendingCount} timesheet${r.pendingCount !== 1 ? 's' : ''} still in Draft/Submitted for this WO`,
            level:    'warning',
            link:     '/timesheets/pending-approvals',
            time:     null,
          });
        }
      } catch { /* skip */ }
    }

    // ── 9. Recent WO Complete entries (last 7 days) — for approvers/admins ─────
    if (isPrivileged && on('woc_new')) {
      try {
        const wocRes = await this.pool.request()
          .input('cutoff', mssql.DateTime2, cutoff7)
          .query(`
            SELECT TOP 10 id, docNo, workOrderNumber, status, enteredBy,
                   CONVERT(VARCHAR(24), createdAt, 126) AS createdAtStr
            FROM PsWoComplete
            WHERE isDeleted = 0 AND createdAt >= @cutoff
            ORDER BY createdAt DESC
          `);
        for (const r of wocRes.recordset) {
          items.push({
            notifKey: `woc-${r.id}`,
            message:  `WO Complete ${r.docNo} created`,
            detail:   `WO ${r.workOrderNumber ?? '—'} · By ${r.enteredBy ?? '—'} · ${r.status ?? '—'}`,
            level:    'info',
            link:     '/woc',
            time:     r.createdAtStr ? new Date(r.createdAtStr).toLocaleString('en-GB') : null,
          });
        }
      } catch { /* skip */ }
    }

    // ── 10. Failed login attempts — admin only (≥ 5 in the last hour) ──────────
    if (isAdmin && on('login_failures')) {
      try {
        const failRes = await this.pool.request().query(`
          SELECT COUNT(*) AS cnt
          FROM PSTsLoginHistory
          WHERE success = 0 AND attemptAt >= DATEADD(HOUR, -1, GETUTCDATE())
        `);
        const cnt = failRes.recordset[0]?.cnt ?? 0;
        if (cnt >= 5) {
          items.push({
            notifKey: `login-failures-${Math.floor(cnt / 5)}`,
            message:  `${cnt} failed login attempts in the last hour`,
            detail:   'Possible brute-force — review login history',
            level:    'error',
            link:     '/admin/login-history',
            time:     null,
          });
        }
      } catch { /* skip */ }
    }

    if (items.length === 0) return [];

    // Overlay read state from PsNotifSeen
    const seenRes = await this.pool.request()
      .input('userId', mssql.NVarChar(30), userId)
      .query(`SELECT notifKey FROM PsNotifSeen WHERE userId = @userId`);
    const seenSet = new Set(seenRes.recordset.map((r: any) => r.notifKey as string));

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
    const unread = items.filter(i => !i.isRead);
    if (!unread.length) return;

    // Single bulk INSERT — no delete, no N+1 loop, no race condition.
    // NOT EXISTS guard handles duplicates without needing a prior DELETE.
    const valueParams = unread.map((_, i) => `(@uid, @k${i})`).join(',');
    const req = this.pool.request().input('uid', mssql.NVarChar(30), userId);
    unread.forEach((item, i) => req.input(`k${i}`, mssql.NVarChar(100), item.notifKey));
    await req.query(`
      INSERT INTO PsNotifSeen (userId, notifKey)
      SELECT v.userId, v.notifKey
      FROM (VALUES ${valueParams}) AS v(userId, notifKey)
      WHERE NOT EXISTS (
        SELECT 1 FROM PsNotifSeen s WHERE s.userId = v.userId AND s.notifKey = v.notifKey
      )
    `);
  }
}
