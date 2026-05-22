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

  async remove(id: number) {
    await this.pool.request().input('id', mssql.Int, id)
      .query(`DELETE FROM PSApprovalSettings WHERE id = @id`);
  }
}
