import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConnectionPool, IResult } from 'mssql';
import { SQL_POOL } from '../database/database.constants';
import type { ListWorkOrdersQueryDto } from './dto/list-work-orders-query.dto';

export interface WorkOrderMasterRow {
  sourceType: string;
  workorderId: number | null;
  workOrderNumber: string;
  projectCode: string | null;
  projectName: string | null;
  customerName: string | null;
  salesperson: string | null;
  manufacturingRouting: string | null;
  signType: string | null;
  signFamily: string | null;
  departmentName: string | null;
  parentDepartmentName: string | null;
  businessUnitCode: string | null;
  netsuiteStatus: string | null;
  subsidiaryCode: string | null;
  createdOn: string | null;
}

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(@Inject(SQL_POOL) private readonly pool: ConnectionPool) {}

  async list(query: ListWorkOrdersQueryDto): Promise<WorkOrderMasterRow[]> {
    const subsidiaryIds = this.parseSubsidiaryIds(query.subsidiaryIds);
    const statuses = this.parseStatuses(query.statuses);

    const request = this.pool.request();
    request.input('subsidiaryIds', subsidiaryIds.join(','));
    request.input('statuses', statuses.join('|'));

    const sql = `
      SELECT
        'Operation WO' AS sourceType,
        ow.workorderId,
        ow.workorderNumber AS workOrderNumber,
        em.projectcode AS projectCode,
        em.projectName,
        ec.customerName,
        LTRIM(RTRIM(COALESCE(emm.firstName, '') + ' ' + COALESCE(emm.lastName, ''))) AS salesperson,
        ow.manufacturingRouting,
        ow.signType,
        et.taxnomyName AS signFamily,
        ed.departmentName,
        parentDept1.departmentName AS parentDepartmentName,
        eb.businessUnitCode,
        ow.netsuiteStatus,
        es.subsidiaryCode,
        CONVERT(VARCHAR(19), ow.createdOn, 120) AS createdOn
      FROM ErpOperationWorkOrder ow
      LEFT JOIN ErpMasterSubsidiary es ON es.subsidiaryId = ow.subsidiaryId
      LEFT JOIN ErpMasterProject em ON em.projectId = ow.projectId
      LEFT JOIN ErpMasterTaxnomy et ON et.taxnomyId = ow.signFamily
      LEFT JOIN ErpMasterDepartment ed ON ed.departmentId = ow.departmentId
      LEFT JOIN ErpMasterDepartment parentDept1 ON parentDept1.departmentId = ed.parentDepartmentId
      LEFT JOIN ErpMasterCustomer ec ON ec.custId = ow.customerId
      LEFT JOIN ErpMasterEmployee emm ON emm.employeeId = ow.salesRepId
      LEFT JOIN ErpMasterBusinessUnit eb ON eb.businessUnitId = ow.businessunitid
      WHERE ow.subsidiaryId IN (
        SELECT TRY_CAST(value AS INT)
        FROM string_split(@subsidiaryIds, ',')
        WHERE TRY_CAST(value AS INT) IS NOT NULL
      )
      AND UPPER(LTRIM(RTRIM(ow.netsuiteStatus))) IN (
        SELECT UPPER(LTRIM(RTRIM(value)))
        FROM string_split(@statuses, '|')
        WHERE LTRIM(RTRIM(value)) <> ''
      )

      UNION ALL

      SELECT
        'Installation WO' AS sourceType,
        iw.WorkOrderId AS workorderId,
        iw.WorkOrderNumber AS workOrderNumber,
        em.projectcode AS projectCode,
        em.projectName,
        ec.customerName,
        LTRIM(RTRIM(COALESCE(emm.firstName, '') + ' ' + COALESCE(emm.lastName, ''))) AS salesperson,
        NULL AS manufacturingRouting,
        NULL AS signType,
        NULL AS signFamily,
        ed.departmentName,
        parentDept2.departmentName AS parentDepartmentName,
        eb.businessUnitCode,
        iw.netsuiteStatus,
        es.subsidiaryCode,
        CONVERT(VARCHAR(19), iw.createdOn, 120) AS createdOn
      FROM erpinstallationworkorder iw
      LEFT JOIN ErpMasterProject em ON em.projectId = iw.projectId
      LEFT JOIN ErpMasterCustomer ec ON ec.custId = iw.customerId
      LEFT JOIN ErpMasterEmployee emm ON emm.employeeId = iw.salesRepId
      LEFT JOIN ErpMasterDepartment ed ON ed.departmentId = iw.departmentId
      LEFT JOIN ErpMasterDepartment parentDept2 ON parentDept2.departmentId = ed.parentDepartmentId
      LEFT JOIN ErpMasterSubsidiary es ON es.subsidiaryId = iw.subsidiaryId
      LEFT JOIN ErpMasterBusinessUnit eb ON eb.businessUnitId = iw.businessunitid
      WHERE iw.subsidiaryId IN (
        SELECT TRY_CAST(value AS INT)
        FROM string_split(@subsidiaryIds, ',')
        WHERE TRY_CAST(value AS INT) IS NOT NULL
      )
      AND UPPER(LTRIM(RTRIM(iw.netsuiteStatus))) IN (
        SELECT UPPER(LTRIM(RTRIM(value)))
        FROM string_split(@statuses, '|')
        WHERE LTRIM(RTRIM(value)) <> ''
      )
      ORDER BY createdOn DESC, workOrderNumber DESC;
    `;

    const result: IResult<WorkOrderMasterRow> = await request.query(sql);
    this.logger.log(
      `Fetched ${result.recordset.length} work orders | subsidiaries=${subsidiaryIds.join(',')} | statuses=${statuses.join(',')}`,
    );
    return result.recordset;
  }

  private parseSubsidiaryIds(raw?: string): number[] {
    const defaults = [1];
    if (!raw) return defaults;

    const parsed = raw
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isInteger(v) && v > 0);

    return parsed.length > 0 ? parsed : defaults;
  }

  private parseStatuses(raw?: string): string[] {
    const defaults = ['In Process', 'Released'];
    if (!raw) return defaults;

    const parsed = raw
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    return parsed.length > 0 ? parsed : defaults;
  }
}
