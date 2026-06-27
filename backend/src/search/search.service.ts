import { Inject, Injectable } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL, SQL_POOL } from '../database/database.constants';

@Injectable()
export class SearchService {
  constructor(
    @Inject(DEV_SQL_POOL) private readonly devPool: ConnectionPool,
    @Inject(SQL_POOL)     private readonly livePool: ConnectionPool,
  ) {}

  async search(q: string): Promise<{
    timesheets: any[];
    workOrders: any[];
    projects: any[];
    employees: any[];
  }> {
    const term = `%${q.trim()}%`;

    const [timesheets, workOrders, projects, employees] = await Promise.all([
      // Timesheets — DEV DB
      this.devPool.request()
        .input('q', mssql.NVarChar(200), term)
        .query<any>(`
          SELECT TOP 8 docNo, tsType AS type, workOrderNo, projectName, status, department
          FROM PSTsHeader
          WHERE isDeleted = 0
            AND (docNo LIKE @q OR workOrderNo LIKE @q OR projectName LIKE @q)
          ORDER BY createdAt DESC
        `).then(r => r.recordset).catch(() => []),

      // Work Orders — Live ERP
      this.livePool.request()
        .input('q', mssql.NVarChar(200), term)
        .query<any>(`
          SELECT TOP 8
            ow.workorderNumber AS workOrderNumber,
            em.projectCode,
            em.projectName,
            ow.netsuiteStatus
          FROM ErpOperationWorkOrder ow
          LEFT JOIN ErpMasterProject em ON em.projectId = ow.projectId
          WHERE ow.workorderNumber LIKE @q
             OR em.projectName     LIKE @q
          ORDER BY ow.createdOn DESC
        `).then(r => r.recordset).catch(() => []),

      // Projects — Live ERP
      this.livePool.request()
        .input('q', mssql.NVarChar(200), term)
        .query<any>(`
          SELECT TOP 8
            em.projectCode,
            em.projectName,
            ec.customerName
          FROM erpmasterproject em
          LEFT JOIN ErpMasterCustomer ec ON ec.custId = em.clientIId
          WHERE em.projectCode LIKE @q OR em.projectName LIKE @q
          ORDER BY em.projectName
        `).then(r => r.recordset).catch(() => []),

      // Employees — Live ERP
      this.livePool.request()
        .input('q', mssql.NVarChar(200), term)
        .query<any>(`
          SELECT TOP 8
            me.employeeNo,
            me.firstName,
            me.lastName AS lastname
          FROM ErpMasterEmployee me
          WHERE me.isDeleted = 0
            AND me.isActive = 1
            AND (
              me.employeeNo LIKE @q
              OR me.firstName  LIKE @q
              OR me.lastName   LIKE @q
              OR (LTRIM(RTRIM(COALESCE(me.firstName,'') + ' ' + COALESCE(me.lastName,''))) LIKE @q)
            )
          ORDER BY me.firstName
        `).then(r => r.recordset).catch(() => []),
    ]);

    return { timesheets, workOrders, projects, employees };
  }
}
