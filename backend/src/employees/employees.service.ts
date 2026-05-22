import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool, IResult } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL, SQL_POOL } from '../database/database.constants';
import type { ListEmployeesQueryDto } from './dto/list-employees-query.dto';

export interface EmployeeMasterRow {
  employeeNo: string | null;
  firstName: string | null;
  lastname: string | null;
  designation: string | null;
  emailId: string | null;
  subsidiaryCode: string | null;
  departmentCode: string | null;
  subDepartment: string | null;
  category: string | null;
  emiratesOrState: string | null;
  city: string | null;
  status: string | null;
  imageUrl: string | null;
}

@Injectable()
export class EmployeesService implements OnModuleInit {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    @Inject(SQL_POOL)     private readonly pool:    ConnectionPool,
    @Inject(DEV_SQL_POOL) private readonly devPool: ConnectionPool,
  ) {}

  async onModuleInit() {
    try {
      await this.devPool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PSTsEmployeeProfile')
        CREATE TABLE PSTsEmployeeProfile (
          employeeNo    NVARCHAR(30)  NOT NULL PRIMARY KEY,
          emailId       NVARCHAR(150) NULL,
          subDepartment NVARCHAR(100) NULL,
          category      NVARCHAR(100) NULL,
          imageUrl      NVARCHAR(500) NULL,
          updatedAt     DATETIME      NOT NULL DEFAULT GETDATE()
        )
      `);
      this.logger.log('PSTsEmployeeProfile table ready');
    } catch (err) {
      this.logger.warn(`Schema init skipped (will retry on next request): ${(err as Error)?.message}`);
    }
  }

  async list(query: ListEmployeesQueryDto): Promise<EmployeeMasterRow[]> {
    const regionIds = this.parseRegionIds(query.regionIds);
    const filter = query.deptFilter || '';

    const request = this.pool.request();
    request.input('regionIds', regionIds.join(','));

    let deptWhere = '';
    if (filter === 'prod-inst') {
      deptWhere = `AND (
        LOWER(ISNULL(md.departmentCode,''))       IN ('production', 'installation')
        OR LOWER(ISNULL(parentDept.departmentCode,'')) IN ('production', 'installation')
      )`;
    } else if (filter === 'inst') {
      deptWhere = `AND (
        LOWER(ISNULL(md.departmentCode,''))       IN ('production', 'installation', 'digital')
        OR LOWER(ISNULL(parentDept.departmentCode,'')) IN ('production', 'installation', 'digital')
      )`;
    } else if (filter === 'projects') {
      deptWhere = `AND (
        LOWER(ISNULL(md.departmentCode,''))       LIKE '%project%'
        OR LOWER(ISNULL(parentDept.departmentCode,'')) LIKE '%project%'
      )`;
    }

    const sql = `
      SELECT
        me.employeeNo,
        me.firstName,
        me.lastName AS lastname,
        mt.taxnomyName AS designation,
        me.emailId,
        ms.subsidiaryCode,
        md.departmentCode,
        me.emiratesOrState,
        me.city,
        CASE WHEN me.isActive = 1 THEN 'Active' ELSE 'Inactive' END AS status
      FROM ErpMasterEmployee AS me
      LEFT JOIN ErpMasterDepartment md         ON md.departmentId         = me.departmentId
      LEFT JOIN ErpMasterDepartment parentDept ON parentDept.departmentId = md.parentDepartmentId
      LEFT JOIN ErpMasterTaxnomy mt            ON mt.taxnomyId            = me.jobTitleId
      LEFT JOIN ErpMasterSubsidiary ms         ON ms.subsidiaryId         = me.regionId
      WHERE me.regionId IN (
        SELECT TRY_CAST(value AS INT)
        FROM string_split(@regionIds, ',')
        WHERE TRY_CAST(value AS INT) IS NOT NULL
      )
      AND me.isActive = 1
      AND me.isDeleted = 0
      ${deptWhere}
      ORDER BY me.firstName ASC, me.lastName ASC;
    `;

    const [erpResult, profileResult] = await Promise.all([
      request.query<any>(sql),
      this.devPool.request().query<any>(`SELECT employeeNo, emailId, subDepartment, category, imageUrl FROM PSTsEmployeeProfile`).catch(() => ({ recordset: [] as any[] })),
    ]);

    const profileMap = new Map((profileResult.recordset as any[]).map((p) => [p.employeeNo, p]));

    const rows: EmployeeMasterRow[] = erpResult.recordset.map((r) => {
      const profile = profileMap.get(r.employeeNo);
      return {
        employeeNo:     r.employeeNo,
        firstName:      r.firstName,
        lastname:       r.lastname,
        designation:    r.designation,
        emailId:        profile?.emailId      ?? r.emailId      ?? null,
        subsidiaryCode: r.subsidiaryCode,
        departmentCode: r.departmentCode,
        subDepartment:  profile?.subDepartment ?? null,
        category:       profile?.category      ?? null,
        emiratesOrState: r.emiratesOrState,
        city:           r.city,
        status:         r.status,
        imageUrl:       profile?.imageUrl      ?? null,
      };
    });

    this.logger.log(`Fetched ${rows.length} employee rows | regions=${regionIds.join(',')} | deptFilter=${filter || 'all'}`);
    return rows;
  }

  async updateProfile(employeeNo: string, body: {
    emailId?: string; subDepartment?: string; category?: string; imageUrl?: string;
  }): Promise<void> {
    await this.devPool.request()
      .input('employeeNo',    mssql.NVarChar(30),  employeeNo)
      .input('emailId',       mssql.NVarChar(150), body.emailId       ?? null)
      .input('subDepartment', mssql.NVarChar(100), body.subDepartment ?? null)
      .input('category',      mssql.NVarChar(100), body.category      ?? null)
      .input('imageUrl',      mssql.NVarChar(500), body.imageUrl      ?? null)
      .query(`
        MERGE PSTsEmployeeProfile AS target
        USING (SELECT @employeeNo AS employeeNo) AS source ON target.employeeNo = source.employeeNo
        WHEN MATCHED THEN
          UPDATE SET emailId=@emailId, subDepartment=@subDepartment,
                     category=@category, imageUrl=@imageUrl, updatedAt=GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (employeeNo, emailId, subDepartment, category, imageUrl)
          VALUES (@employeeNo, @emailId, @subDepartment, @category, @imageUrl);
      `);
    this.logger.log(`Updated PSTsEmployeeProfile for employeeNo=${employeeNo}`);
  }

  private parseRegionIds(raw?: string): number[] {
    const defaults = [1, 3];
    if (!raw) return defaults;

    const parsed = raw
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isInteger(v) && v > 0);

    return parsed.length > 0 ? parsed : defaults;
  }
}
