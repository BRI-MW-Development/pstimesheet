import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL, SQL_POOL } from '../database/database.constants';

export interface AccessEquipmentRow {
  equipmentId: string;
  equipmentName: string;
  departmentCode: string | null;
  status: string;
  source: string;
  createdAt: string | null;
}

@Injectable()
export class AccessEquipmentService implements OnModuleInit {
  private readonly logger = new Logger(AccessEquipmentService.name);

  constructor(
    @Inject(SQL_POOL)     private readonly livePool: ConnectionPool,
    @Inject(DEV_SQL_POOL) private readonly devPool:  ConnectionPool,
  ) {}

  async onModuleInit() {
    try {
      await this.devPool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PSTsAccessEquipment')
        CREATE TABLE PSTsAccessEquipment (
          equipmentId   NVARCHAR(30)  NOT NULL PRIMARY KEY,
          equipmentName NVARCHAR(100) NOT NULL,
          departmentCode NVARCHAR(50) NULL,
          status        NVARCHAR(20)  NOT NULL DEFAULT 'Active',
          createdAt     DATETIME      NOT NULL DEFAULT GETDATE(),
          updatedAt     DATETIME      NOT NULL DEFAULT GETDATE()
        )
      `);
      this.logger.log('PSTsAccessEquipment table ready');
    } catch (err) {
      this.logger.warn(`Schema init skipped (will retry on next request): ${(err as Error)?.message}`);
    }
  }

  async list(): Promise<AccessEquipmentRow[]> {
    // Merge: ERP live data (read-only) + PS dev records
    const [liveRes, devRes] = await Promise.all([
      this.livePool.request().query(`
        SELECT
          CAST(ac.equipmentChargesId AS NVARCHAR(30)) AS equipmentId,
          ac.equipmentName,
          ed.departmentCode,
          CASE WHEN ac.isActive=1 THEN 'Active' ELSE 'Inactive' END AS status,
          'erp' AS source,
          NULL AS createdAt
        FROM ErpMasterEquipmentCharges ac
        LEFT JOIN ErpMasterDepartment ed ON ac.departmentId = ed.departmentId
        ORDER BY ac.equipmentName ASC
      `).catch(() => ({ recordset: [] as any[] })),

      this.devPool.request().query(`
        SELECT equipmentId, equipmentName, departmentCode, status, 'ps' AS source,
               CONVERT(VARCHAR(24), createdAt, 126) AS createdAt
        FROM   PSTsAccessEquipment
        ORDER  BY equipmentName ASC
      `),
    ]);

    const rows: AccessEquipmentRow[] = [
      ...liveRes.recordset,
      ...devRes.recordset,
    ];

    this.logger.log(`Fetched ${liveRes.recordset.length} ERP + ${devRes.recordset.length} PS access equipment rows`);
    return rows;
  }

  async create(body: { equipmentName: string; departmentCode?: string; status?: string }): Promise<AccessEquipmentRow> {
    if (!body.equipmentName?.trim()) throw new BadRequestException('equipmentName is required');

    const equipmentId = `AE-${Date.now()}`;
    await this.devPool.request()
      .input('equipmentId',    mssql.NVarChar(30),  equipmentId)
      .input('equipmentName',  mssql.NVarChar(100), body.equipmentName.trim())
      .input('departmentCode', mssql.NVarChar(50),  body.departmentCode || null)
      .input('status',         mssql.NVarChar(20),  body.status || 'Active')
      .query(`
        INSERT INTO PSTsAccessEquipment (equipmentId, equipmentName, departmentCode, status)
        VALUES (@equipmentId, @equipmentName, @departmentCode, @status)
      `);

    return this.findOne(equipmentId);
  }

  async findOne(equipmentId: string): Promise<AccessEquipmentRow> {
    const res = await this.devPool.request()
      .input('equipmentId', mssql.NVarChar(30), equipmentId)
      .query<AccessEquipmentRow>(`
        SELECT equipmentId, equipmentName, departmentCode, status, 'ps' AS source,
               CONVERT(VARCHAR(24), createdAt, 126) AS createdAt
        FROM   PSTsAccessEquipment WHERE equipmentId = @equipmentId
      `);
    if (!res.recordset[0]) throw new NotFoundException(`Equipment '${equipmentId}' not found`);
    return res.recordset[0];
  }

  async update(equipmentId: string, body: { equipmentName?: string; departmentCode?: string; status?: string }): Promise<AccessEquipmentRow> {
    const existing = await this.findOne(equipmentId);
    await this.devPool.request()
      .input('equipmentId',    mssql.NVarChar(30),  existing.equipmentId)
      .input('equipmentName',  mssql.NVarChar(100), body.equipmentName?.trim()  ?? existing.equipmentName)
      .input('departmentCode', mssql.NVarChar(50),  body.departmentCode !== undefined ? (body.departmentCode || null) : existing.departmentCode)
      .input('status',         mssql.NVarChar(20),  body.status                 ?? existing.status)
      .query(`
        UPDATE PSTsAccessEquipment
        SET    equipmentName=@equipmentName, departmentCode=@departmentCode,
               status=@status, updatedAt=GETDATE()
        WHERE  equipmentId=@equipmentId
      `);
    return this.findOne(equipmentId);
  }

  async remove(equipmentId: string): Promise<{ message: string }> {
    await this.findOne(equipmentId);
    await this.devPool.request()
      .input('equipmentId', mssql.NVarChar(30), equipmentId)
      .query(`DELETE FROM PSTsAccessEquipment WHERE equipmentId=@equipmentId`);
    return { message: `Equipment '${equipmentId}' deleted` };
  }
}
