import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConnectionPool, IResult } from 'mssql';
import { SQL_POOL } from '../database/database.constants';
import type { ListMachineryQueryDto } from './dto/list-machinery-query.dto';

export interface MachineryMasterRow {
  id: number | null;
  machineId: string | null;
  machineName: string | null;
  departmentCode: string | null;
  status: string | null;
}

@Injectable()
export class MachineryService {
  private readonly logger = new Logger(MachineryService.name);

  constructor(@Inject(SQL_POOL) private readonly pool: ConnectionPool) {}

  async list(_query: ListMachineryQueryDto): Promise<MachineryMasterRow[]> {
    const sql = `
      SELECT
        TRY_CAST(mm.machineId AS INT) AS id,
        CASE
          WHEN mm.machineCode IS NOT NULL AND LTRIM(RTRIM(mm.machineCode)) <> ''
          THEN LTRIM(RTRIM(mm.machineCode))
          ELSE 'MCH-' + CAST(mm.machineId AS NVARCHAR(10))
        END AS machineId,
        mm.machineName,
        md.departmentCode,
        CASE WHEN mm.isActive = 1 THEN 'Operational' ELSE 'Off-service' END AS status
      FROM ErpMasterMachinery mm
      LEFT JOIN ErpMasterDepartment md ON md.departmentId = mm.departmentId
      WHERE (mm.isDeleted IS NULL OR mm.isDeleted = 0)
      AND TRY_CAST(mm.subsidiaryId AS INT) = 1
      ORDER BY mm.machineName ASC;
    `;

    const result: IResult<MachineryMasterRow> = await this.pool.request().query(sql);
    this.logger.log(`Fetched ${result.recordset.length} machinery rows`);
    return result.recordset;
  }
}
