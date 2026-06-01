import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';

@Injectable()
export class QcService implements OnModuleInit {
  private readonly logger = new Logger(QcService.name);

  constructor(@Inject(DEV_SQL_POOL) private readonly pool: ConnectionPool) {}

  async onModuleInit() {
    try {
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='PsQcRecord' AND xtype='U')
        CREATE TABLE PsQcRecord (
          id            BIGINT IDENTITY(1,1) PRIMARY KEY,
          docNo         NVARCHAR(40)   NOT NULL,
          projectCode   NVARCHAR(50),
          projectName   NVARCHAR(250),
          customerName  NVARCHAR(250),
          workOrderNo   NVARCHAR(100),
          signType      NVARCHAR(100),
          qcDate        NVARCHAR(20),
          quantity      INT,
          partialFull   NVARCHAR(20),
          status        NVARCHAR(60)   DEFAULT 'Draft',
          qcInspector   NVARCHAR(150),
          remarks       NVARCHAR(500),
          checklistData NVARCHAR(MAX),
          enteredBy     NVARCHAR(150),
          createdAt     DATETIME2      DEFAULT SYSUTCDATETIME(),
          updatedAt     DATETIME2      DEFAULT SYSUTCDATETIME(),
          isDeleted     BIT            DEFAULT 0
        )
      `);
      // Migrate existing table — add columns if missing
      const cols = ['signType NVARCHAR(100)', 'quantity INT', 'partialFull NVARCHAR(20)', 'checklistData NVARCHAR(MAX)'];
      for (const col of cols) {
        const name = col.split(' ')[0];
        await this.pool.request().query(`
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PsQcRecord') AND name='${name}')
            ALTER TABLE PsQcRecord ADD ${col}
        `);
      }

      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='PsQcAttachment' AND xtype='U')
        CREATE TABLE PsQcAttachment (
          id          BIGINT IDENTITY(1,1) PRIMARY KEY,
          qcId        BIGINT        NOT NULL,
          fileName    NVARCHAR(250),
          mimeType    NVARCHAR(100),
          fileData    NVARCHAR(MAX),
          fileSize    INT,
          uploadedAt  DATETIME2     DEFAULT SYSUTCDATETIME()
        )
      `);

      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='PsQcComment' AND xtype='U')
        CREATE TABLE PsQcComment (
          id          BIGINT IDENTITY(1,1) PRIMARY KEY,
          qcId        BIGINT        NOT NULL,
          commentText NVARCHAR(1000),
          authorName  NVARCHAR(150),
          createdAt   DATETIME2     DEFAULT SYSUTCDATETIME()
        )
      `);

      await this.pool.request()
        .input('docType', mssql.NVarChar(30), 'QC')
        .query(`
          IF NOT EXISTS (SELECT 1 FROM psTsDocSequence WHERE docType = @docType)
          INSERT INTO psTsDocSequence (docType, prefix, yearNo, currentNo, sequenceDigits)
          VALUES (@docType, 'QC', 0, 0, 5)
        `);
    } catch (err) {
      this.logger.warn(`QC schema init skipped: ${(err as Error)?.message}`);
    }
  }

  async previewDocNo(): Promise<{ docNo: string }> {
    const year = new Date().getFullYear();
    const res = await this.pool.request()
      .input('docType', mssql.NVarChar(30), 'QC')
      .query<{ currentNo: number; prefix: string; sequenceDigits: number; yearNo: number }>(`
        SELECT currentNo, prefix, sequenceDigits, yearNo FROM psTsDocSequence WHERE docType = @docType
      `);
    const row = res.recordset[0];
    const next   = row ? (row.yearNo === year ? row.currentNo + 1 : 1) : 1;
    const prefix = (row?.prefix ?? 'QC').replace(/-+$/, '');
    const digits = row?.sequenceDigits ?? 5;
    return { docNo: `${prefix}-${year}-${String(next).padStart(digits, '0')}` };
  }

  async list(filters: { dateFrom?: string; dateTo?: string; status?: string } = {}) {
    let q = `SELECT id, docNo, projectCode, projectName, customerName, workOrderNo,
                    signType, qcDate, quantity, partialFull, status, qcInspector, enteredBy, createdAt
             FROM PsQcRecord WHERE isDeleted = 0`;
    const req = this.pool.request();
    if (filters.dateFrom) { q += ` AND qcDate >= @dateFrom`; req.input('dateFrom', mssql.NVarChar(20), filters.dateFrom); }
    if (filters.dateTo)   { q += ` AND qcDate <= @dateTo`;   req.input('dateTo',   mssql.NVarChar(20), filters.dateTo); }
    if (filters.status)   { q += ` AND status = @status`;    req.input('status',   mssql.NVarChar(60), filters.status); }
    q += ` ORDER BY createdAt DESC`;
    return (await req.query(q)).recordset;
  }

  async getById(id: number) {
    const result = await this.pool.request()
      .input('id', mssql.BigInt, id)
      .query(`SELECT * FROM PsQcRecord WHERE id = @id AND isDeleted = 0`);
    return result.recordset[0] ?? null;
  }

  async create(body: any, enteredBy: string): Promise<{ id: number; docNo: string }> {
    const year = new Date().getFullYear();
    const seqRes = await this.pool.request()
      .input('docType', mssql.NVarChar(30), 'QC')
      .query<{ currentNo: number; prefix: string; sequenceDigits: number; yearNo: number }>(`
        SELECT currentNo, prefix, sequenceDigits, yearNo FROM psTsDocSequence WHERE docType = @docType
      `);
    const row    = seqRes.recordset[0];
    const next   = row ? (row.yearNo === year ? row.currentNo + 1 : 1) : 1;
    const prefix = (row?.prefix ?? 'QC').replace(/-+$/, '');
    const digits = row?.sequenceDigits ?? 5;
    const docNo  = `${prefix}-${year}-${String(next).padStart(digits, '0')}`;

    await this.pool.request()
      .input('docType', mssql.NVarChar(30), 'QC')
      .input('next', mssql.Int, next)
      .input('year', mssql.Int, year)
      .query(`UPDATE psTsDocSequence SET currentNo = @next, yearNo = @year WHERE docType = @docType`);

    const ins = await this.pool.request()
      .input('docNo',         mssql.NVarChar(40),   docNo)
      .input('projectCode',   mssql.NVarChar(50),   body.projectCode   ?? null)
      .input('projectName',   mssql.NVarChar(250),  body.projectName   ?? null)
      .input('customerName',  mssql.NVarChar(250),  body.customerName  ?? null)
      .input('workOrderNo',   mssql.NVarChar(100),  body.workOrderNo   ?? null)
      .input('signType',      mssql.NVarChar(100),  body.signType      ?? null)
      .input('qcDate',        mssql.NVarChar(20),   body.qcDate        ?? null)
      .input('quantity',      mssql.Int,            body.quantity      ?? null)
      .input('partialFull',   mssql.NVarChar(20),   body.partialFull   ?? null)
      .input('status',        mssql.NVarChar(60),   body.status        ?? 'Draft')
      .input('qcInspector',   mssql.NVarChar(150),  body.qcInspector   ?? null)
      .input('remarks',       mssql.NVarChar(500),  body.remarks       ?? null)
      .input('checklistData', mssql.NVarChar(mssql.MAX), body.checklistData ? JSON.stringify(body.checklistData) : null)
      .input('enteredBy',     mssql.NVarChar(150),  enteredBy)
      .query<{ id: number }>(`
        INSERT INTO PsQcRecord
          (docNo, projectCode, projectName, customerName, workOrderNo, signType, qcDate, quantity, partialFull, status, qcInspector, remarks, checklistData, enteredBy)
        OUTPUT INSERTED.id
        VALUES (@docNo, @projectCode, @projectName, @customerName, @workOrderNo, @signType, @qcDate, @quantity, @partialFull, @status, @qcInspector, @remarks, @checklistData, @enteredBy)
      `);
    return { id: ins.recordset[0].id, docNo };
  }

  async update(id: number, body: any) {
    await this.pool.request()
      .input('id',            mssql.BigInt,         id)
      .input('projectCode',   mssql.NVarChar(50),   body.projectCode   ?? null)
      .input('projectName',   mssql.NVarChar(250),  body.projectName   ?? null)
      .input('customerName',  mssql.NVarChar(250),  body.customerName  ?? null)
      .input('workOrderNo',   mssql.NVarChar(100),  body.workOrderNo   ?? null)
      .input('signType',      mssql.NVarChar(100),  body.signType      ?? null)
      .input('qcDate',        mssql.NVarChar(20),   body.qcDate        ?? null)
      .input('quantity',      mssql.Int,            body.quantity      ?? null)
      .input('partialFull',   mssql.NVarChar(20),   body.partialFull   ?? null)
      .input('status',        mssql.NVarChar(60),   body.status        ?? null)
      .input('qcInspector',   mssql.NVarChar(150),  body.qcInspector   ?? null)
      .input('remarks',       mssql.NVarChar(500),  body.remarks       ?? null)
      .input('checklistData', mssql.NVarChar(mssql.MAX), body.checklistData ? JSON.stringify(body.checklistData) : null)
      .query(`
        UPDATE PsQcRecord SET
          projectCode = @projectCode, projectName = @projectName, customerName = @customerName,
          workOrderNo = @workOrderNo, signType = @signType, qcDate = @qcDate, quantity = @quantity,
          partialFull = @partialFull, status = @status, qcInspector = @qcInspector,
          remarks = @remarks, checklistData = @checklistData, updatedAt = SYSUTCDATETIME()
        WHERE id = @id AND isDeleted = 0
      `);
  }

  async remove(id: number) {
    await this.pool.request()
      .input('id', mssql.BigInt, id)
      .query(`UPDATE PsQcRecord SET isDeleted = 1 WHERE id = @id`);
    return { success: true };
  }

  // ── Comments ──────────────────────────────────────────
  async listComments(qcId: number) {
    const res = await this.pool.request()
      .input('qcId', mssql.BigInt, qcId)
      .query(`SELECT id, commentText, authorName, createdAt FROM PsQcComment WHERE qcId = @qcId ORDER BY createdAt ASC`);
    return res.recordset;
  }

  async addComment(qcId: number, text: string, authorName: string) {
    const res = await this.pool.request()
      .input('qcId',       mssql.BigInt,         qcId)
      .input('text',       mssql.NVarChar(1000),  text)
      .input('authorName', mssql.NVarChar(150),   authorName)
      .query<{ id: number }>(`
        INSERT INTO PsQcComment (qcId, commentText, authorName) OUTPUT INSERTED.id VALUES (@qcId, @text, @authorName)
      `);
    return { id: res.recordset[0].id };
  }

  async deleteComment(commentId: number) {
    await this.pool.request().input('id', mssql.BigInt, commentId).query(`DELETE FROM PsQcComment WHERE id = @id`);
    return { success: true };
  }

  // ── Attachments ───────────────────────────────────────
  async listAttachments(qcId: number) {
    const result = await this.pool.request()
      .input('qcId', mssql.BigInt, qcId)
      .query(`SELECT id, fileName, mimeType, fileSize, uploadedAt FROM PsQcAttachment WHERE qcId = @qcId ORDER BY uploadedAt DESC`);
    return result.recordset;
  }

  async addAttachment(qcId: number, fileName: string, mimeType: string, fileData: string, fileSize: number) {
    const res = await this.pool.request()
      .input('qcId',     mssql.BigInt,              qcId)
      .input('fileName', mssql.NVarChar(250),        fileName)
      .input('mimeType', mssql.NVarChar(100),        mimeType)
      .input('fileData', mssql.NVarChar(mssql.MAX),  fileData)
      .input('fileSize', mssql.Int,                  fileSize)
      .query<{ id: number }>(`
        INSERT INTO PsQcAttachment (qcId, fileName, mimeType, fileData, fileSize) OUTPUT INSERTED.id
        VALUES (@qcId, @fileName, @mimeType, @fileData, @fileSize)
      `);
    return { id: res.recordset[0].id, fileName };
  }

  async getAttachment(attachId: number) {
    const res = await this.pool.request()
      .input('id', mssql.BigInt, attachId)
      .query(`SELECT * FROM PsQcAttachment WHERE id = @id`);
    return res.recordset[0] ?? null;
  }

  async removeAttachment(attachId: number) {
    await this.pool.request().input('id', mssql.BigInt, attachId).query(`DELETE FROM PsQcAttachment WHERE id = @id`);
    return { success: true };
  }
}
