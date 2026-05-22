import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConnectionPool, IResult } from 'mssql';
import { SQL_POOL } from '../database/database.constants';
import type { ListProjectsQueryDto } from './dto/list-projects-query.dto';

export interface ProjectMasterRow {
  projectCode: string | null;
  projectName: string | null;
  subsidiaryCode: string | null;
  customerName: string | null;
  salesperson: string | null;
  businessUnitCode: string | null;
  projectOwner: string | null;
  projectManager: string | null;
  status: string | null;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(@Inject(SQL_POOL) private readonly pool: ConnectionPool) {}

  async list(query: ListProjectsQueryDto): Promise<ProjectMasterRow[]> {
    const subsidiaryIds = this.parseSubsidiaryIds(query.subsidiaryIds);

    const request = this.pool.request();
    request.input('subsidiaryIds', subsidiaryIds.join(','));

    const sql = `
      SELECT
        em.projectCode,
        em.projectName,
        es.subsidiaryCode,
        ec.customerName,
        LTRIM(RTRIM(COALESCE(emm.firstName, '') + ' ' + COALESCE(emm.lastName, ''))) AS salesperson,
        eb.businessUnitCode,
        LTRIM(RTRIM(COALESCE(emmm.firstName, '') + ' ' + COALESCE(emmm.lastName, ''))) AS projectOwner,
        LTRIM(RTRIM(COALESCE(emmmm.firstName, '') + ' ' + COALESCE(emmmm.lastName, ''))) AS projectManager,
        et.taxnomycode AS status
      FROM erpmasterproject em
      LEFT JOIN ErpMasterSubsidiary es ON es.subsidiaryId = em.subsidiaryId
      LEFT JOIN ErpMasterTaxnomy et ON et.taxnomyId = em.statusId
      LEFT JOIN ErpMasterCustomer ec ON ec.custId = em.clientIId
      LEFT JOIN ErpMasterOpportunity eo ON eo.projectId = em.projectId
      LEFT JOIN ErpMasteremployee emm ON emm.employeeId = eo.salesRepId
      LEFT JOIN ErpMasterBusinessUnit eb ON eb.businessUnitId = em.businessUnitId
      LEFT JOIN ErpMasterEmployee emmm ON emmm.employeeId = em.projectOwnerId
      LEFT JOIN ErpMasterEmployee emmmm ON emmmm.employeeId = em.projectManagerId
      WHERE em.subsidiaryId IN (
        SELECT TRY_CAST(value AS INT)
        FROM string_split(@subsidiaryIds, ',')
        WHERE TRY_CAST(value AS INT) IS NOT NULL
      )
      AND em.isActive = 1
      ORDER BY em.projectCode DESC;
    `;

    const result: IResult<ProjectMasterRow> = await request.query(sql);
    this.logger.log(`Fetched ${result.recordset.length} projects | subsidiaries=${subsidiaryIds.join(',')}`);
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
}
