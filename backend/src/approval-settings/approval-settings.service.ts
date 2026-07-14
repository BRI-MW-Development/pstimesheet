import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';

@Injectable()
export class ApprovalSettingsService implements OnModuleInit {
  private readonly logger = new Logger(ApprovalSettingsService.name);

  constructor(@Inject(DEV_SQL_POOL) private readonly pool: mssql.ConnectionPool) {}

  async onModuleInit() {
    const run = async (label: string, sql: string) => {
      try { await this.pool.request().query(sql); }
      catch (err) { this.logger.warn(`Schema step "${label}" failed: ${(err as Error)?.message}`); }
    };

    await run('create PSApprovalSettings', `
      IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='PSApprovalSettings' AND xtype='U')
      CREATE TABLE PSApprovalSettings (
        id             INT IDENTITY(1,1) PRIMARY KEY,
        module         NVARCHAR(20)  NOT NULL DEFAULT 'ALL',
        department     NVARCHAR(100) NOT NULL DEFAULT '',
        approverName   NVARCHAR(200),
        approverEmail  NVARCHAR(200),
        approverUserId NVARCHAR(50),
        approverNames  NVARCHAR(MAX),
        approverEmails NVARCHAR(MAX),
        approverUserIds NVARCHAR(MAX),
        anyApprover    BIT NOT NULL DEFAULT 1,
        criteria       NVARCHAR(MAX),
        filterLogic    NVARCHAR(500),
        createdAt      DATETIME DEFAULT GETDATE(),
        updatedAt      DATETIME DEFAULT GETDATE()
      )
    `);
    await run('drop unique dept constraint', `
      DECLARE @con NVARCHAR(200) = (
        SELECT name FROM sys.key_constraints
        WHERE parent_object_id = OBJECT_ID('PSApprovalSettings') AND type = 'UQ'
      );
      IF @con IS NOT NULL
        EXEC('ALTER TABLE PSApprovalSettings DROP CONSTRAINT [' + @con + ']')
    `);
    await run('add approverNames',   `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='approverNames')   ALTER TABLE PSApprovalSettings ADD approverNames   NVARCHAR(MAX) NULL`);
    await run('add approverEmails',  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='approverEmails')  ALTER TABLE PSApprovalSettings ADD approverEmails  NVARCHAR(MAX) NULL`);
    await run('add approverUserIds', `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='approverUserIds') ALTER TABLE PSApprovalSettings ADD approverUserIds NVARCHAR(MAX) NULL`);
    await run('add anyApprover',     `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='anyApprover')     ALTER TABLE PSApprovalSettings ADD anyApprover     BIT NOT NULL DEFAULT 1`);
    await run('add module',          `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='module')          ALTER TABLE PSApprovalSettings ADD module          NVARCHAR(20) NOT NULL DEFAULT 'ALL'`);
    await run('add criteria',        `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='criteria')        ALTER TABLE PSApprovalSettings ADD criteria        NVARCHAR(MAX) NULL`);
    await run('add filterLogic',     `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='filterLogic')     ALTER TABLE PSApprovalSettings ADD filterLogic     NVARCHAR(500) NULL`);
    await run('backfill names',      `UPDATE PSApprovalSettings SET approverNames  = approverName  WHERE approverNames  IS NULL AND approverName  IS NOT NULL`);
    await run('backfill emails',     `UPDATE PSApprovalSettings SET approverEmails = approverEmail WHERE approverEmails IS NULL AND approverEmail IS NOT NULL`);
    await run('create PSEmailSettings', `
      IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='PSEmailSettings' AND xtype='U')
      CREATE TABLE PSEmailSettings (
        id        INT IDENTITY(1,1) PRIMARY KEY,
        smtpHost  NVARCHAR(200),
        smtpPort  INT DEFAULT 587,
        smtpUser  NVARCHAR(200),
        smtpPass  NVARCHAR(500),
        fromEmail NVARCHAR(200),
        fromName  NVARCHAR(200),
        enabled   BIT DEFAULT 0,
        updatedAt DATETIME DEFAULT GETDATE()
      )
    `);
    await run('add rejectionReason', `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsHeader') AND name='rejectionReason') ALTER TABLE PSTsHeader ADD rejectionReason NVARCHAR(500) NULL`);
    await run('add approvedBy',      `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsHeader') AND name='approvedBy')      ALTER TABLE PSTsHeader ADD approvedBy      NVARCHAR(200) NULL`);
    await run('add approvedAt',      `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsHeader') AND name='approvedAt')      ALTER TABLE PSTsHeader ADD approvedAt      DATETIME NULL`);
    await run('add submittedAt',     `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsHeader') AND name='submittedAt')     ALTER TABLE PSTsHeader ADD submittedAt     DATETIME NULL`);
  }

  private splitTrim(val: string | null): string[] {
    if (!val) return [];
    return val.split(',').map(s => s.trim()).filter(Boolean);
  }

  async list() {
    const res = await this.pool.request().query(
      `SELECT id, module, department, approverNames, approverEmails, approverUserIds, anyApprover, criteria, filterLogic
       FROM PSApprovalSettings ORDER BY module, department`
    );
    return res.recordset.map(r => {
      let criteria = [];
      try { criteria = r.criteria ? JSON.parse(r.criteria) : []; } catch { criteria = []; }
      return {
        id:              r.id,
        module:          r.module          || 'ALL',
        department:      r.department      || '',
        approverNames:   r.approverNames   || '',
        approverEmails:  r.approverEmails  || '',
        approverUserIds: r.approverUserIds || '',
        anyApprover:     r.anyApprover !== 0 && r.anyApprover !== false,
        criteria,
        filterLogic:     r.filterLogic || '',
      };
    });
  }

  async upsert(rows: { id?: number; module?: string; department?: string; approverNames?: string; approverEmails?: string; approverUserIds?: string; anyApprover?: boolean; criteria?: any[]; filterLogic?: string }[]) {
    for (const row of rows) {
      try {
      const firstName  = this.splitTrim(row.approverNames || '')[0]  || null;
      const firstEmail = this.splitTrim(row.approverEmails || '')[0] || null;
      const criteriaJson = row.criteria ? JSON.stringify(row.criteria) : null;
      // Extract department from criteria for backward compat
      const deptCriterion = (row.criteria || []).find((c: any) => c.field === 'department');
      const dept = deptCriterion?.value || row.department || '';
      if (row.id) {
        await this.pool.request()
          .input('id',          mssql.Int,           row.id)
          .input('module',      mssql.NVarChar(20),  row.module      || 'ALL')
          .input('dept',        mssql.NVarChar(100), dept)
          .input('names',       mssql.NVarChar(mssql.MAX), row.approverNames   || null)
          .input('emails',      mssql.NVarChar(mssql.MAX), row.approverEmails  || null)
          .input('userIds',     mssql.NVarChar(mssql.MAX), row.approverUserIds || null)
          .input('anyApprover', mssql.Bit,           row.anyApprover !== false ? 1 : 0)
          .input('name',        mssql.NVarChar(200), firstName)
          .input('email',       mssql.NVarChar(200), firstEmail)
          .input('criteria',    mssql.NVarChar(mssql.MAX), criteriaJson)
          .input('filterLogic', mssql.NVarChar(500), row.filterLogic || null)
          .query(`UPDATE PSApprovalSettings SET module=@module, department=@dept,
                    approverNames=@names, approverEmails=@emails, approverUserIds=@userIds,
                    anyApprover=@anyApprover, approverName=@name, approverEmail=@email,
                    criteria=@criteria, filterLogic=@filterLogic, updatedAt=GETDATE()
                  WHERE id=@id`);
      } else {
        await this.pool.request()
          .input('module',      mssql.NVarChar(20),  row.module      || 'ALL')
          .input('dept',        mssql.NVarChar(100), dept)
          .input('names',       mssql.NVarChar(mssql.MAX), row.approverNames   || null)
          .input('emails',      mssql.NVarChar(mssql.MAX), row.approverEmails  || null)
          .input('userIds',     mssql.NVarChar(mssql.MAX), row.approverUserIds || null)
          .input('anyApprover', mssql.Bit,           row.anyApprover !== false ? 1 : 0)
          .input('name',        mssql.NVarChar(200), firstName)
          .input('email',       mssql.NVarChar(200), firstEmail)
          .input('criteria',    mssql.NVarChar(mssql.MAX), criteriaJson)
          .input('filterLogic', mssql.NVarChar(500), row.filterLogic || null)
          .query(`INSERT INTO PSApprovalSettings (module, department, approverNames, approverEmails, approverUserIds, anyApprover, approverName, approverEmail, criteria, filterLogic)
                  VALUES (@module, @dept, @names, @emails, @userIds, @anyApprover, @name, @email, @criteria, @filterLogic)`);
      }
      } catch (err: any) {
        this.logger.error(`upsert approval rule failed: ${err?.message}`);
        throw new BadRequestException(err?.message ?? 'Failed to save approval rule');
      }
    }
  }

  async getByDepartment(dept: string): Promise<{ department: string; approverNames: string[]; approverEmails: string[] } | null> {
    const res = await this.pool.request()
      .input('dept', mssql.NVarChar(100), dept)
      .query(`SELECT TOP 1 department, approverNames, approverEmails FROM PSApprovalSettings WHERE department = @dept`);
    const row = res.recordset[0];
    if (!row) return null;
    return {
      department:     row.department,
      approverNames:  this.splitTrim(row.approverNames),
      approverEmails: this.splitTrim(row.approverEmails),
    };
  }

  /**
   * Return all approver emails from every approval rule that matches this timesheet.
   * Uses the same module + criteria matching logic as canUserApproveTimesheet so the
   * notification always goes to the right approvers regardless of department/digitalTech/shift.
   */
  async getApproversForTimesheet(
    ts: { tsType?: string; department_code?: string; shiftCode?: string; projectId?: string; workOrderNo?: string; digitalTech?: string },
  ): Promise<string[]> {
    const allRules = await this.list();
    if (!allRules.length) return [];

    const tsModule = ts.tsType === 'INST' ? 'INST' : ts.tsType === 'PROJ' ? 'PROJ' : 'PROD';

    const evalCriterion = (c: any): boolean => {
      const tsVal = (
        c.field === 'department'  ? ts.department_code :
        c.field === 'shift'       ? ts.shiftCode :
        c.field === 'projectNo'   ? ts.projectId :
        c.field === 'workOrderNo' ? ts.workOrderNo :
        c.field === 'digitalTech' ? ts.digitalTech : null
      )?.toString().toLowerCase() ?? '';
      const ruleVal = (c.value ?? '').toString().toLowerCase();
      const op = c.operator ?? 'equals';
      return op === 'equals'      ? tsVal === ruleVal
           : op === 'not equals'  ? tsVal !== ruleVal
           : op === 'contains'    ? tsVal.includes(ruleVal)
           : op === 'starts with' ? tsVal.startsWith(ruleVal)
           : false;
    };

    const criteriaMatch = (rule: any): boolean => {
      const real = (rule.criteria ?? []).filter((c: any) => c.field && c.value);
      if (!real.length) return true;
      const groups: Record<string, any[]> = {};
      for (const c of real) {
        if (!groups[c.field]) groups[c.field] = [];
        groups[c.field].push(c);
      }
      return Object.values(groups).every(grp => grp.some(evalCriterion));
    };

    const emails = new Set<string>();
    for (const rule of allRules) {
      if (rule.module !== 'ALL' && rule.module !== tsModule) continue;
      if (!criteriaMatch(rule)) continue;
      this.splitTrim(rule.approverEmails).forEach(e => e && emails.add(e));
    }
    return [...emails];
  }

  /**
   * Return matched approver display names for a given set of timesheet criteria.
   * Used by the frontend to show "Will be reviewed by: X, Y" before submission.
   */
  async previewApproverNames(
    ts: { tsType?: string; department_code?: string; shiftCode?: string; projectId?: string; workOrderNo?: string; digitalTech?: string },
  ): Promise<{ names: string[] }> {
    const allRules = await this.list();
    if (!allRules.length) return { names: [] };
    const tsModule = ts.tsType === 'INST' ? 'INST' : ts.tsType === 'PROJ' ? 'PROJ' : 'PROD';

    const evalCriterion = (c: any): boolean => {
      const tsVal = (
        c.field === 'department'  ? ts.department_code :
        c.field === 'shift'       ? ts.shiftCode :
        c.field === 'projectNo'   ? ts.projectId :
        c.field === 'workOrderNo' ? ts.workOrderNo :
        c.field === 'digitalTech' ? ts.digitalTech : null
      )?.toString().toLowerCase() ?? '';
      const ruleVal = (c.value ?? '').toString().toLowerCase();
      const op = c.operator ?? 'equals';
      return op === 'equals'      ? tsVal === ruleVal
           : op === 'not equals'  ? tsVal !== ruleVal
           : op === 'contains'    ? tsVal.includes(ruleVal)
           : op === 'starts with' ? tsVal.startsWith(ruleVal)
           : false;
    };

    const criteriaMatch = (rule: any): boolean => {
      const real = (rule.criteria ?? []).filter((c: any) => c.field && c.value);
      if (!real.length) return true;
      const groups: Record<string, any[]> = {};
      for (const c of real) {
        if (!groups[c.field]) groups[c.field] = [];
        groups[c.field].push(c);
      }
      return Object.values(groups).every(grp => grp.some(evalCriterion));
    };

    const names = new Set<string>();
    for (const rule of allRules) {
      if (rule.module !== 'ALL' && rule.module !== tsModule) continue;
      if (!criteriaMatch(rule)) continue;
      this.splitTrim(rule.approverNames).forEach(n => n && names.add(n));
    }
    return { names: [...names] };
  }

  /**
   * Check whether userId/displayName is authorised to approve a given timesheet.
   *
   * New approach (direct):
   *  1. Helper: does this user appear in a rule's approver list?
   *  2. Helper: does a rule's criteria match this timesheet?
   *     - Multiple rows for the SAME field → OR (any one must match)
   *     - Rows for DIFFERENT fields → AND (all fields must match)
   *     - No real criteria → matches everything (catch-all)
   *  3. Collect rules where the user IS an approver AND the criteria match the ts.
   *  4. Also allow rules that have anyApprover=true with no specific approvers (open rules).
   *  5. If any such rule exists → allowed.
   *  6. If no rules are configured at all → fall back to role-based canWrite check.
   *  7. If rules exist but none apply to this user/timesheet → deny.
   */
  async canUserApproveTimesheet(
    userId: string,
    displayName: string,
    roleCode: string,
    ts: { tsType: string; department_code?: string; shiftCode?: string; projectId?: string; workOrderNo?: string; digitalTech?: string },
    hasCanWrite: boolean,
  ): Promise<{ allowed: boolean; reason: string }> {
    const allRules = await this.list();

    if (allRules.length === 0) {
      return hasCanWrite
        ? { allowed: true,  reason: 'No approval rules configured — permission-based approval allowed.' }
        : { allowed: false, reason: 'No approval rules configured and you do not have canWrite permission.' };
    }

    const tsModule = ts.tsType === 'INST' ? 'INST' : ts.tsType === 'PROJ' ? 'PROJ' : 'PROD';

    // ── Helper: does the user appear in this rule's approver list? ────────────
    const userIsApproverFor = (rule: any): boolean => {
      const ids   = this.splitTrim(rule.approverUserIds);
      const names = this.splitTrim(rule.approverNames);
      if (ids.length > 0)   return ids.includes(userId);
      if (names.length > 0) return names.some(n => n.toLowerCase() === (displayName ?? '').toLowerCase());
      return false; // no specific approvers saved → nobody matches
    };

    // ── Helper: does this rule's criteria match the timesheet? ────────────────
    const evalCriterion = (c: any): boolean => {
      const tsVal = (
        c.field === 'department'  ? ts.department_code :
        c.field === 'shift'       ? ts.shiftCode :
        c.field === 'projectNo'   ? ts.projectId :
        c.field === 'workOrderNo' ? ts.workOrderNo :
        c.field === 'digitalTech' ? ts.digitalTech : null
      )?.toString().toLowerCase() ?? '';
      const ruleVal = (c.value ?? '').toString().toLowerCase();
      const op = c.operator ?? 'equals';
      return op === 'equals'      ? tsVal === ruleVal
           : op === 'not equals'  ? tsVal !== ruleVal
           : op === 'contains'    ? tsVal.includes(ruleVal)
           : op === 'starts with' ? tsVal.startsWith(ruleVal)
           : false;
    };

    const criteriaMatch = (rule: any): boolean => {
      const real = (rule.criteria ?? []).filter((c: any) => c.field && c.value);
      if (!real.length) return true; // no real criteria = catch-all, matches everything

      // Group by field; OR within group, AND across groups
      const groups: Record<string, any[]> = {};
      for (const c of real) {
        if (!groups[c.field]) groups[c.field] = [];
        groups[c.field].push(c);
      }
      return Object.values(groups).every(grp => grp.some(evalCriterion));
    };

    // ── Find rules that (a) apply to this module, (b) match criteria, (c) allow this user ──
    const matching = allRules.filter(rule => {
      if (rule.module !== 'ALL' && rule.module !== tsModule) return false;
      if (!criteriaMatch(rule)) return false;
      return userIsApproverFor(rule);
    });

    this.logger.debug(
      `[canApprove] user="${displayName}" (${userId}) ts=${ts.tsType} dept="${ts.department_code}" ` +
      `allRules=${allRules.length} matching=${matching.length} ` +
      `matchingIds=${matching.map(r => r.id).join(',')}`
    );

    if (matching.length > 0) {
      return { allowed: true,  reason: `Matched rule(s): ${matching.map(r => `#${r.id}(${r.module})`).join(', ')}` };
    }

    // No rule matched this user. Check whether ANY rule governs this timesheet type at all.
    // If the admin has set up rules for PROD but none for INST, INST timesheets should still
    // be approvable by anyone with canWrite — same behaviour as "no rules configured".
    const rulesForModule = allRules.filter(r => r.module === 'ALL' || r.module === tsModule);
    if (rulesForModule.length === 0) {
      return hasCanWrite
        ? { allowed: true,  reason: `No rules configured for ${tsModule} — permission-based approval allowed.` }
        : { allowed: false, reason: `No rules configured for ${tsModule} and you do not have canWrite permission.` };
    }

    return { allowed: false, reason: 'No approval rule authorises you to approve this timesheet.' };
  }

  async remove(id: number) {
    await this.pool.request().input('id', mssql.Int, id)
      .query(`DELETE FROM PSApprovalSettings WHERE id = @id`);
  }
}
