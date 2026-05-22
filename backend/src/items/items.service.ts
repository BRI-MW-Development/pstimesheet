import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConnectionPool, IResult } from 'mssql';
import { SQL_POOL } from '../database/database.constants';
import type { ListItemsQueryDto } from './dto/list-items-query.dto';

export interface ItemMasterRow {
  itemcode: string | null;
  itemName: string | null;
  description: string | null;
  UOM: string | null;
  subsidiaryCode: string | null;
}

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(@Inject(SQL_POOL) private readonly pool: ConnectionPool) {}

  async list(query: ListItemsQueryDto): Promise<ItemMasterRow[]> {
    const subsidiaryIds = this.parseSubsidiaryIds(query.subsidiaryIds);

    const request = this.pool.request();
    request.input('subsidiaryIds', subsidiaryIds.join(','));

    const sql = `
      SELECT
        mi.itemcode,
        mi.itemName,
        mi.description,
        mt.taxnomyCode AS UOM,
        ms.subsidiaryCode
      FROM ErpMasterItem AS mi
      LEFT JOIN ErpMasterTaxnomy AS mt ON mt.taxnomyId = mi.uomId
      LEFT JOIN ErpMasterSubsidiary AS ms ON ms.subsidiaryId = mi.subsidiaryId
      WHERE mi.subsidiaryId IN (
        SELECT TRY_CAST(value AS INT)
        FROM string_split(@subsidiaryIds, ',')
        WHERE TRY_CAST(value AS INT) IS NOT NULL
      )
      AND mi.isActive = 1
      AND mi.itemName NOT LIKE '%-SJO-%'
      AND LOWER(ISNULL(ms.subsidiaryCode,'')) NOT LIKE '%prosigns ksa%'
      GROUP BY mi.itemcode, mi.itemName, mi.description, mt.taxnomyCode, ms.subsidiaryCode
      ORDER BY mi.itemName ASC;
    `;

    const result: IResult<ItemMasterRow> = await request.query(sql);
    this.logger.log(`Fetched ${result.recordset.length} item rows | subsidiaries=${subsidiaryIds.join(',')}`);
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
