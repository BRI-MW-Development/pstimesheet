import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class WoCompleteService implements OnModuleInit {
  private readonly logger = new Logger(WoCompleteService.name);

  constructor(
    @Inject(DEV_SQL_POOL) private readonly pool: ConnectionPool,
    private readonly s3: S3Service,
  ) {}

  async onModuleInit() {
    try {
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='PsWoComplete' AND xtype='U')
        CREATE TABLE PsWoComplete (
          id              BIGINT IDENTITY(1,1) PRIMARY KEY,
          docNo           NVARCHAR(40)  NOT NULL,
          completedDate   NVARCHAR(20),
          projectId       NVARCHAR(50),
          projectName     NVARCHAR(250),
          customerName    NVARCHAR(250),
          department      NVARCHAR(100),
          workOrderNumber NVARCHAR(100),
          workOrderStatus NVARCHAR(100),
          sourceType      NVARCHAR(50),
          status          NVARCHAR(60),
          enteredBy       NVARCHAR(150),
          remarks         NVARCHAR(500),
          createdAt       DATETIME2    DEFAULT SYSUTCDATETIME(),
          isDeleted       BIT          DEFAULT 0
        )
      `);
      await this.pool.request().query(`
        IF EXISTS (SELECT 1 FROM sysobjects WHERE name='PsWoComplete' AND xtype='U')
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PsWoComplete') AND name='status')
            ALTER TABLE PsWoComplete ADD status NVARCHAR(60);
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PsWoComplete') AND name='customerName')
            ALTER TABLE PsWoComplete ADD customerName NVARCHAR(250);
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PsWoComplete') AND name='fullOutsource')
            ALTER TABLE PsWoComplete ADD fullOutsource NVARCHAR(10) NULL;
        END
      `);
      await this.pool.request()
        .input('docType', mssql.NVarChar(30), 'WOC')
        .query(`
          IF NOT EXISTS (SELECT 1 FROM psTsDocSequence WHERE docType = @docType)
          INSERT INTO psTsDocSequence (docType, prefix, yearNo, currentNo, sequenceDigits)
          VALUES (@docType, 'WO-COMP', 0, 0, 5)
        `);
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='PsWoCompleteAttachment' AND xtype='U')
        CREATE TABLE PsWoCompleteAttachment (
          id           BIGINT IDENTITY(1,1) PRIMARY KEY,
          wocId        BIGINT        NOT NULL,
          fileName     NVARCHAR(250),
          mimeType     NVARCHAR(100),
          fileData     NVARCHAR(MAX),
          fileSize     INT,
          uploadedAt   DATETIME2     DEFAULT SYSUTCDATETIME()
        )
      `);
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PsWoCompleteAttachment') AND name='s3Key')
          ALTER TABLE PsWoCompleteAttachment ADD s3Key NVARCHAR(500) NULL
      `);
    } catch (err) {
      this.logger.warn(`Schema init skipped (will retry on next request): ${(err as Error)?.message}`);
    }
  }

  async previewDocNo(): Promise<{ docNo: string }> {
    const year = new Date().getFullYear();
    const res = await this.pool.request()
      .input('docType', mssql.NVarChar(30), 'WOC')
      .query<{ currentNo: number; prefix: string; sequenceDigits: number; yearNo: number }>(`
        SELECT currentNo, prefix, sequenceDigits, yearNo
        FROM psTsDocSequence WHERE docType = @docType
      `);
    const row = res.recordset[0];
    const next   = row ? (row.yearNo === year ? row.currentNo + 1 : 1) : 1;
    const prefix = (row?.prefix ?? 'WO-COMP').replace(/-+$/, '');
    const digits = row?.sequenceDigits ?? 5;
    return { docNo: `${prefix}-${year}-${String(next).padStart(digits, '0')}` };
  }

  async list(): Promise<any[]> {
    const res = await this.pool.request().query(`
      SELECT id, docNo, completedDate, projectId, projectName, customerName, department,
             workOrderNumber, workOrderStatus, sourceType, status, enteredBy, remarks, fullOutsource, createdAt
      FROM PsWoComplete
      WHERE isDeleted = 0
      ORDER BY createdAt DESC
    `);
    return res.recordset;
  }

  async getById(id: number): Promise<any> {
    const res = await this.pool.request()
      .input('id', mssql.BigInt, id)
      .query(`
        SELECT id, docNo, completedDate, projectId, projectName, customerName, department,
               workOrderNumber, workOrderStatus, sourceType, status, enteredBy, remarks, createdAt
        FROM PsWoComplete
        WHERE id = @id AND isDeleted = 0
      `);
    return res.recordset[0] ?? null;
  }

  async update(id: number, body: any): Promise<void> {
    this.assertWocFields(body);
    await this.assertNoDuplicateWo(body.workOrderNumber, id);
    await this.assertNoPendingTimesheets(body.workOrderNumber, body.fullOutsource);
    await this.assertQcFullCompleted(body.workOrderNumber, body.department);
    await this.pool.request()
      .input('id',              mssql.BigInt,        id)
      .input('completedDate',   mssql.NVarChar(20),  body.completedDate   || null)
      .input('projectId',       mssql.NVarChar(50),  body.projectId       || null)
      .input('projectName',     mssql.NVarChar(250), body.projectName     || null)
      .input('customerName',    mssql.NVarChar(250), body.customerName    || null)
      .input('department',      mssql.NVarChar(100), body.department      || null)
      .input('workOrderNumber', mssql.NVarChar(100), body.workOrderNumber || null)
      .input('workOrderStatus', mssql.NVarChar(100), body.workOrderStatus || null)
      .input('sourceType',      mssql.NVarChar(50),  body.sourceType      || null)
      .input('status',          mssql.NVarChar(60),  body.status          || null)
      .input('enteredBy',       mssql.NVarChar(150), body.enteredBy       || null)
      .input('remarks',         mssql.NVarChar(500), body.remarks         || null)
      .input('fullOutsource',   mssql.NVarChar(10),  body.fullOutsource   || null)
      .query(`
        UPDATE PsWoComplete SET
          completedDate   = @completedDate,
          projectId       = @projectId,
          projectName     = @projectName,
          customerName    = @customerName,
          department      = @department,
          workOrderNumber = @workOrderNumber,
          workOrderStatus = @workOrderStatus,
          sourceType      = @sourceType,
          status          = @status,
          enteredBy       = @enteredBy,
          remarks         = @remarks,
          fullOutsource   = @fullOutsource
        WHERE id = @id AND isDeleted = 0
      `);
  }

  private async assertNoPendingTimesheets(workOrderNumber: string, fullOutsource?: string): Promise<void> {
    if (!workOrderNumber) return;
    // Outsourced WOs have no internal timesheets — skip this check
    if (fullOutsource === 'Yes') return;
    const res = await this.pool.request()
      .input('wo', mssql.NVarChar(100), workOrderNumber)
      .query(`
        SELECT COUNT(*) AS cnt
        FROM PSTsHeader
        WHERE workOrderNo = @wo AND isDeleted = 0
          AND status NOT IN ('Approved', 'Rejected')
      `);
    const cnt = res.recordset[0]?.cnt ?? 0;
    if (cnt > 0) {
      throw new BadRequestException(
        `Cannot save WO Complete: ${cnt} timesheet${cnt > 1 ? 's' : ''} for Work Order "${workOrderNumber}" ${cnt > 1 ? 'are' : 'is'} not yet finalised. All timesheets must be Approved or Rejected before marking this Work Order as complete.`
      );
    }
  }

  private async assertQcFullCompleted(workOrderNumber: string, department: string): Promise<void> {
    if (!workOrderNumber) return;
    // Full QC is only required for Production department WOs
    if (!department?.toLowerCase().includes('production')) return;
    const res = await this.pool.request()
      .input('wo', mssql.NVarChar(100), workOrderNumber)
      .query(`
        SELECT COUNT(*) AS cnt FROM PsQcRecord
        WHERE workOrderNo = @wo AND isDeleted = 0 AND partialFull = 'Full'
      `);
    if ((res.recordset[0]?.cnt ?? 0) === 0) {
      throw new BadRequestException(
        `Work Order "${workOrderNumber}" does not have a Full QC inspection. Production Work Orders require a Full QC inspection before being marked as complete.`
      );
    }
  }

  private async assertNoDuplicateWo(workOrderNumber: string, excludeId?: number): Promise<void> {
    if (!workOrderNumber) return;
    const req = this.pool.request().input('wo', mssql.NVarChar(100), workOrderNumber);
    if (excludeId) req.input('excludeId', mssql.BigInt, excludeId);
    const res = await req.query(`
      SELECT COUNT(*) AS cnt
      FROM PsWoComplete
      WHERE workOrderNumber = @wo AND isDeleted = 0
        ${excludeId ? 'AND id <> @excludeId' : ''}
    `);
    const cnt = res.recordset[0]?.cnt ?? 0;
    if (cnt > 0) {
      throw new BadRequestException(
        `A WO Complete record already exists for Work Order "${workOrderNumber}". Duplicate transactions are not allowed.`
      );
    }
  }

  private assertWocFields(body: any) {
    if (!body.workOrderNumber?.toString().trim())
      throw new BadRequestException('Work Order Number is required.');
    if (!body.status?.toString().trim())
      throw new BadRequestException('Status is required.');
    if (body.completedDate) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      if (body.completedDate > todayStr)
        throw new BadRequestException('Completion date cannot be a future date.');
    }
    const isProduction = body.department?.toLowerCase().includes('production');
    if (isProduction && !['Yes', 'No'].includes(body.fullOutsource))
      throw new BadRequestException('Full Outsource (Yes/No) is required for Production Work Orders.');
  }

  async create(body: any): Promise<{ docNo: string; id: number }> {
    this.assertWocFields(body);
    await this.assertNoDuplicateWo(body.workOrderNumber);
    await this.assertNoPendingTimesheets(body.workOrderNumber, body.fullOutsource);
    await this.assertQcFullCompleted(body.workOrderNumber, body.department);
    const year = new Date().getFullYear();
    const upd = await this.pool.request()
      .input('docType', mssql.NVarChar(30), 'WOC')
      .input('yearNo',  mssql.Int, year)
      .query<{ currentNo: number; prefix: string; sequenceDigits: number }>(`
        UPDATE psTsDocSequence
        SET currentNo = CASE WHEN yearNo = @yearNo THEN currentNo + 1 ELSE 1 END,
            yearNo    = @yearNo
        OUTPUT INSERTED.currentNo, INSERTED.prefix, INSERTED.sequenceDigits
        WHERE docType = @docType
      `);
    const seq    = upd.recordset[0];
    const cleanPfx = (seq.prefix || 'WO-COMP').replace(/-+$/, '');
    const docNo  = `${cleanPfx}-${year}-${String(seq.currentNo).padStart(seq.sequenceDigits, '0')}`;

    const res = await this.pool.request()
      .input('docNo',           mssql.NVarChar(40),  docNo)
      .input('completedDate',   mssql.NVarChar(20),  body.completedDate   || null)
      .input('projectId',       mssql.NVarChar(50),  body.projectId       || null)
      .input('projectName',     mssql.NVarChar(250), body.projectName     || null)
      .input('customerName',    mssql.NVarChar(250), body.customerName    || null)
      .input('department',      mssql.NVarChar(100), body.department      || null)
      .input('workOrderNumber', mssql.NVarChar(100), body.workOrderNumber || null)
      .input('workOrderStatus', mssql.NVarChar(100), body.workOrderStatus || null)
      .input('sourceType',      mssql.NVarChar(50),  body.sourceType      || null)
      .input('status',          mssql.NVarChar(60),  body.status          || null)
      .input('enteredBy',       mssql.NVarChar(150), body.enteredBy       || null)
      .input('remarks',         mssql.NVarChar(500), body.remarks         || null)
      .input('fullOutsource',   mssql.NVarChar(10),  body.fullOutsource   || null)
      .query<{ id: number }>(`
        INSERT INTO PsWoComplete
          (docNo, completedDate, projectId, projectName, customerName, department,
           workOrderNumber, workOrderStatus, sourceType, status, enteredBy, remarks, fullOutsource)
        OUTPUT INSERTED.id
        VALUES
          (@docNo, @completedDate, @projectId, @projectName, @customerName, @department,
           @workOrderNumber, @workOrderStatus, @sourceType, @status, @enteredBy, @remarks, @fullOutsource)
      `);

    this.logger.log(`Created WO Complete ${docNo}`);
    return { docNo, id: res.recordset[0].id };
  }

  async remove(id: number): Promise<void> {
    const res = await this.pool.request()
      .input('id', mssql.BigInt, id)
      .query(`UPDATE PsWoComplete SET isDeleted = 1 WHERE id = @id`);
    if (res.rowsAffected[0] === 0) throw new Error(`WO Complete record ${id} not found`);
  }

  async addAttachment(wocId: number, fileName: string, mimeType: string, fileData: string, fileSize: number): Promise<{ id: number }> {
    const MAX_BYTES = 5 * 1024 * 1024;
    const approxBytes = fileSize ?? Math.round((fileData?.length ?? 0) * 0.75);
    if (approxBytes > MAX_BYTES)
      throw new BadRequestException(`File "${fileName}" exceeds the 5 MB size limit.`);

    let s3Key: string | null = null;
    let dbFileData: string | null = null;
    if (this.s3.isConfigured) {
      s3Key = await this.s3.upload(`woc/${wocId}`, fileName, fileData, mimeType);
    } else {
      dbFileData = fileData;
    }

    const res = await this.pool.request()
      .input('wocId',    mssql.BigInt,             wocId)
      .input('fileName', mssql.NVarChar(250),       fileName)
      .input('mimeType', mssql.NVarChar(100),       mimeType)
      .input('fileData', mssql.NVarChar(mssql.MAX), dbFileData)
      .input('fileSize', mssql.Int,                 fileSize)
      .input('s3Key',    mssql.NVarChar(500),       s3Key)
      .query<{ id: number }>(`
        INSERT INTO PsWoCompleteAttachment (wocId, fileName, mimeType, fileData, fileSize, s3Key)
        OUTPUT INSERTED.id
        VALUES (@wocId, @fileName, @mimeType, @fileData, @fileSize, @s3Key)
      `);
    return { id: res.recordset[0].id };
  }

  async listAttachments(wocId: number): Promise<any[]> {
    const res = await this.pool.request()
      .input('wocId', mssql.BigInt, wocId)
      .query(`
        SELECT id, wocId, fileName, mimeType, fileSize, uploadedAt
        FROM PsWoCompleteAttachment
        WHERE wocId = @wocId
        ORDER BY uploadedAt ASC
      `);
    return res.recordset;
  }

  async getAttachment(id: number): Promise<any> {
    const res = await this.pool.request()
      .input('id', mssql.BigInt, id)
      .query(`SELECT id, fileName, mimeType, fileData, s3Key FROM PsWoCompleteAttachment WHERE id = @id`);
    const row = res.recordset[0];
    if (!row) return null;
    if (row.s3Key) {
      try {
        const base64 = await this.s3.getAsBase64(row.s3Key, row.mimeType || 'application/octet-stream');
        return { ...row, fileData: base64 };
      } catch {
        return null;
      }
    }
    return row;
  }

  async removeAttachment(id: number): Promise<void> {
    const res = await this.pool.request()
      .input('id', mssql.BigInt, id)
      .query(`SELECT s3Key FROM PsWoCompleteAttachment WHERE id = @id`);
    const s3Key = res.recordset[0]?.s3Key;
    if (s3Key) await this.s3.delete(s3Key);
    await this.pool.request()
      .input('id', mssql.BigInt, id)
      .query(`DELETE FROM PsWoCompleteAttachment WHERE id = @id`);
  }
}
