import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL, SQL_POOL } from '../database/database.constants';
import type { ListDepartmentsQueryDto } from './dto/list-departments-query.dto';

export interface DepartmentMasterRow {
  departmentId: number;
  departmentCode: string | null;
  mainDepartment: string | null;
  isActive: boolean;
}

export interface UpdateDepartmentProfileDto {
  mainDepartmentOverride?: string;
  isActive: boolean;
  updatedBy?: string;
}

@Injectable()
export class DepartmentsService implements OnModuleInit {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(
    @Inject(SQL_POOL)     private readonly livePool: ConnectionPool,
    @Inject(DEV_SQL_POOL) private readonly devPool:  ConnectionPool,
  ) {}

  async onModuleInit() {
    try {
      // Drop old code-keyed table if it exists, recreate with departmentId as PK
      await this.devPool.request().query(`
        IF EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'PSDepartmentProfile'
            AND COLUMN_NAME = 'departmentCode'
            AND NOT EXISTS (
              SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_NAME = 'PSDepartmentProfile' AND COLUMN_NAME = 'departmentId'
            )
        )
        BEGIN
          DROP TABLE PSDepartmentProfile;
        END

        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PSDepartmentProfile')
        CREATE TABLE PSDepartmentProfile (
          departmentId           INT           NOT NULL PRIMARY KEY,
          mainDepartmentOverride NVARCHAR(100) NULL,
          isActive               BIT           NOT NULL DEFAULT 1,
          updatedAt              DATETIME      NOT NULL DEFAULT GETDATE(),
          updatedBy              NVARCHAR(100) NULL
        )
      `);
      this.logger.log('PSDepartmentProfile table ready (dev DB, keyed by departmentId)');
    } catch (err) {
      this.logger.warn(`Schema init skipped (will retry on next request): ${(err as Error)?.message}`);
    }
  }

  async list(query: ListDepartmentsQueryDto): Promise<DepartmentMasterRow[]> {
    const [erpResult, psResult] = await Promise.all([
      this.livePool.request().query(`
        SELECT
          md.departmentId,
          md.departmentCode,
          dd.departmentCode AS mainDepartment
        FROM ErpMasterDepartment md
        LEFT JOIN ErpMasterDepartment dd ON md.parentDepartmentId = dd.departmentId
        WHERE md.isActive = 1
        ORDER BY md.departmentCode ASC;
      `),
      this.devPool.request().query(`
        SELECT departmentId, mainDepartmentOverride, isActive FROM PSDepartmentProfile
      `).catch((err) => {
        this.logger.error('PSDepartmentProfile query failed: ' + err?.message);
        return { recordset: [] as any[] };
      }),
    ]);

    type ProfileRow = { departmentId: number; mainDepartmentOverride: string | null; isActive: boolean | number };
    const profileMap = new Map((psResult.recordset as ProfileRow[]).map(p => [Number(p.departmentId), p]));

    this.logger.log(`PSDepartmentProfile rows: ${psResult.recordset.length}, sample: ${JSON.stringify(psResult.recordset.slice(0, 3))}`);
    this.logger.log(`ERP sample row keys: ${JSON.stringify(Object.keys(erpResult.recordset[0] ?? {}))}, first row: ${JSON.stringify(erpResult.recordset[0])}`);

    const rows: DepartmentMasterRow[] = erpResult.recordset.map(r => {
      const profile = profileMap.get(Number(r.departmentId));
      return {
        departmentId:   Number(r.departmentId),
        departmentCode: r.departmentCode,
        mainDepartment: profile?.mainDepartmentOverride || r.mainDepartment || null,
        isActive:       profile ? (profile.isActive !== false && profile.isActive !== 0) : true,
      };
    });

    this.logger.log(`Fetched ${rows.length} departments, ${rows.filter(r => !r.isActive).length} inactive`);
    return rows;
  }

  async updateProfile(departmentId: number, dto: UpdateDepartmentProfileDto): Promise<void> {
    await this.devPool.request()
      .input('departmentId',           mssql.Int,           departmentId)
      .input('mainDepartmentOverride', mssql.NVarChar(100), dto.mainDepartmentOverride || null)
      .input('isActive',               mssql.Bit,           dto.isActive ? 1 : 0)
      .input('updatedBy',              mssql.NVarChar(100), dto.updatedBy || null)
      .query(`
        MERGE PSDepartmentProfile AS target
        USING (SELECT @departmentId AS departmentId) AS source
          ON target.departmentId = source.departmentId
        WHEN MATCHED THEN
          UPDATE SET
            mainDepartmentOverride = @mainDepartmentOverride,
            isActive               = @isActive,
            updatedAt              = GETDATE(),
            updatedBy              = @updatedBy
        WHEN NOT MATCHED THEN
          INSERT (departmentId, mainDepartmentOverride, isActive, updatedBy)
          VALUES (@departmentId, @mainDepartmentOverride, @isActive, @updatedBy);
      `);
    this.logger.log(`Updated PSDepartmentProfile for departmentId=${departmentId}`);
  }
}
