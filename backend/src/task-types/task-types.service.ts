import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { SQL_POOL, DEV_SQL_POOL } from '../database/database.constants';

export interface TaskTypeRow {
  taskTypeId: string;
  taskTypeName: string;
  isActive: boolean;
  source: 'erp' | 'ps';
}

@Injectable()
export class TaskTypesService implements OnModuleInit {
  private readonly logger = new Logger(TaskTypesService.name);

  constructor(
    @Inject(SQL_POOL)     private readonly livePool: ConnectionPool,
    @Inject(DEV_SQL_POOL) private readonly devPool:  ConnectionPool,
  ) {}

  async onModuleInit() {
    try {
      await this.devPool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PSTsTaskTypes')
        CREATE TABLE PSTsTaskTypes (
          taskTypeId   NVARCHAR(30)  NOT NULL PRIMARY KEY,
          taskTypeName NVARCHAR(100) NOT NULL,
          isActive     BIT           NOT NULL DEFAULT 1,
          createdAt    DATETIME      NOT NULL DEFAULT GETDATE(),
          updatedAt    DATETIME      NOT NULL DEFAULT GETDATE()
        )
      `);
      this.logger.log('PSTsTaskTypes table ready');
    } catch (err) {
      this.logger.warn(`Schema init skipped (will retry on next request): ${(err as Error)?.message}`);
    }
  }

  async list(): Promise<TaskTypeRow[]> {
    const [erpRes, psRes] = await Promise.all([
      this.livePool.request().query<any>(`
        SELECT CAST(taxnomyId AS NVARCHAR(30)) AS taskTypeId,
               taxnomyName                    AS taskTypeName,
               CAST(isActive AS BIT)          AS isActive
        FROM   ErpMasterTaxnomy
        WHERE  taxnomyType = 'ProjectPlanReason'
        ORDER  BY taxnomyName
      `),
      this.devPool.request().query<any>(`
        SELECT taskTypeId, taskTypeName, isActive FROM PSTsTaskTypes ORDER BY taskTypeName
      `).catch(() => ({ recordset: [] as any[] })),
    ]);

    const erpRows: TaskTypeRow[] = erpRes.recordset.map((r) => ({
      taskTypeId:   String(r.taskTypeId),
      taskTypeName: r.taskTypeName,
      isActive:     r.isActive !== 0 && r.isActive !== false,
      source:       'erp' as const,
    }));

    const psRows: TaskTypeRow[] = psRes.recordset.map((r) => ({
      taskTypeId:   r.taskTypeId,
      taskTypeName: r.taskTypeName,
      isActive:     r.isActive !== 0 && r.isActive !== false,
      source:       'ps' as const,
    }));

    const combined = [...erpRows, ...psRows];
    combined.sort((a, b) => a.taskTypeName.localeCompare(b.taskTypeName));
    this.logger.log(`Fetched ${erpRows.length} ERP + ${psRows.length} PS task types`);
    return combined;
  }

  async create(body: { taskTypeName: string; isActive?: boolean }): Promise<TaskTypeRow> {
    if (!body.taskTypeName?.trim()) throw new BadRequestException('taskTypeName is required');

    const taskTypeId = `TT-${Date.now()}`;
    await this.devPool.request()
      .input('taskTypeId',   mssql.NVarChar(30),  taskTypeId)
      .input('taskTypeName', mssql.NVarChar(100), body.taskTypeName.trim())
      .input('isActive',     mssql.Bit,            body.isActive !== false ? 1 : 0)
      .query(`
        INSERT INTO PSTsTaskTypes (taskTypeId, taskTypeName, isActive)
        VALUES (@taskTypeId, @taskTypeName, @isActive)
      `);

    return { taskTypeId, taskTypeName: body.taskTypeName.trim(), isActive: body.isActive !== false, source: 'ps' };
  }

  async update(taskTypeId: string, body: { taskTypeName?: string; isActive?: boolean }): Promise<TaskTypeRow> {
    const res = await this.devPool.request()
      .input('taskTypeId', mssql.NVarChar(30), taskTypeId)
      .query(`SELECT taskTypeId, taskTypeName, isActive FROM PSTsTaskTypes WHERE taskTypeId = @taskTypeId`);

    if (!res.recordset[0]) throw new NotFoundException(`Task type '${taskTypeId}' is from ERP and cannot be edited here`);

    const existing = res.recordset[0];
    await this.devPool.request()
      .input('taskTypeId',   mssql.NVarChar(30),  taskTypeId)
      .input('taskTypeName', mssql.NVarChar(100), body.taskTypeName?.trim() ?? existing.taskTypeName)
      .input('isActive',     mssql.Bit,            body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.isActive)
      .query(`
        UPDATE PSTsTaskTypes
        SET    taskTypeName = @taskTypeName, isActive = @isActive, updatedAt = GETDATE()
        WHERE  taskTypeId = @taskTypeId
      `);

    return { taskTypeId, taskTypeName: body.taskTypeName?.trim() ?? existing.taskTypeName, isActive: body.isActive ?? !!existing.isActive, source: 'ps' };
  }
}
