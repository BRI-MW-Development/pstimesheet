import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';

@Injectable()
export class ApprovalSettingsService implements OnModuleInit {
  private readonly logger = new Logger(ApprovalSettingsService.name);

  constructor(@Inject(DEV_SQL_POOL) private readonly pool: mssql.ConnectionPool) {}

  async onModuleInit() {
    try {
      await this.pool.request().query(`
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
          createdAt      DATETIME DEFAULT GETDATE(),
          updatedAt      DATETIME DEFAULT GETDATE()
        )
      `);
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='approverNames')
          ALTER TABLE PSApprovalSettings ADD approverNames NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='approverEmails')
          ALTER TABLE PSApprovalSettings ADD approverEmails NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='approverUserIds')
          ALTER TABLE PSApprovalSettings ADD approverUserIds NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='anyApprover')
          ALTER TABLE PSApprovalSettings ADD anyApprover BIT NOT NULL DEFAULT 1;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='module')
          ALTER TABLE PSApprovalSettings ADD module NVARCHAR(20) NOT NULL DEFAULT 'ALL';
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='criteria')
          ALTER TABLE PSApprovalSettings ADD criteria NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSApprovalSettings') AND name='filterLogic')
          ALTER TABLE PSApprovalSettings ADD filterLogic NVARCHAR(500) NULL;
      `);
      await this.pool.request().query(`
        EXEC('UPDATE PSApprovalSettings SET approverNames = approverName WHERE approverNames IS NULL AND approverName IS NOT NULL');
        EXEC('UPDATE PSApprovalSettings SET approverEmails = approverEmail WHERE approverEmails IS NULL AND approverEmail IS NOT NULL');
      `);
      await this.pool.request().query(`
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
      // Ensure PSTsHeader has approval + submission tracking columns
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsHeader') AND name='rejectionReason')
          ALTER TABLE PSTsHeader ADD rejectionReason NVARCHAR(500) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsHeader') AND name='approvedBy')
          ALTER TABLE PSTsHeader ADD approvedBy NVARCHAR(200) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsHeader') AND name='approvedAt')
          ALTER TABLE PSTsHeader ADD approvedAt DATETIME NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsHeader') AND name='submittedAt')
          ALTER TABLE PSTsHeader ADD submittedAt DATETIME NULL;
      `);
    } catch (err) {
      this.logger.warn(`Schema init skipped (will retry on next request): ${(err as Error)?.message}`);
    }
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
   * Find the best-matching approval rule for a timesheet and check whether
   * the given userId/roleCode is authorised to approve it.
   *
   * Logic:
   *  1. Collect all rules where module matches (or module = 'ALL').
   *  2. Among those, prefer rules whose criteria match the timesheet fields.
   *  3. If the best rule has anyApprover = true → any user with canWrite can approve.
   *  4. If anyApprover = false → only users listed in approverUserIds can approve.
   *  5. If NO rule is found → fall back to canWrite permission check.
   */
  async canUserApproveTimesheet(
    userId: string,
    displayName: string,
    roleCode: string,
    ts: { tsType: string; department_code?: string; shiftCode?: string; projectId?: string; workOrderNo?: string },
    hasCanWrite: boolean,
  ): Promise<{ allowed: boolean; reason: string }> {
    const allRules = await this.list();
    const tsModule = ts.tsType === 'INST' ? 'INST' : ts.tsType === 'PROJ' ? 'PROJ' : 'PROD';

    // Filter rules that apply to this module
    const applicableRules = allRules.filter(r =>
      r.module === 'ALL' || r.module === tsModule
    );

    this.logger.debug(`[canApprove] tsType=${ts.tsType} module=${tsModule} allRules=${allRules.length} applicable=${applicableRules.length} userId=${userId} displayName="${displayName}"`);

    if (applicableRules.length === 0) {
      // No rules configured — fall back to permission-based check
      this.logger.warn(`[canApprove] No applicable rules for module=${tsModule} — falling back to canWrite (${hasCanWrite})`);
      return hasCanWrite
        ? { allowed: true,  reason: 'No approval rules configured — permission-based approval allowed.' }
        : { allowed: false, reason: 'No approval rules configured and you do not have canWrite permission.' };
    }

    // Score each rule: count how many criteria match
    const scoreRule = (rule: any): number => {
      if (!rule.criteria?.length) return 1; // no criteria = lowest priority match
      let score = 0;
      for (const c of rule.criteria) {
        const tsVal = (
          c.field === 'department'   ? ts.department_code :
          c.field === 'shift'        ? ts.shiftCode :
          c.field === 'projectNo'    ? ts.projectId :
          c.field === 'workOrderNo'  ? ts.workOrderNo : null
        )?.toString().toLowerCase() ?? '';
        const ruleVal = (c.value ?? '').toString().toLowerCase();
        const op = c.operator ?? 'equals';
        const matches =
          op === 'equals'     ? tsVal === ruleVal :
          op === 'not equals' ? tsVal !== ruleVal :
          op === 'contains'   ? tsVal.includes(ruleVal) :
          op === 'starts with'? tsVal.startsWith(ruleVal) : false;
        if (matches) score++;
        else return -1; // AND logic — all criteria must match
      }
      return score;
    };

    const scored = applicableRules
      .map(r => ({ rule: r, score: scoreRule(r) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      // Rules exist but none match the criteria — deny access.
      // Do NOT fall back to permission: the admin configured rules intentionally.
      return { allowed: false, reason: 'No approval rule matches this timesheet. Contact your administrator.' };
    }

    const best = scored[0].rule;
    this.logger.debug(`[canApprove] best rule id=${best.id} module=${best.module} anyApprover=${best.anyApprover} approverUserIds="${best.approverUserIds}" approverNames="${best.approverNames}"`);

    // Always check the designated approver list first.
    // anyApprover = true means "one of the listed approvers is sufficient" (not "anyone can approve").
    // We only fall back to anyApprover behaviour when the list is completely empty.
    const allowedIds   = this.splitTrim(best.approverUserIds);
    const allowedNames = this.splitTrim(best.approverNames);

    if (allowedIds.length > 0) {
      return allowedIds.includes(userId)
        ? { allowed: true,  reason: 'You are a designated approver for this rule.' }
        : { allowed: false, reason: 'This timesheet requires approval by a designated approver. You are not listed.' };
    }

    if (allowedNames.length > 0) {
      const nameMatch = allowedNames.some(
        n => n.toLowerCase() === (displayName ?? '').toLowerCase()
      );
      return nameMatch
        ? { allowed: true,  reason: 'You are a designated approver (matched by name).' }
        : { allowed: false, reason: `This timesheet requires approval by: ${allowedNames.join(', ')}. You are not listed.` };
    }

    // No specific approvers configured — fall back to the anyApprover flag.
    // anyApprover = true → any role-level approver with canWrite can approve.
    if (best.anyApprover) {
      return hasCanWrite
        ? { allowed: true,  reason: `Rule "${best.module}" allows any approver with permission.` }
        : { allowed: false, reason: 'You do not have approver permission on this timesheet module.' };
    }

    return { allowed: false, reason: 'No approvers are configured for this rule. Contact your administrator.' };
  }

  async remove(id: number) {
    await this.pool.request().input('id', mssql.Int, id)
      .query(`DELETE FROM PSApprovalSettings WHERE id = @id`);
  }
}
