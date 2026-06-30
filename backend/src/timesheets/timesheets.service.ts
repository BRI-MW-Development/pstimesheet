import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool, Transaction } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL, SQL_POOL } from '../database/database.constants';
import { S3Service } from '../s3/s3.service';

const n = (v: any) => (v === '' || v === undefined ? null : v ?? null);

function hmToMinutes(hm: string | null | undefined): number {
  if (!hm) return 0;
  const [h, m] = hm.split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function minutesToHm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function calcDurationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (isNaN(sh) || isNaN(eh)) return null;
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  return mins;
}

function toHM(v: any): string | null {
  if (v == null) return null;
  if (typeof v === 'object' && typeof v.getUTCHours === 'function') {
    return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`;
  }
  const s = String(v);
  // ISO string like "1970-01-01T08:00:00.000Z"
  if (s.includes('T')) return s.split('T')[1]?.slice(0, 5) ?? null;
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function toDateStr(v: any): string | null {
  if (v == null) return null;
  if (typeof v === 'object' && typeof v.getUTCFullYear === 'function') {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v);
  // ISO string like "2026-05-08T00:00:00.000Z"
  if (s.includes('T')) return s.split('T')[0];
  return s.length >= 10 ? s.slice(0, 10) : s;
}

@Injectable()
export class TimesheetsService implements OnModuleInit {
  private readonly logger = new Logger(TimesheetsService.name);

  constructor(
    @Inject(DEV_SQL_POOL) private readonly devPool: ConnectionPool,
    @Inject(SQL_POOL)     private readonly livePool: ConnectionPool,
    private readonly s3: S3Service,
  ) {}

  async onModuleInit() {
    try {
      // Ensure sequence table exists with all required columns
      await this.devPool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='psTsDocSequence' AND xtype='U')
        CREATE TABLE psTsDocSequence (
          docType        NVARCHAR(30) NOT NULL PRIMARY KEY,
          prefix         NVARCHAR(30) NOT NULL,
          yearNo         INT          NOT NULL DEFAULT 0,
          currentNo      INT          NOT NULL DEFAULT 0,
          sequenceDigits INT          NOT NULL DEFAULT 5
        );
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('psTsDocSequence') AND name='sequenceDigits')
          ALTER TABLE psTsDocSequence ADD sequenceDigits INT NOT NULL DEFAULT 5;
      `);
      // Seed default rows for all four doc types if missing
      await this.devPool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM psTsDocSequence WHERE docType='PROD')
          INSERT INTO psTsDocSequence (docType,prefix,yearNo,currentNo,sequenceDigits) VALUES ('PROD','TS-PROD',0,0,5);
        IF NOT EXISTS (SELECT 1 FROM psTsDocSequence WHERE docType='INST')
          INSERT INTO psTsDocSequence (docType,prefix,yearNo,currentNo,sequenceDigits) VALUES ('INST','TS-INST',0,0,5);
        IF NOT EXISTS (SELECT 1 FROM psTsDocSequence WHERE docType='PROJ')
          INSERT INTO psTsDocSequence (docType,prefix,yearNo,currentNo,sequenceDigits) VALUES ('PROJ','TS-PROJ',0,0,5);
        IF NOT EXISTS (SELECT 1 FROM psTsDocSequence WHERE docType='WOC')
          INSERT INTO psTsDocSequence (docType,prefix,yearNo,currentNo,sequenceDigits) VALUES ('WOC','WO-COMP',0,0,5);
      `);
      await this.devPool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsHeader') AND name='entered_by_user_id')
          ALTER TABLE PSTsHeader ADD entered_by_user_id NVARCHAR(50) NULL;
      `);
      // Widen itemName to NVARCHAR(MAX) — ERP item descriptions can be very long
      await this.devPool.request().query(`
        IF EXISTS (
          SELECT 1 FROM sys.columns
          WHERE object_id = OBJECT_ID('PSTsMaterialLine')
            AND name = 'itemName'
            AND max_length != -1
        )
          ALTER TABLE PSTsMaterialLine ALTER COLUMN itemName NVARCHAR(MAX) NULL;
      `);
      // Widen itemCode to NVARCHAR(100) — some ERP item codes exceed 60 chars
      await this.devPool.request().query(`
        IF EXISTS (
          SELECT 1 FROM sys.columns
          WHERE object_id = OBJECT_ID('PSTsMaterialLine')
            AND name = 'itemCode'
            AND max_length != -1
            AND max_length < 200
        )
          ALTER TABLE PSTsMaterialLine ALTER COLUMN itemCode NVARCHAR(100) NULL;
      `);
      // Widen PSTsHeader.workOrderNo to NVARCHAR(100) — ERP WO numbers can exceed 60 chars
      await this.devPool.request().query(`
        IF EXISTS (
          SELECT 1 FROM sys.columns
          WHERE object_id = OBJECT_ID('PSTsHeader')
            AND name = 'workOrderNo'
            AND max_length < 200
        )
          ALTER TABLE PSTsHeader ALTER COLUMN workOrderNo NVARCHAR(100) NULL;
      `);
      // Widen PSTsLabourLine.employeeCode to NVARCHAR(100)
      await this.devPool.request().query(`
        IF EXISTS (
          SELECT 1 FROM sys.columns
          WHERE object_id = OBJECT_ID('PSTsLabourLine')
            AND name = 'employeeCode'
            AND max_length < 200
        )
          ALTER TABLE PSTsLabourLine ALTER COLUMN employeeCode NVARCHAR(100) NULL;
      `);
      // Add per-line project, task type, and comments for PROJ timesheets (split into individual queries)
      await this.devPool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsLabourLine') AND name='projectId')
          ALTER TABLE PSTsLabourLine ADD projectId NVARCHAR(50) NULL;
      `);
      await this.devPool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsLabourLine') AND name='taskTypeCode')
          ALTER TABLE PSTsLabourLine ADD taskTypeCode NVARCHAR(30) NULL;
      `);
      await this.devPool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsLabourLine') AND name='comments')
          ALTER TABLE PSTsLabourLine ADD comments NVARCHAR(500) NULL;
      `);
      // Attachment table for PROJ timesheet lines
      await this.devPool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='PSTsProjLineAttachment' AND xtype='U')
        CREATE TABLE PSTsProjLineAttachment (
          id         INT IDENTITY(1,1) PRIMARY KEY,
          tsId       BIGINT NOT NULL,
          lineNumber INT NOT NULL,
          fileName   NVARCHAR(260) NOT NULL,
          mimeType   NVARCHAR(100) NULL,
          fileSize   INT NULL,
          fileData   NVARCHAR(MAX) NULL,
          s3Key      NVARCHAR(500) NULL,
          uploadedAt DATETIME DEFAULT GETDATE()
        );
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsProjLineAttachment') AND name='s3Key')
          ALTER TABLE PSTsProjLineAttachment ADD s3Key NVARCHAR(500) NULL;
      `);
    } catch (err) {
      this.logger.warn(`Schema init skipped (will retry on next request): ${(err as Error)?.message}`);
    }

  }

  // Normalize prefix: strip any trailing dash so doc format is always PREFIX-YEAR-SEQ
  private normalizePrefix(raw: string): string {
    return (raw || '').replace(/-+$/, '');
  }

  // ── Doc number via sequence table ──────────────────────────────
  private async nextDocNo(docType: string, fallbackPrefix: string, yearNo: number): Promise<string> {
    const upd = await this.devPool.request()
      .input('docType', mssql.NVarChar(30), docType)
      .input('yearNo',  mssql.Int, yearNo)
      .query<{ currentNo: number; prefix: string; sequenceDigits: number }>(`
        UPDATE psTsDocSequence
        SET    currentNo = CASE WHEN yearNo = @yearNo THEN currentNo + 1 ELSE 1 END,
               yearNo    = @yearNo
        OUTPUT INSERTED.currentNo, INSERTED.prefix, INSERTED.sequenceDigits
        WHERE  docType = @docType
      `);

    let seq: number;
    let prefix: string;
    let digits: number;
    if (upd.recordset.length > 0) {
      seq    = upd.recordset[0].currentNo;
      prefix = this.normalizePrefix(upd.recordset[0].prefix || fallbackPrefix);
      digits = upd.recordset[0].sequenceDigits ?? 5;
    } else {
      // Row missing entirely — bootstrap it
      const ins = await this.devPool.request()
        .input('docType', mssql.NVarChar(30), docType)
        .input('prefix',  mssql.NVarChar(30), this.normalizePrefix(fallbackPrefix))
        .input('yearNo',  mssql.Int, yearNo)
        .query<{ currentNo: number; prefix: string; sequenceDigits: number }>(`
          INSERT INTO psTsDocSequence (docType, prefix, yearNo, currentNo, sequenceDigits)
          OUTPUT INSERTED.currentNo, INSERTED.prefix, INSERTED.sequenceDigits
          VALUES (@docType, @prefix, @yearNo, 1, 5)
        `);
      seq    = ins.recordset[0]?.currentNo      ?? 1;
      prefix = this.normalizePrefix(ins.recordset[0]?.prefix ?? fallbackPrefix);
      digits = ins.recordset[0]?.sequenceDigits ?? 5;
    }
    return `${prefix}-${yearNo}-${String(seq).padStart(digits, '0')}`;
  }

  // ── Preview next doc number (read-only, no sequence increment) ──
  async previewDocNo(tsType: string): Promise<{ docNo: string }> {
    const type   = (tsType || 'PROD').toUpperCase();
    const fallback = type === 'INST' ? 'TS-INST' : type === 'PROJ' ? 'TS-PROJ' : 'TS-PROD';
    const year   = new Date().getFullYear();
    const res    = await this.devPool.request()
      .input('docType', mssql.NVarChar(30), type)
      .query<{ currentNo: number; prefix: string; sequenceDigits: number; yearNo: number }>(`
        SELECT currentNo, prefix, sequenceDigits, yearNo FROM psTsDocSequence
        WHERE  docType = @docType
      `);
    const row    = res.recordset[0];
    const next   = row ? (row.yearNo === year ? row.currentNo + 1 : 1) : 1;
    const pfx    = this.normalizePrefix(row?.prefix || fallback);
    const digits = row?.sequenceDigits ?? 5;
    return { docNo: `${pfx}-${year}-${String(next).padStart(digits, '0')}` };
  }

  // ── Document Numbering settings ─────────────────────────────────
  async getDocNumberingSettings(): Promise<any[]> {
    const res = await this.devPool.request()
      .query<{ docType: string; prefix: string; yearNo: number; currentNo: number; sequenceDigits: number }>(`
        SELECT docType, prefix, yearNo, currentNo, sequenceDigits
        FROM   psTsDocSequence
        ORDER BY docType
      `);
    // Always return normalized prefix (no trailing dash) so frontend is consistent
    return res.recordset.map((r) => ({ ...r, prefix: this.normalizePrefix(r.prefix) }));
  }

  async updateDocNumberingSettings(rows: { docType: string; prefix: string; sequenceDigits: number }[]): Promise<void> {
    for (const row of rows) {
      const cleanPrefix = this.normalizePrefix(row.prefix);
      await this.devPool.request()
        .input('docType',        mssql.NVarChar(30), row.docType)
        .input('prefix',         mssql.NVarChar(30), cleanPrefix)
        .input('sequenceDigits', mssql.Int,           row.sequenceDigits)
        .query(`
          IF EXISTS (SELECT 1 FROM psTsDocSequence WHERE docType = @docType)
            UPDATE psTsDocSequence SET prefix = @prefix, sequenceDigits = @sequenceDigits WHERE docType = @docType
          ELSE
            INSERT INTO psTsDocSequence (docType, prefix, yearNo, currentNo, sequenceDigits)
            VALUES (@docType, @prefix, 0, 0, @sequenceDigits)
        `);
    }
  }

  // ── Live DB: batch employee lookup ─────────────────────────────
  private async batchLookupEmployees(codes: string[]): Promise<Map<string, { name: string; dept: string; designation: string }>> {
    const unique = [...new Set(codes.filter(Boolean).map(c => String(c).slice(0, 100)))];
    const empty = { name: '', dept: '', designation: '' };
    const map = new Map<string, typeof empty>();
    if (!unique.length) return map;
    try {
      const list = unique.map(c => `'${c.replace(/'/g, "''")}'`).join(',');
      const r = await this.livePool.request()
        .query<{ employeeNo: string; firstName: string; lastname: string; departmentCode: string; designation: string }>(`
          SELECT me.employeeNo,
                 me.firstName, me.lastname,
                 md.departmentCode,
                 mt.taxnomyName AS designation
          FROM   ErpMasterEmployee me
          LEFT JOIN ErpMasterDepartment md ON md.departmentId = me.departmentId
          LEFT JOIN ErpMasterTaxnomy    mt ON mt.taxnomyId    = me.jobTitleId
          WHERE  me.employeeNo IN (${list}) AND me.isDeleted = 0
        `);
      for (const e of r.recordset) {
        map.set(e.employeeNo, {
          name:        [e.firstName, e.lastname].filter(Boolean).join(' '),
          dept:        e.departmentCode  ?? '',
          designation: e.designation     ?? '',
        });
      }
    } catch (err) {
      this.logger.warn(`batchLookupEmployees failed: ${(err as Error)?.message}`);
    }
    return map;
  }

  // ── Live DB: batch item lookup ──────────────────────────────────
  private async batchLookupItems(codes: string[]): Promise<Map<string, { name: string; uom: string }>> {
    const unique = [...new Set(codes.filter(Boolean).map(c => String(c).slice(0, 100)))];
    const map = new Map<string, { name: string; uom: string }>();
    if (!unique.length) return map;
    try {
      const list = unique.map(c => `'${c.replace(/'/g, "''")}'`).join(',');
      const r = await this.livePool.request()
        .query<{ itemcode: string; itemName: string; UOM: string }>(`
          SELECT mi.itemcode, mi.itemName, mt.taxnomyCode AS UOM
          FROM   ErpMasterItem    mi
          LEFT JOIN ErpMasterTaxnomy mt ON mt.taxnomyId = mi.uomId
          WHERE  mi.itemcode IN (${list}) AND mi.isActive = 1
        `);
      for (const item of r.recordset) {
        map.set(item.itemcode, { name: item.itemName ?? '', uom: item.UOM ?? '' });
      }
    } catch (err) {
      this.logger.warn(`batchLookupItems failed: ${(err as Error)?.message}`);
    }
    return map;
  }

  // ── Insert lines helper (used by create & update) ───────────────
  private async insertLines(tx: Transaction, tsId: number, body: any): Promise<void> {
    const labourRows: any[] = body.labourRows ?? [];
    const materialRows: any[] = body.materialRows ?? [];
    this.logger.debug(`[insertLines] tsId=${tsId} rows=${labourRows.length}`);

    // Batch-fetch all employee and item data in one query each (C-1)
    const empCodes  = labourRows.map(r => r.employee).filter(Boolean);
    const itemCodes = materialRows.map(r => r.itemCode).filter(Boolean);
    const [empMap, itemMap] = await Promise.all([
      this.batchLookupEmployees(empCodes),
      this.batchLookupItems(itemCodes),
    ]);
    const empty = { name: '', dept: '', designation: '' };

    for (let i = 0; i < labourRows.length; i++) {
      const lr = labourRows[i];
      if (!lr.employee && !lr.employeeName) continue;
      const emp = lr.employee ? (empMap.get(lr.employee) ?? empty) : empty;
      await tx.request()
        .input('tsId',           mssql.BigInt,        tsId)
        .input('lineNumber',     mssql.Int,           i + 1)
        .input('employeeCode',   mssql.NVarChar(100), lr.employee   || null)
        .input('employeeName',   mssql.NVarChar(200), emp.name      || lr.employeeName || lr.employee || null)
        .input('departmentCode', mssql.NVarChar(50),  emp.dept      || null)
        .input('designation',    mssql.NVarChar(100), emp.designation || null)
        .input('startTime',      mssql.NVarChar(10),  lr.startTime || null)
        .input('endTime',        mssql.NVarChar(10),  lr.endTime   || null)
        .input('durationMinutes',mssql.Int,           parseInt(lr.durationMinutes ?? lr.duration, 10) || 0)
        .input('lineProjectId',  mssql.NVarChar(50),  lr.projectId    || null)
        .input('taskTypeCode',   mssql.NVarChar(30),  lr.taskTypeCode || null)
        .input('lineComments',   mssql.NVarChar(500), lr.comments     || null)
        .query(`
          INSERT INTO PSTsLabourLine
            (tsId, lineNumber, employeeCode, employeeName, departmentCode,
             designation, startTime, endTime, durationMinutes, projectId, taskTypeCode, comments)
          VALUES
            (@tsId, @lineNumber, @employeeCode, @employeeName, @departmentCode,
             @designation, @startTime, @endTime, @durationMinutes, @lineProjectId, @taskTypeCode, @lineComments)
        `);

      // Save attachment for PROJ lines — upload to S3 if available, otherwise store in DB
      if (lr.attachment?.fileData) {
        let s3Key: string | null = null;
        let dbFileData: string | null = null;
        if (this.s3.isConfigured) {
          s3Key = await this.s3.upload(
            `proj-ts/${tsId}`,
            lr.attachment.fileName || 'attachment',
            lr.attachment.fileData,
            lr.attachment.mimeType || 'application/octet-stream',
          );
        } else {
          dbFileData = lr.attachment.fileData;
        }
        await tx.request()
          .input('tsId',       mssql.BigInt,              tsId)
          .input('lineNumber', mssql.Int,                 i + 1)
          .input('fileName',   mssql.NVarChar(260),       lr.attachment.fileName || 'attachment')
          .input('mimeType',   mssql.NVarChar(100),       lr.attachment.mimeType || null)
          .input('fileSize',   mssql.Int,                 lr.attachment.fileSize || 0)
          .input('fileData',   mssql.NVarChar(mssql.MAX), dbFileData)
          .input('s3Key',      mssql.NVarChar(500),       s3Key)
          .query(`
            INSERT INTO PSTsProjLineAttachment (tsId, lineNumber, fileName, mimeType, fileSize, fileData, s3Key)
            VALUES (@tsId, @lineNumber, @fileName, @mimeType, @fileSize, @fileData, @s3Key)
          `);
      }
    }

    for (let i = 0; i < materialRows.length; i++) {
      const mr = materialRows[i];
      if (!mr.itemCode && !mr.description) continue;
      const item = mr.itemCode ? (itemMap.get(mr.itemCode) ?? { name: '', uom: '' }) : { name: '', uom: '' };
      await tx.request()
        .input('tsId',     mssql.BigInt,        tsId)
        .input('lineNumber', mssql.Int,          i + 1)
        .input('itemCode', mssql.NVarChar(100),       mr.itemCode || null)
        .input('itemName', mssql.NVarChar(mssql.MAX), item.name || mr.description || null)
        .input('uom',      mssql.NVarChar(30),  mr.uom ?? item.uom ?? null)
        .input('qty',      mssql.Decimal(18,3), parseFloat(mr.qty) || 0)
        .query(`
          INSERT INTO PSTsMaterialLine (tsId, lineNumber, itemCode, itemName, uom, qty)
          VALUES (@tsId, @lineNumber, @itemCode, @itemName, @uom, @qty)
        `);
    }

    let eqLineNo = 0;
    const machineryRows: any[] = body.machineryRows ?? [];
    for (const mr of machineryRows) {
      const machineName = mr.machineName ?? mr.machine;
      if (!machineName) continue;
      eqLineNo++;
      await tx.request()
        .input('tsId',          mssql.BigInt,        tsId)
        .input('lineNumber',    mssql.Int,           eqLineNo)
        .input('lineType',      mssql.NVarChar(20),  'MACHINERY')
        .input('equipmentName', mssql.NVarChar(250), machineName)
        .input('hoursUsed',     mssql.Int,           parseInt(mr.minutes ?? mr.hours, 10) || 0)
        .query(`
          INSERT INTO PSTsEquipmentLine (tsId, lineNumber, lineType, equipmentName, hoursUsed)
          VALUES (@tsId, @lineNumber, @lineType, @equipmentName, @hoursUsed)
        `);
    }

    const vehicleRows: any[] = body.vehicleRows ?? [];
    for (const vr of vehicleRows) {
      if (!vr.vehicle) continue;
      eqLineNo++;
      await tx.request()
        .input('tsId',          mssql.BigInt,        tsId)
        .input('lineNumber',    mssql.Int,           eqLineNo)
        .input('lineType',      mssql.NVarChar(20),  'VEHICLE')
        .input('equipmentName', mssql.NVarChar(250), vr.vehicle)
        .input('hoursUsed',     mssql.Int,           parseInt(vr.km, 10) || 0)
        .query(`
          INSERT INTO PSTsEquipmentLine (tsId, lineNumber, lineType, equipmentName, hoursUsed)
          VALUES (@tsId, @lineNumber, @lineType, @equipmentName, @hoursUsed)
        `);
    }

    const accessRows: any[] = body.accessRows ?? [];
    for (const ar of accessRows) {
      if (!ar.equipment) continue;
      eqLineNo++;
      await tx.request()
        .input('tsId',          mssql.BigInt,        tsId)
        .input('lineNumber',    mssql.Int,           eqLineNo)
        .input('lineType',      mssql.NVarChar(20),  'ACCESS')
        .input('equipmentName', mssql.NVarChar(250), ar.equipment)
        .input('hoursUsed',     mssql.Int,           parseInt(ar.hours, 10) || 0)
        .query(`
          INSERT INTO PSTsEquipmentLine (tsId, lineNumber, lineType, equipmentName, hoursUsed)
          VALUES (@tsId, @lineNumber, @lineType, @equipmentName, @hoursUsed)
        `);
    }
  }

  // ── Create ──────────────────────────────────────────────────────
  async create(body: any): Promise<{ docNo: string; tsId: number }> {
    const year    = new Date().getFullYear();
    const tsType  = (body.tsType || 'PROD').toUpperCase();

    // Mandatory field validation for Production and Installation timesheets
    if (tsType === 'PROD' || tsType === 'INST') {
      if (!body.projectId?.toString().trim())  throw new BadRequestException('Project ID is required.');
      if (!body.workOrder?.toString().trim())  throw new BadRequestException('Work Order is required.');
      if (!body.department?.toString().trim()) throw new BadRequestException('Department is required.');
      if (!body.shift?.toString().trim())      throw new BadRequestException('Shift is required.');
    }

    // Block Production and Installation timesheets if the work order is already WO Complete
    if ((tsType === 'PROD' || tsType === 'INST') && body.workOrder) {
      const wocCheck = await this.devPool.request()
        .input('workOrderNo', mssql.NVarChar(100), body.workOrder)
        .query<{ cnt: number }>(`
          SELECT COUNT(*) AS cnt FROM PsWoComplete
          WHERE workOrderNumber = @workOrderNo AND isDeleted = 0
        `);
      if ((wocCheck.recordset[0]?.cnt ?? 0) > 0) {
        throw new BadRequestException(
          `Work order ${body.workOrder} has already been marked complete. No further timesheet entries are allowed.`
        );
      }
    }

    const prefix  = tsType === 'INST' ? 'TS-INST' : tsType === 'PROJ' ? 'TS-PROJ' : 'TS-PROD';
    const docNo   = await this.nextDocNo(tsType, prefix, year);

    const tx: Transaction = this.devPool.transaction();
    await tx.begin();
    try {
      const hdr = await tx.request()
        .input('tsDocNo',        mssql.NVarChar(40),  docNo)
        .input('tsType',         mssql.NVarChar(20),  n(body.tsType) ?? 'PROD')
        .input('entryDate',      mssql.NVarChar(20),  n(body.date))
        .input('projectId',      mssql.NVarChar(50),  n(body.projectId))
        .input('projectName',    mssql.NVarChar(250), n(body.projectName))
        .input('workOrderNo',    mssql.NVarChar(100),  n(body.workOrder))
        .input('departmentCode', mssql.NVarChar(50),  n(body.department))
        .input('shiftCode',      mssql.NVarChar(30),  n(body.shift))
        .input('enteredByName',   mssql.NVarChar(150), n(body.entryPerson))
        .input('enteredByUserId', mssql.NVarChar(50),  n(body.enteredByUserId))
        .input('remarks',         mssql.NVarChar(500), n(body.remarks))
        .query<{ tsId: number }>(`
          INSERT INTO PSTsHeader
            (tsDocNo, tsType, entryDate, projectId, projectName, workOrderNo,
             department_code, shiftCode, entered_by_name, entered_by_user_id, remarks, status)
          OUTPUT INSERTED.tsId
          VALUES
            (@tsDocNo, @tsType, @entryDate, @projectId, @projectName, @workOrderNo,
             @departmentCode, @shiftCode, @enteredByName, @enteredByUserId, @remarks,
             'Draft')
        `);

      const tsId = hdr.recordset[0].tsId;
      await this.insertLines(tx, tsId, body);

      await tx.request()
        .input('tsId',         mssql.BigInt,              tsId)
        .input('eventType',    mssql.NVarChar(40),        'CREATE')
        .input('entityName',   mssql.NVarChar(40),        'PSTsHeader')
        .input('entityId',     mssql.NVarChar(80),        docNo)
        .input('actionByName', mssql.NVarChar(150),       n(body.entryPerson))
        .input('newValue',     mssql.NVarChar(mssql.MAX), JSON.stringify({ docNo, status: 'Draft' }))
        .query(`
          INSERT INTO PSTsSystemHistory
            (tsId, eventType, entityName, entityId, actionByName, newValue)
          VALUES
            (@tsId, @eventType, @entityName, @entityId, @actionByName, @newValue)
        `);

      await tx.commit();
      this.logger.log(`Created timesheet ${docNo} | tsId=${tsId}`);
      return { docNo, tsId };
    } catch (err) {
      await tx.rollback();
      this.logger.error('Create timesheet failed', err);
      throw err;
    }
  }

  // ── List ────────────────────────────────────────────────────────
  async list(
    type?: string,
    workOrderNo?: string,
    dateFrom?: string,
    dateTo?: string,
    status?: string,
    department?: string,
    userId?: string,
    seeAll?: boolean,
  ): Promise<any[]> {
    const req = this.devPool.request();
    if (type)        req.input('tsType',      mssql.NVarChar(20),  type);
    if (workOrderNo) req.input('workOrderNo', mssql.NVarChar(100),  workOrderNo);
    if (dateFrom)    req.input('dateFrom',    mssql.NVarChar(20),  dateFrom);
    if (dateTo)      req.input('dateTo',      mssql.NVarChar(20),  dateTo);
    if (status)      req.input('status',      mssql.NVarChar(30),  status);
    if (department)  req.input('department',  mssql.NVarChar(50),  department);
    // Scope to own records when userId is known and user is not an approver/admin
    const scopeToUser = userId && !seeAll;
    if (scopeToUser)  req.input('userId',     mssql.NVarChar(50),  userId);

    const result = await req.query(`
      SELECT
        h.tsId,
        h.tsDocNo  AS docNo,
        h.tsType,
        h.entryDate,
        h.projectId   AS projectCode,
        h.projectName,
        h.workOrderNo,
        h.department_code,
        h.shiftCode,
        h.entered_by_name,
        h.status,
        h.createdAt,
        (SELECT COUNT(*)  FROM PSTsLabourLine   WHERE tsId = h.tsId) AS labourCount,
        (SELECT COUNT(*)  FROM PSTsMaterialLine  WHERE tsId = h.tsId) AS materialCount,
        (SELECT COUNT(*)  FROM PSTsEquipmentLine WHERE tsId = h.tsId) AS equipmentCount,
        (SELECT TOP 1 employeeName    FROM PSTsLabourLine WHERE tsId = h.tsId ORDER BY lineNumber) AS employeeName,
        (SELECT TOP 1 employeeCode    FROM PSTsLabourLine WHERE tsId = h.tsId ORDER BY lineNumber) AS employeeCode,
        (SELECT COALESCE(SUM(durationMinutes),0) FROM PSTsLabourLine WHERE tsId = h.tsId) AS totalDuration
      FROM PSTsHeader h
      WHERE h.isDeleted = 0
        ${type        ? 'AND h.tsType          = @tsType'      : ''}
        ${workOrderNo ? 'AND h.workOrderNo      = @workOrderNo' : ''}
        ${dateFrom    ? 'AND h.entryDate       >= @dateFrom'    : ''}
        ${dateTo      ? 'AND h.entryDate       <= @dateTo'      : ''}
        ${status      ? 'AND h.status           = @status'      : ''}
        ${department  ? 'AND h.department_code  = @department'  : ''}
        ${scopeToUser ? 'AND (h.entered_by_user_id = @userId OR h.entered_by_user_id IS NULL)' : ''}
      ORDER BY h.entryDate DESC, h.createdAt DESC
    `);

    const rows = result.recordset.map(r => ({
      ...r,
      entryDate:  toDateStr(r.entryDate),
      projectId:  r.projectCode,   // keep both names: PROJ list uses projectId, PROD/INST use projectCode
      totalHours: r.totalDuration != null ? r.totalDuration / 60 : null,
    }));

    // Enrich with customerName from live ERP (batch lookup by workOrderNo)
    const woNums = [...new Set(rows.map(r => r.workOrderNo).filter(Boolean))];
    if (woNums.length > 0) {
      try {
        const woReq = this.livePool.request();
        woNums.forEach((wo, i) => woReq.input(`wo${i}`, mssql.NVarChar(100), wo));
        const inClause = woNums.map((_, i) => `@wo${i}`).join(',');
        const woRes = await woReq.query(`
          SELECT workorderNumber AS workOrderNo, ec.customerName
          FROM ErpOperationWorkOrder ow
          LEFT JOIN ErpMasterCustomer ec ON ec.custId = ow.customerId
          WHERE ow.workorderNumber IN (${inClause})
          UNION ALL
          SELECT WorkOrderNumber, ec.customerName
          FROM erpinstallationworkorder iw
          LEFT JOIN ErpMasterCustomer ec ON ec.custId = iw.customerId
          WHERE iw.WorkOrderNumber IN (${inClause})
        `);
        const custMap = new Map(woRes.recordset.map(r => [r.workOrderNo, r.customerName]));
        return rows.map(r => ({ ...r, customerName: custMap.get(r.workOrderNo) ?? null }));
      } catch {
        // Live DB unavailable — return without customerName
      }
    }

    return rows;
  }

  // ── Detail Report ────────────────────────────────────────────────
  async reportDetail(filters: {
    dateFrom?: string; dateTo?: string; type?: string;
    status?: string; department?: string; workOrderNo?: string;
  }): Promise<any> {
    const { dateFrom, dateTo, type, status, department, workOrderNo } = filters;
    const req = this.devPool.request();
    if (type)        req.input('tsType',     mssql.NVarChar(20),  type);
    if (workOrderNo) req.input('workOrderNo',mssql.NVarChar(100),  workOrderNo);
    if (dateFrom)    req.input('dateFrom',   mssql.NVarChar(20),  dateFrom);
    if (dateTo)      req.input('dateTo',     mssql.NVarChar(20),  dateTo);
    if (status)      req.input('status',     mssql.NVarChar(30),  status);
    if (department)  req.input('department', mssql.NVarChar(50),  department);

    const where = `WHERE h.isDeleted = 0
      ${type        ? 'AND h.tsType         = @tsType'      : ''}
      ${workOrderNo ? 'AND h.workOrderNo    = @workOrderNo' : ''}
      ${dateFrom    ? 'AND h.entryDate     >= @dateFrom'    : ''}
      ${dateTo      ? 'AND h.entryDate     <= @dateTo'      : ''}
      ${status      ? 'AND h.status         = @status'      : ''}
      ${department  ? 'AND h.department_code= @department'  : ''}`;

    const result = await req.query(`
      SELECT
        h.tsDocNo, h.tsType, CONVERT(VARCHAR(10),h.entryDate,120) AS entryDate,
        h.department_code, h.workOrderNo, h.projectId, h.projectName, h.shiftCode,
        h.entered_by_name, h.status,
        'LABOUR' AS lineType,
        l.lineNumber, l.employeeCode, l.employeeName,
        l.departmentCode AS lineDept, l.designation,
        l.startTime, l.endTime,
        ISNULL(
          NULLIF(l.durationMinutes, 0),
          CASE
            WHEN l.startTime IS NOT NULL AND l.startTime <> ''
             AND l.endTime   IS NOT NULL AND l.endTime   <> ''
            THEN DATEDIFF(MINUTE,
                   TRY_CAST(l.startTime AS TIME),
                   TRY_CAST(l.endTime   AS TIME))
            ELSE 0
          END
        ) AS qty,
        NULL AS itemCode, NULL AS itemName, NULL AS uom,
        NULL AS equipmentName, NULL AS hoursUsed
      FROM PSTsHeader h
      JOIN PSTsLabourLine l ON l.tsId = h.tsId
      ${where}
      UNION ALL
      SELECT
        h.tsDocNo, h.tsType, CONVERT(VARCHAR(10),h.entryDate,120) AS entryDate,
        h.department_code, h.workOrderNo, h.projectId, h.projectName, h.shiftCode,
        h.entered_by_name, h.status,
        'MATERIAL' AS lineType,
        m.lineNumber, NULL AS employeeCode, NULL AS employeeName,
        NULL AS lineDept, NULL AS designation,
        NULL AS startTime, NULL AS endTime, m.qty,
        m.itemCode, m.itemName, m.uom,
        NULL AS equipmentName, NULL AS hoursUsed
      FROM PSTsHeader h
      JOIN PSTsMaterialLine m ON m.tsId = h.tsId
      ${where}
      UNION ALL
      SELECT
        h.tsDocNo, h.tsType, CONVERT(VARCHAR(10),h.entryDate,120) AS entryDate,
        h.department_code, h.workOrderNo, h.projectId, h.projectName, h.shiftCode,
        h.entered_by_name, h.status,
        e.lineType AS lineType,
        e.lineNumber, NULL AS employeeCode, NULL AS equipmentName,
        NULL AS lineDept, NULL AS designation,
        NULL AS startTime, NULL AS endTime, e.hoursUsed AS qty,
        NULL AS itemCode, e.equipmentName AS itemName, NULL AS uom,
        e.equipmentName, e.hoursUsed
      FROM PSTsHeader h
      JOIN PSTsEquipmentLine e ON e.tsId = h.tsId
      ${where}
      ORDER BY entryDate DESC, tsDocNo, lineType, lineNumber
    `);

    return result.recordset.map(r => ({
      ...r,
      startTime: toHM(r.startTime),
      endTime:   toHM(r.endTime),
    }));
  }

  // ── Summary Report (header-level with counts) ────────────────────
  async reportSummary(filters: {
    dateFrom?: string; dateTo?: string; type?: string;
    status?: string; department?: string;
  }): Promise<any> {
    const { dateFrom, dateTo, type, status, department } = filters;
    const req = this.devPool.request();
    if (type)       req.input('tsType',     mssql.NVarChar(20), type);
    if (dateFrom)   req.input('dateFrom',   mssql.NVarChar(20), dateFrom);
    if (dateTo)     req.input('dateTo',     mssql.NVarChar(20), dateTo);
    if (status)     req.input('status',     mssql.NVarChar(30), status);
    if (department) req.input('department', mssql.NVarChar(50), department);

    const where = `WHERE h.isDeleted = 0
      ${type       ? 'AND h.tsType          = @tsType'     : ''}
      ${dateFrom   ? 'AND h.entryDate      >= @dateFrom'   : ''}
      ${dateTo     ? 'AND h.entryDate      <= @dateTo'     : ''}
      ${status     ? 'AND h.status          = @status'     : ''}
      ${department ? 'AND h.department_code = @department' : ''}`;

    const result = await req.query(`
      SELECT
        h.tsDocNo AS docNo,
        h.tsType,
        CONVERT(VARCHAR(10), h.entryDate, 120) AS entryDate,
        h.department_code,
        h.workOrderNo,
        h.projectId,
        h.projectName,
        h.shiftCode,
        h.entered_by_name,
        h.status,
        ISNULL((SELECT COUNT(*) FROM PSTsLabourLine l WHERE l.tsId = h.tsId), 0) AS labourCount,
        ISNULL((SELECT SUM(CAST(
          ISNULL(NULLIF(l.durationMinutes, 0),
            CASE WHEN l.startTime IS NOT NULL AND l.startTime <> '' AND l.endTime IS NOT NULL AND l.endTime <> ''
            THEN DATEDIFF(MINUTE, TRY_CAST(l.startTime AS TIME), TRY_CAST(l.endTime AS TIME))
            ELSE 0 END)
        AS FLOAT)) / 60.0 FROM PSTsLabourLine l WHERE l.tsId = h.tsId), 0) AS totalHours,
        ISNULL((SELECT COUNT(*) FROM PSTsMaterialLine m WHERE m.tsId = h.tsId), 0) AS materialCount,
        ISNULL((SELECT COUNT(*) FROM PSTsEquipmentLine e WHERE e.tsId = h.tsId), 0) AS equipmentCount
      FROM PSTsHeader h
      ${where}
      ORDER BY h.entryDate DESC, h.tsDocNo
    `);

    return result.recordset;
  }

  // ── Get by docNo ─────────────────────────────────────────────────
  async get(docNo: string): Promise<any> {
    const hdrRes = await this.devPool.request()
      .input('tsDocNo', mssql.NVarChar(40), docNo)
      .query(`SELECT * FROM PSTsHeader WHERE tsDocNo = @tsDocNo AND isDeleted = 0`);

    const hdr = hdrRes.recordset[0];
    if (!hdr) return null;

    const tsId = hdr.tsId;
    const [labour, material, equipment, projAttachments] = await Promise.all([
      this.devPool.request().input('tsId', mssql.BigInt, tsId)
        .query(`SELECT * FROM PSTsLabourLine WHERE tsId = @tsId ORDER BY lineNumber`),
      this.devPool.request().input('tsId', mssql.BigInt, tsId)
        .query(`SELECT * FROM PSTsMaterialLine  WHERE tsId = @tsId ORDER BY lineNumber`),
      this.devPool.request().input('tsId', mssql.BigInt, tsId)
        .query(`SELECT * FROM PSTsEquipmentLine WHERE tsId = @tsId ORDER BY lineNumber`),
      hdr.tsType === 'PROJ'
        ? this.devPool.request().input('tsId', mssql.BigInt, tsId)
            .query(`SELECT id, lineNumber, fileName, mimeType, fileSize, uploadedAt FROM PSTsProjLineAttachment WHERE tsId = @tsId ORDER BY lineNumber, id`)
        : Promise.resolve({ recordset: [] }),
    ]);

    // Map attachments by lineNumber for PROJ timesheets
    const attachByLine: Record<number, any[]> = {};
    for (const a of projAttachments.recordset) {
      if (!attachByLine[a.lineNumber]) attachByLine[a.lineNumber] = [];
      attachByLine[a.lineNumber].push({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, fileSize: a.fileSize, uploadedAt: a.uploadedAt });
    }

    // Case-insensitive property lookup — handles DB columns that may use different casing (e.g. ProjectId vs projectId)
    const ci = (obj: any, name: string): any => {
      if (obj == null) return null;
      if (name in obj) return obj[name];                     // exact match first (fastest)
      const lower = name.toLowerCase();
      const key = Object.keys(obj).find(k => k.toLowerCase() === lower);
      return key !== undefined ? obj[key] : null;
    };

    const allEquipment = equipment.recordset;
    this.logger.debug(`[get ${docNo}] labour rows=${labour.recordset.length}` +
      (labour.recordset[0] ? ` row0 keys=${Object.keys(labour.recordset[0]).join(',')}` : ''));
    return {
      ...hdr,
      entryDate: toDateStr(hdr.entryDate),
      labourLines: labour.recordset.map(r => {
        const start = toHM(r.startTime);
        const end   = toHM(r.endTime);
        const durationMinutes = calcDurationMinutes(start, end) ?? (r.durationMinutes ?? 0);
        return {
          ...r,
          startTime: start,
          endTime: end,
          durationMinutes,
          duration_hm: minutesToHm(durationMinutes),
          projectId:    ci(r, 'projectId'),
          taskTypeCode: ci(r, 'taskTypeCode'),
          comments:     ci(r, 'comments'),
          attachments:  attachByLine[r.lineNumber] ?? [],
        };
      }),
      materialLines:  material.recordset,
      equipmentLines: allEquipment.filter(r => (r.lineType || 'MACHINERY') === 'MACHINERY'),
      vehicleLines:   allEquipment.filter(r => r.lineType === 'VEHICLE'),
      accessLines:    allEquipment.filter(r => r.lineType === 'ACCESS'),
    };
  }

  // ── Update ───────────────────────────────────────────────────────
  async update(docNo: string, body: any): Promise<{ docNo: string }> {
    // Mandatory field validation for Production and Installation timesheets
    const tsTypeU = (body.tsType || '').toUpperCase();
    if (tsTypeU === 'PROD' || tsTypeU === 'INST') {
      if (!body.projectId?.toString().trim())  throw new BadRequestException('Project ID is required.');
      if (!body.workOrder?.toString().trim())  throw new BadRequestException('Work Order is required.');
      if (!body.department?.toString().trim()) throw new BadRequestException('Department is required.');
      if (!body.shift?.toString().trim())      throw new BadRequestException('Shift is required.');
    }
    // Block editing Approved timesheets via API
    const statusRes = await this.devPool.request()
      .input('tsDocNo', mssql.NVarChar(40), docNo)
      .query<{ status: string }>(`SELECT status FROM PSTsHeader WHERE tsDocNo = @tsDocNo AND isDeleted = 0`);
    const currentStatus = statusRes.recordset[0]?.status ?? '';
    if (currentStatus === 'Approved') {
      throw new BadRequestException(`Timesheet "${docNo}" is Approved and cannot be edited.`);
    }
    const tsType = (body.tsType || '').toUpperCase();
    if ((tsType === 'PROD' || tsType === 'INST') && body.workOrder) {
      const wocCheck = await this.devPool.request()
        .input('workOrderNo', mssql.NVarChar(100), body.workOrder)
        .query<{ cnt: number }>(`
          SELECT COUNT(*) AS cnt FROM PsWoComplete
          WHERE workOrderNumber = @workOrderNo AND isDeleted = 0
        `);
      if ((wocCheck.recordset[0]?.cnt ?? 0) > 0) {
        throw new BadRequestException(
          `Work order ${body.workOrder} has already been marked complete. No further timesheet entries are allowed.`
        );
      }
    }

    const hdrRes = await this.devPool.request()
      .input('tsDocNo', mssql.NVarChar(40), docNo)
      .query<{ tsId: number }>(`
        SELECT tsId FROM PSTsHeader WHERE tsDocNo = @tsDocNo AND isDeleted = 0
      `);
    const hdr = hdrRes.recordset[0];
    if (!hdr) throw new Error(`Timesheet ${docNo} not found`);
    const tsId = hdr.tsId;

    const tx: Transaction = this.devPool.transaction();
    await tx.begin();
    try {
      await tx.request()
        .input('tsId',           mssql.BigInt,        tsId)
        .input('entryDate',      mssql.NVarChar(20),  n(body.date))
        .input('projectId',      mssql.NVarChar(50),  n(body.projectId))
        .input('projectName',    mssql.NVarChar(250), n(body.projectName))
        .input('workOrderNo',    mssql.NVarChar(100),  n(body.workOrder))
        .input('departmentCode', mssql.NVarChar(50),  n(body.department))
        .input('shiftCode',      mssql.NVarChar(30),  n(body.shift))
        .input('enteredByName',  mssql.NVarChar(150), n(body.entryPerson))
        .input('remarks',        mssql.NVarChar(500), n(body.remarks))
        .query(`
          UPDATE PSTsHeader SET
            entryDate       = @entryDate,
            projectId       = @projectId,
            projectName     = @projectName,
            workOrderNo     = @workOrderNo,
            department_code = @departmentCode,
            shiftCode       = @shiftCode,
            entered_by_name = @enteredByName,
            remarks         = @remarks,
            updatedAt       = SYSUTCDATETIME()
          WHERE tsId = @tsId
        `);

      // Delete PROJ line attachments before re-inserting lines
      await tx.request().input('tsId', mssql.BigInt, tsId)
        .query(`DELETE FROM PSTsProjLineAttachment WHERE tsId = @tsId`);
      for (const tbl of ['PSTsLabourLine', 'PSTsMaterialLine', 'PSTsEquipmentLine']) {
        await tx.request()
          .input('tsId', mssql.BigInt, tsId)
          .query(`DELETE FROM ${tbl} WHERE tsId = @tsId`);
      }
      await this.insertLines(tx, tsId, body);

      await tx.request()
        .input('tsId',         mssql.BigInt,              tsId)
        .input('eventType',    mssql.NVarChar(40),        'UPDATE')
        .input('entityName',   mssql.NVarChar(40),        'PSTsHeader')
        .input('entityId',     mssql.NVarChar(80),        docNo)
        .input('actionByName', mssql.NVarChar(150),       n(body.entryPerson))
        .input('newValue',     mssql.NVarChar(mssql.MAX), JSON.stringify(body))
        .query(`
          INSERT INTO PSTsSystemHistory
            (tsId, eventType, entityName, entityId, actionByName, newValue)
          VALUES
            (@tsId, @eventType, @entityName, @entityId, @actionByName, @newValue)
        `);

      await tx.commit();
      this.logger.log(`Updated timesheet ${docNo}`);
      return { docNo };
    } catch (err) {
      await tx.rollback();
      this.logger.error(`Update timesheet ${docNo} failed`, err);
      throw err;
    }
  }

  // ── Batch create (weekly entry → individual daily records) ──────
  async batchCreate(records: any[]): Promise<{ results: { docNo: string; tsId: number }[] }> {
    const results: { docNo: string; tsId: number }[] = [];
    for (const record of records) {
      const r = await this.create(record);
      results.push(r);
    }
    this.logger.log(`Batch created ${results.length} PROJ timesheets`);
    return { results };
  }

  // ── Approval actions ─────────────────────────────────────────────
  async submitForApproval(docNo: string, byName: string): Promise<void> {
    const res = await this.devPool.request()
      .input('docNo',  mssql.NVarChar(40),  docNo)
      .input('byName', mssql.NVarChar(150), byName || null)
      .query(`
        UPDATE PSTsHeader
        SET status = 'Submitted', rejectionReason = NULL, approvedBy = NULL, approvedAt = NULL,
            submittedAt = GETDATE(), updatedAt = SYSUTCDATETIME()
        WHERE tsDocNo = @docNo AND isDeleted = 0 AND status IN ('Draft','Rejected')
      `);
    if (res.rowsAffected[0] === 0) throw new Error(`Cannot submit: ${docNo} not found or not in Draft/Rejected status`);
  }

  async approve(docNo: string, byName: string, editBody?: any): Promise<void> {
    if (editBody && Object.keys(editBody).length > 0) {
      await this.update(docNo, editBody);
    }
    await this.devPool.request()
      .input('docNo',  mssql.NVarChar(40),  docNo)
      .input('byName', mssql.NVarChar(200), byName || null)
      .query(`
        UPDATE PSTsHeader
        SET status = 'Approved', approvedBy = @byName, approvedAt = GETDATE(), rejectionReason = NULL, updatedAt = SYSUTCDATETIME()
        WHERE tsDocNo = @docNo AND isDeleted = 0
      `);
  }

  async reject(docNo: string, byName: string, reason: string): Promise<void> {
    await this.devPool.request()
      .input('docNo',  mssql.NVarChar(40),  docNo)
      .input('byName', mssql.NVarChar(200), byName || null)
      .input('reason', mssql.NVarChar(500), reason || null)
      .query(`
        UPDATE PSTsHeader
        SET status = 'Rejected', rejectionReason = @reason, approvedBy = @byName, approvedAt = GETDATE(), updatedAt = SYSUTCDATETIME()
        WHERE tsDocNo = @docNo AND isDeleted = 0
      `);
  }

  // ── Confirm (PROJ self-approve) ──────────────────────────────────
  async confirmTimesheet(docNo: string, byName: string): Promise<void> {
    const res = await this.devPool.request()
      .input('docNo',  mssql.NVarChar(40),  docNo)
      .input('byName', mssql.NVarChar(200), byName || null)
      .query(`
        UPDATE PSTsHeader
        SET status = 'Approved', approvedBy = @byName, approvedAt = GETDATE(),
            rejectionReason = NULL, updatedAt = SYSUTCDATETIME()
        WHERE tsDocNo = @docNo AND isDeleted = 0 AND tsType = 'PROJ' AND status = 'Draft'
      `);
    if (res.rowsAffected[0] === 0)
      throw new Error(`Cannot confirm: ${docNo} not found, not a PROJ timesheet, or not in Draft status`);
  }

  async getTsEmployees(): Promise<any[]> {
    // Employees from the live master filtered by Production / Installation departments.
    // mainDepartment is not a column — it is the parent dept's departmentCode (self-join).
    let masterRows: any[] = [];
    try {
      const masterRes = await this.livePool.request().query(`
        SELECT
          me.employeeNo   AS employeeCode,
          LTRIM(RTRIM(ISNULL(me.firstName,'') + ' ' + ISNULL(me.lastname,''))) AS employeeName,
          md.departmentCode,
          parentDept.departmentCode AS mainDepartment
        FROM ErpMasterEmployee me
        LEFT JOIN ErpMasterDepartment md         ON md.departmentId         = me.departmentId
        LEFT JOIN ErpMasterDepartment parentDept ON parentDept.departmentId = md.parentDepartmentId
        WHERE me.isActive = 1 AND me.isDeleted = 0
          AND me.employeeNo IS NOT NULL AND me.employeeNo <> ''
          AND (
            LOWER(ISNULL(parentDept.departmentCode,'')) LIKE '%production%'
            OR LOWER(ISNULL(parentDept.departmentCode,'')) LIKE '%install%'
          )
        ORDER BY employeeName
      `);
      masterRows = masterRes.recordset;
    } catch (err) {
      this.logger.warn(`getTsEmployees: live DB unavailable — ${(err as Error)?.message}`);
    }

    this.logger.log(`getTsEmployees: master rows=${masterRows.length}`);

    // Also pull any employees already used in PROD/INST labour lines (catches manually entered names)
    const labourRes = await this.devPool.request().query(`
      SELECT DISTINCT l.employeeCode, l.employeeName
      FROM PSTsLabourLine l
      JOIN PSTsHeader h ON h.tsId = l.tsId
      WHERE h.tsType IN ('PROD','INST') AND h.isDeleted = 0
        AND l.employeeCode IS NOT NULL AND l.employeeCode <> ''
    `);

    // Merge: master list takes priority; add labour-line employees not already present
    const seen = new Set<string>();
    const result: any[] = [];
    for (const r of masterRows) {
      if (!seen.has(r.employeeCode)) { seen.add(r.employeeCode); result.push(r); }
    }
    for (const r of labourRes.recordset) {
      if (!seen.has(r.employeeCode)) { seen.add(r.employeeCode); result.push(r); }
    }
    return result.sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
  }

  async getProjLineAttachment(attachId: number): Promise<{ fileName: string; mimeType: string; fileData: string } | null> {
    const res = await this.devPool.request()
      .input('id', mssql.Int, attachId)
      .query(`SELECT fileName, mimeType, fileData, s3Key FROM PSTsProjLineAttachment WHERE id = @id`);
    const row = res.recordset[0];
    if (!row) return null;
    if (row.s3Key) {
      try {
        const base64 = await this.s3.getAsBase64(row.s3Key, row.mimeType || 'application/octet-stream');
        return { fileName: row.fileName, mimeType: row.mimeType, fileData: base64 };
      } catch {
        return null;
      }
    }
    return row;
  }

  async removeProjLineAttachment(attachId: number): Promise<void> {
    const res = await this.devPool.request()
      .input('id', mssql.Int, attachId)
      .query(`SELECT s3Key FROM PSTsProjLineAttachment WHERE id = @id`);
    const s3Key = res.recordset[0]?.s3Key;
    if (s3Key) await this.s3.delete(s3Key);
    await this.devPool.request()
      .input('id', mssql.Int, attachId)
      .query(`DELETE FROM PSTsProjLineAttachment WHERE id = @id`);
  }

  async getDistinctProjectCodes(): Promise<{ projectId: string; projectName: string }[]> {
    const res = await this.devPool.request().query(`
      SELECT DISTINCT projectId, MAX(ISNULL(projectName,'')) AS projectName
      FROM PSTsHeader
      WHERE isDeleted = 0 AND projectId IS NOT NULL AND projectId <> ''
      GROUP BY projectId
      ORDER BY projectId
    `);
    return res.recordset;
  }

  async getWeekEntries(employeeCode: string, weekStart: string, excludeDocNos?: string): Promise<Record<string, any[]>> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const excludeList = (excludeDocNos ?? '').split(',').filter(Boolean);
    const req = this.devPool.request()
      .input('empCode',   mssql.NVarChar(50),  employeeCode)
      .input('weekStart', mssql.NVarChar(20),  weekStart)
      .input('weekEnd',   mssql.NVarChar(20),  weekEndStr);
    excludeList.forEach((d, i) => req.input(`ex${i}`, mssql.NVarChar(40), d));
    const excludeClause = excludeList.length > 0
      ? `AND h.tsDocNo NOT IN (${excludeList.map((_, i) => `@ex${i}`).join(',')})`
      : '';
    const res = await req.query(`
      SELECT h.tsDocNo, h.tsType, h.status,
             CONVERT(VARCHAR(10), h.entryDate, 23) AS dateStr,
             l.lineNumber, l.startTime, l.endTime, l.durationMinutes,
             l.projectId, h.workOrderNo, h.department_code
      FROM PSTsLabourLine l
      JOIN PSTsHeader h ON h.tsId = l.tsId
      WHERE h.isDeleted = 0
        AND h.tsType <> 'PROJ'
        AND l.employeeCode = @empCode
        AND h.entryDate >= CAST(@weekStart AS DATE)
        AND h.entryDate <  DATEADD(DAY, 1, CAST(@weekEnd AS DATE))
        AND l.startTime IS NOT NULL AND l.endTime IS NOT NULL
        ${excludeClause}
      ORDER BY h.entryDate, l.startTime
    `);
    const result: Record<string, any[]> = {};
    for (const r of res.recordset) {
      const dateKey = (r.dateStr ?? '').slice(0, 10);
      if (!result[dateKey]) result[dateKey] = [];
      result[dateKey].push({
        tsDocNo:         r.tsDocNo,
        tsType:          r.tsType,
        status:          r.status,
        lineNumber:      r.lineNumber,
        startTime:       toHM(r.startTime),
        endTime:         toHM(r.endTime),
        durationMinutes: r.durationMinutes,
        label:           r.projectId || r.workOrderNo || r.department_code || '—',
      });
    }
    return result;
  }

  async getWeekProjData(employeeCode: string, weekStart: string): Promise<Record<string, any>> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const res = await this.devPool.request()
      .input('empCode',   mssql.NVarChar(50), employeeCode)
      .input('weekStart', mssql.NVarChar(20), weekStart)
      .input('weekEnd',   mssql.NVarChar(20), weekEndStr)
      .query(`
        SELECT h.tsDocNo, h.status,
               CONVERT(VARCHAR(10), h.entryDate, 23) AS dateStr,
               l.lineNumber, l.projectId, l.taskTypeCode, l.startTime, l.endTime,
               l.durationMinutes, l.comments
        FROM PSTsLabourLine l
        JOIN PSTsHeader h ON h.tsId = l.tsId
        WHERE h.isDeleted = 0
          AND h.tsType = 'PROJ'
          AND l.employeeCode = @empCode
          AND CAST(h.entryDate AS DATE) >= CAST(@weekStart AS DATE)
          AND CAST(h.entryDate AS DATE) <= CAST(@weekEnd AS DATE)
        ORDER BY h.entryDate, l.lineNumber
      `);
    const result: Record<string, any> = {};
    for (const r of res.recordset) {
      const dateKey = (r.dateStr ?? '').slice(0, 10);
      if (!result[dateKey]) result[dateKey] = { docNo: r.tsDocNo, status: r.status, lines: [] };
      result[dateKey].lines.push({
        lineNumber:   r.lineNumber,
        projectId:    r.projectId ?? '',
        taskTypeCode: r.taskTypeCode ?? '',
        startTime:    toHM(r.startTime),
        endTime:      toHM(r.endTime),
        comments:     r.comments ?? '',
      });
    }
    return result;
  }

  async getDayEntries(employeeCode: string, date: string, excludeDocNo?: string): Promise<any[]> {
    const req = this.devPool.request()
      .input('empCode', mssql.NVarChar(50), employeeCode)
      .input('date', mssql.NVarChar(20), date);
    if (excludeDocNo) req.input('excludeDocNo', mssql.NVarChar(40), excludeDocNo);
    const res = await req.query(`
      SELECT h.tsDocNo, h.tsType, h.status,
             l.lineNumber, l.startTime, l.endTime, l.durationMinutes,
             l.projectId, h.workOrderNo, h.department_code
      FROM PSTsLabourLine l
      JOIN PSTsHeader h ON h.tsId = l.tsId
      WHERE h.isDeleted = 0
        AND l.employeeCode = @empCode
        AND CAST(h.entryDate AS DATE) = CAST(@date AS DATE)
        ${excludeDocNo ? 'AND h.tsDocNo <> @excludeDocNo' : ''}
        AND l.startTime IS NOT NULL AND l.endTime IS NOT NULL
      ORDER BY l.startTime
    `);
    return res.recordset.map(r => ({
      tsDocNo:         r.tsDocNo,
      tsType:          r.tsType,
      status:          r.status,
      lineNumber:      r.lineNumber,
      startTime:       toHM(r.startTime),
      endTime:         toHM(r.endTime),
      durationMinutes: r.durationMinutes,
      label:           r.projectId || r.workOrderNo || r.department_code || '—',
    }));
  }

  async getPendingApprovals(department?: string): Promise<any[]> {
    const req = this.devPool.request();
    if (department) req.input('dept', mssql.NVarChar(100), department);
    const res = await req.query(`
      SELECT h.tsId, h.tsDocNo, h.tsType, h.entryDate, h.department_code, h.workOrderNo,
             h.projectId, h.projectName, h.shiftCode, h.entered_by_name, h.status,
             h.createdAt, h.submittedAt,
             (SELECT COALESCE(SUM(durationMinutes),0) FROM PSTsLabourLine WHERE tsId = h.tsId) AS totalDuration
      FROM PSTsHeader h
      WHERE h.isDeleted = 0
        AND h.status = 'Submitted'
        AND h.tsType IN ('PROD','INST')
        ${department ? 'AND h.department_code = @dept' : ''}
      ORDER BY h.createdAt ASC
    `);
    return res.recordset.map(r => ({ ...r, entryDate: toDateStr(r.entryDate) }));
  }

  /** Throw 403 if the role does not have the required action on the given module */
  async assertPermission(roleCode: string, module: string, action: 'canRead' | 'canCreate' | 'canWrite' | 'canDelete' | 'canReport'): Promise<void> {
    if (!roleCode) throw new ForbiddenException('No role assigned');
    const res = await this.devPool.request()
      .input('roleCode', mssql.NVarChar(30), roleCode)
      .input('module',   mssql.NVarChar(50), module)
      .query<Record<string, boolean>>(`
        SELECT canCreate, canRead, canWrite, canDelete, canReport
        FROM   PSTsRolePermissions
        WHERE  roleCode = @roleCode AND module = @module
      `);
    const row = res.recordset[0];
    if (!row || !row[action])
      throw new ForbiddenException(`You do not have ${action} permission for the ${module} module`);
  }

  /** Derive the tsType module name (PROD/INST/PROJ) from a document number */
  typeFromDocNo(docNo: string): string {
    if (docNo.startsWith('TS-INST')) return 'INST';
    if (docNo.startsWith('TS-PROJ')) return 'PROJ';
    return 'PROD';
  }

  /** Check if a role is a timesheet approver.
   *  Requires BOTH canWrite AND canReport on any of PROD/INST/PROJ:
   *  - canWrite alone: regular worker who can edit their own drafts — not an approver
   *  - canReport alone: QC Inspector / report viewer — not an approver
   *  - canWrite + canReport: supervisor / manager — IS an approver */
  async isTimesheetApprover(roleCode: string): Promise<boolean> {
    if (!roleCode) return false;
    const res = await this.devPool.request()
      .input('roleCode', mssql.NVarChar(30), roleCode)
      .query<{ cnt: number }>(`
        SELECT COUNT(*) AS cnt FROM PSTsRolePermissions
        WHERE roleCode = @roleCode AND canWrite = 1 AND canReport = 1
          AND module IN ('PROD','INST','PROJ')
      `);
    return (res.recordset[0]?.cnt ?? 0) > 0;
  }

  async getEmailByDisplayName(displayName: string): Promise<string | null> {
    const res = await this.devPool.request()
      .input('name', mssql.NVarChar(200), displayName)
      .query(`SELECT TOP 1 email FROM PSTsUsers WHERE displayName = @name AND email IS NOT NULL`);
    return res.recordset[0]?.email ?? null;
  }

  // ── Soft delete ─────────────────────────────────────────────────
  async remove(docNo: string): Promise<void> {
    // Only Draft timesheets may be deleted
    const statusRes = await this.devPool.request()
      .input('tsDocNo', mssql.NVarChar(40), docNo)
      .query<{ status: string }>(`SELECT status FROM PSTsHeader WHERE tsDocNo = @tsDocNo AND isDeleted = 0`);
    const currentStatus = statusRes.recordset[0]?.status ?? '';
    if (currentStatus && currentStatus !== 'Draft') {
      throw new BadRequestException(`Only Draft timesheets can be deleted. "${docNo}" is currently "${currentStatus}".`);
    }
    const res = await this.devPool.request()
      .input('tsDocNo', mssql.NVarChar(40), docNo)
      .query(`UPDATE PSTsHeader SET isDeleted = 1, updatedAt = SYSUTCDATETIME() WHERE tsDocNo = @tsDocNo`);
    if (res.rowsAffected[0] === 0) throw new Error(`Timesheet ${docNo} not found`);
    this.logger.log(`Soft-deleted timesheet ${docNo}`);
  }
}
