import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class QcService implements OnModuleInit {
  private readonly logger = new Logger(QcService.name);

  constructor(
    @Inject(DEV_SQL_POOL) private readonly pool: ConnectionPool,
    private readonly s3: S3Service,
  ) {}

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
          id           BIGINT IDENTITY(1,1) PRIMARY KEY,
          qcId         BIGINT        NOT NULL,
          commentText  NVARCHAR(1000),
          authorName   NVARCHAR(150),
          authorUserId NVARCHAR(30),
          createdAt    DATETIME2     DEFAULT SYSUTCDATETIME()
        )
      `);
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PsQcComment') AND name='authorUserId')
          ALTER TABLE PsQcComment ADD authorUserId NVARCHAR(30) NULL
      `);

      await this.pool.request()
        .input('docType', mssql.NVarChar(30), 'QC')
        .query(`
          IF NOT EXISTS (SELECT 1 FROM psTsDocSequence WHERE docType = @docType)
          INSERT INTO psTsDocSequence (docType, prefix, yearNo, currentNo, sequenceDigits)
          VALUES (@docType, 'QC', 0, 0, 5)
        `);
      // Add s3Key column for attachments
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PsQcAttachment') AND name='s3Key')
          ALTER TABLE PsQcAttachment ADD s3Key NVARCHAR(500) NULL
      `);
      // Add inspector image key column
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PsQcRecord') AND name='inspectorImageKey')
          ALTER TABLE PsQcRecord ADD inspectorImageKey NVARCHAR(500) NULL
      `);
      // Verify tables exist
      const check = await this.pool.request().query<{ tbl: string }>(`
        SELECT name AS tbl FROM sysobjects
        WHERE name IN ('PsQcRecord','PsQcAttachment','PsQcComment') AND xtype='U'
      `);
      const tables = check.recordset.map(r => r.tbl).join(', ');
      this.logger.log(`QC tables ready in dev DB: ${tables}`);
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

  async getUserProfileImageKey(userId: string): Promise<string | null> {
    try {
      const res = await this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .query<{ profileImageKey: string | null }>(`SELECT profileImageKey FROM PSTsUsers WHERE userId = @userId`);
      return res.recordset[0]?.profileImageKey ?? null;
    } catch { return null; }
  }

  async getFullQcWoNumbers(): Promise<string[]> {
    const res = await this.pool.request().query(`
      SELECT DISTINCT workOrderNo
      FROM PsQcRecord
      WHERE isDeleted = 0
        AND partialFull = 'Full'
        AND workOrderNo IS NOT NULL AND workOrderNo <> ''
    `);
    return res.recordset.map((r: any) => r.workOrderNo as string);
  }

  async list(filters: { dateFrom?: string; dateTo?: string; status?: string; workOrderNo?: string } = {}) {
    let q = `SELECT id, docNo, projectCode, projectName, customerName, workOrderNo,
                    signType, qcDate, quantity, partialFull, status, qcInspector, enteredBy, createdAt
             FROM PsQcRecord WHERE isDeleted = 0`;
    const req = this.pool.request();
    if (filters.dateFrom)    { q += ` AND qcDate >= @dateFrom`;       req.input('dateFrom',    mssql.NVarChar(20),  filters.dateFrom); }
    if (filters.dateTo)      { q += ` AND qcDate <= @dateTo`;         req.input('dateTo',      mssql.NVarChar(20),  filters.dateTo); }
    if (filters.status)      { q += ` AND status = @status`;          req.input('status',      mssql.NVarChar(60),  filters.status); }
    if (filters.workOrderNo) { q += ` AND workOrderNo = @workOrderNo`; req.input('workOrderNo', mssql.NVarChar(100), filters.workOrderNo); }
    q += ` ORDER BY createdAt DESC`;
    return (await req.query(q)).recordset;
  }

  async getById(id: number) {
    const result = await this.pool.request()
      .input('id', mssql.BigInt, id)
      .query(`SELECT * FROM PsQcRecord WHERE id = @id AND isDeleted = 0`);
    const rec = result.recordset[0] ?? null;
    if (!rec) return null;

    let imageKey = rec.inspectorImageKey ?? null;

    // If no key stored yet, look up the inspector's profile image by display name (backfill)
    if (!imageKey && rec.qcInspector) {
      try {
        const userRes = await this.pool.request()
          .input('name', mssql.NVarChar(100), rec.qcInspector)
          .query<{ profileImageKey: string | null }>(`
            SELECT TOP 1 profileImageKey FROM PSTsUsers
            WHERE displayName = @name AND profileImageKey IS NOT NULL
          `);
        imageKey = userRes.recordset[0]?.profileImageKey ?? null;
        // Backfill the key so future loads skip this lookup
        if (imageKey) {
          await this.pool.request()
            .input('id',  mssql.BigInt,       id)
            .input('key', mssql.NVarChar(500), imageKey)
            .query(`UPDATE PsQcRecord SET inspectorImageKey = @key WHERE id = @id`);
        }
      } catch { /* non-critical */ }
    }

    // Generate fresh presigned URL
    if (imageKey) {
      try { rec.inspectorImageUrl = await this.s3.presignedUrl(imageKey, 3600); }
      catch { rec.inspectorImageUrl = null; }
    }
    return rec;
  }

  private assertQcFields(body: any) {
    if (!body.workOrderNo?.toString().trim())
      throw new BadRequestException('Work Order # is required.');
    if (!body.quantity || Number(body.quantity) <= 0)
      throw new BadRequestException('Quantity is required and must be greater than 0.');
    if (!body.remarks?.toString().trim())
      throw new BadRequestException('Remarks is required.');
    if (!['In Progress', 'Passed', 'Failed'].includes(body.status))
      throw new BadRequestException(`Invalid status "${body.status}". Allowed: In Progress, Passed, Failed.`);
    // Date must be today only — no past or future entries
    if (body.qcDate) {
      const today = new Date().toISOString().slice(0, 10);
      const submitted = body.qcDate.toString().slice(0, 10);
      if (submitted !== today)
        throw new BadRequestException(`QC date must be today (${today}). Past and future dates are not allowed.`);
    }

    // Validate checklist: at least one section must be active (not all N/A)
    if (body.checklistData) {
      try {
        const cl = typeof body.checklistData === 'string'
          ? JSON.parse(body.checklistData) : body.checklistData;
        const sectionNA: Record<string, boolean> = cl.__sectionNA ?? {};
        const allNA = Object.values(sectionNA).length > 0 &&
          Object.values(sectionNA).every(v => v === true);
        if (allNA) throw new BadRequestException('At least one checklist section must be active (not all N/A).');
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        // Ignore JSON parse errors — data will be stored as-is
      }
    }
  }

  async assertMinImages(qcId: number): Promise<void> {
    const res = await this.pool.request()
      .input('qcId', mssql.BigInt, qcId)
      .query<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM PsQcAttachment WHERE qcId = @qcId`);
    if ((res.recordset[0]?.cnt ?? 0) < 3)
      throw new BadRequestException('A minimum of 3 inspection photos are required before marking a QC record as Passed.');
  }

  async create(body: any, enteredBy: string): Promise<{ id: number; docNo: string }> {
    this.assertQcFields(body);
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
      .input('checklistData',    mssql.NVarChar(mssql.MAX), body.checklistData ? JSON.stringify(body.checklistData) : null)
      .input('enteredBy',         mssql.NVarChar(150),  enteredBy)
      .input('inspectorImageKey', mssql.NVarChar(500),  body.inspectorImageKey ?? null)
      .query<{ id: number }>(`
        INSERT INTO PsQcRecord
          (docNo, projectCode, projectName, customerName, workOrderNo, signType, qcDate, quantity, partialFull, status, qcInspector, remarks, checklistData, enteredBy, inspectorImageKey)
        OUTPUT INSERTED.id
        VALUES (@docNo, @projectCode, @projectName, @customerName, @workOrderNo, @signType, @qcDate, @quantity, @partialFull, @status, @qcInspector, @remarks, @checklistData, @enteredBy, @inspectorImageKey)
      `);
    return { id: ins.recordset[0].id, docNo };
  }

  async update(id: number, body: any) {
    this.assertQcFields(body);
    const current = await this.getById(id);
    if (!current) throw new BadRequestException('QC record not found.');
    // Passed records cannot be downgraded
    if (current.status === 'Passed' && body.status !== 'Passed')
      throw new BadRequestException('A Passed QC record cannot be downgraded. Create a new QC record instead.');
    // Require min 3 images when setting status to Passed
    if (body.status === 'Passed' && current.status !== 'Passed')
      await this.assertMinImages(id);
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
      .input('checklistData',    mssql.NVarChar(mssql.MAX), body.checklistData ? JSON.stringify(body.checklistData) : null)
      .input('inspectorImageKey', mssql.NVarChar(500), body.inspectorImageKey ?? current.inspectorImageKey ?? null)
      .query(`
        UPDATE PsQcRecord SET
          projectCode = @projectCode, projectName = @projectName, customerName = @customerName,
          workOrderNo = @workOrderNo, signType = @signType, qcDate = @qcDate, quantity = @quantity,
          partialFull = @partialFull, status = @status, qcInspector = @qcInspector,
          remarks = @remarks, checklistData = @checklistData,
          inspectorImageKey = @inspectorImageKey, updatedAt = SYSUTCDATETIME()
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

  async addComment(qcId: number, text: string, authorName: string, authorUserId?: string) {
    const res = await this.pool.request()
      .input('qcId',         mssql.BigInt,        qcId)
      .input('text',         mssql.NVarChar(1000), text)
      .input('authorName',   mssql.NVarChar(150),  authorName)
      .input('authorUserId', mssql.NVarChar(30),   authorUserId ?? null)
      .query<{ id: number }>(`
        INSERT INTO PsQcComment (qcId, commentText, authorName, authorUserId)
        OUTPUT INSERTED.id VALUES (@qcId, @text, @authorName, @authorUserId)
      `);
    return { id: res.recordset[0].id };
  }

  async getCommentById(commentId: number) {
    const res = await this.pool.request()
      .input('id', mssql.BigInt, commentId)
      .query(`SELECT id, qcId, authorName, authorUserId FROM PsQcComment WHERE id = @id`);
    return res.recordset[0] ?? null;
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
    if (!mimeType?.startsWith('image/'))
      throw new BadRequestException('Only image files are accepted for QC attachments.');
    const countRes = await this.pool.request()
      .input('qcId', mssql.BigInt, qcId)
      .query<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM PsQcAttachment WHERE qcId = @qcId`);
    if ((countRes.recordset[0]?.cnt ?? 0) >= 10)
      throw new BadRequestException('Maximum 10 images allowed per QC record.');

    // Upload to S3; fall back to DB storage if S3 is unavailable
    let s3Key: string | null = null;
    let dbFileData: string | null = null;
    if (this.s3.isConfigured) {
      s3Key = await this.s3.upload(`qc/${qcId}`, fileName, fileData, mimeType);
    } else {
      dbFileData = fileData;
    }

    const res = await this.pool.request()
      .input('qcId',     mssql.BigInt,             qcId)
      .input('fileName', mssql.NVarChar(250),       fileName)
      .input('mimeType', mssql.NVarChar(100),       mimeType)
      .input('fileData', mssql.NVarChar(mssql.MAX), dbFileData)
      .input('fileSize', mssql.Int,                 fileSize)
      .input('s3Key',    mssql.NVarChar(500),       s3Key)
      .query<{ id: number }>(`
        INSERT INTO PsQcAttachment (qcId, fileName, mimeType, fileData, fileSize, s3Key) OUTPUT INSERTED.id
        VALUES (@qcId, @fileName, @mimeType, @fileData, @fileSize, @s3Key)
      `);
    return { id: res.recordset[0].id, fileName };
  }

  async getAttachment(attachId: number) {
    const res = await this.pool.request()
      .input('id', mssql.BigInt, attachId)
      .query(`SELECT id, fileName, mimeType, fileSize, fileData, s3Key FROM PsQcAttachment WHERE id = @id`);
    const row = res.recordset[0];
    if (!row) return null;
    // Return S3 presigned URL or raw base64
    if (row.s3Key) {
      const url = await this.s3.presignedUrl(row.s3Key);
      return { ...row, fileData: url, isS3: true };
    }
    return row;
  }

  async removeAttachment(attachId: number) {
    const res = await this.pool.request()
      .input('id', mssql.BigInt, attachId)
      .query(`SELECT s3Key FROM PsQcAttachment WHERE id = @id`);
    const s3Key = res.recordset[0]?.s3Key;
    if (s3Key) await this.s3.delete(s3Key);
    await this.pool.request().input('id', mssql.BigInt, attachId).query(`DELETE FROM PsQcAttachment WHERE id = @id`);
    return { success: true };
  }
}
