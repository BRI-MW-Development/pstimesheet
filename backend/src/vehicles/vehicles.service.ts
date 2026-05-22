import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';

export interface Vehicle {
  vehicleId: string;
  plateNo: string;
  vehicleType: string;
  make: string | null;
  model: string | null;
  yearModel: number | null;
  status: string;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class VehiclesService {
  constructor(@Inject(DEV_SQL_POOL) private readonly pool: ConnectionPool) {}

  async findAll(): Promise<Vehicle[]> {
    const res = await this.pool.request().query<Vehicle>(`
      SELECT vehicleId, plateNo, vehicleType, make, model, yearModel, status, remarks,
             CONVERT(VARCHAR(24), createdAt, 126) AS createdAt,
             CONVERT(VARCHAR(24), updatedAt, 126) AS updatedAt
      FROM   PSTsVehicles ORDER BY vehicleId
    `);
    return res.recordset;
  }

  async findOne(vehicleId: string): Promise<Vehicle> {
    const res = await this.pool.request()
      .input('vehicleId', mssql.NVarChar(30), vehicleId)
      .query<Vehicle>(`
        SELECT vehicleId, plateNo, vehicleType, make, model, yearModel, status, remarks,
               CONVERT(VARCHAR(24), createdAt, 126) AS createdAt,
               CONVERT(VARCHAR(24), updatedAt, 126) AS updatedAt
        FROM   PSTsVehicles WHERE vehicleId = @vehicleId
      `);
    if (!res.recordset[0]) throw new NotFoundException(`Vehicle '${vehicleId}' not found`);
    return res.recordset[0];
  }

  async nextVehicleId(): Promise<string> {
    const res = await this.pool.request().query<{ maxNo: number }>(`
      SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(vehicleId, 5, LEN(vehicleId)) AS INT)), 0) AS maxNo
      FROM PSTsVehicles WHERE vehicleId LIKE 'VEH-%'
    `);
    const next = (res.recordset[0]?.maxNo ?? 0) + 1;
    return `VEH-${String(next).padStart(4, '0')}`;
  }

  async create(body: {
    plateNo: string; vehicleType: string; make?: string; model?: string;
    yearModel?: number; status?: string; remarks?: string;
  }): Promise<Vehicle> {
    if (!body.plateNo?.trim())     throw new BadRequestException('plateNo is required');
    if (!body.vehicleType?.trim()) throw new BadRequestException('vehicleType is required');

    const vehicleId = await this.nextVehicleId();
    try {
      await this.pool.request()
        .input('vehicleId',   mssql.NVarChar(30),  vehicleId)
        .input('plateNo',     mssql.NVarChar(30),  body.plateNo.trim().toUpperCase())
        .input('vehicleType', mssql.NVarChar(50),  body.vehicleType.trim())
        .input('make',        mssql.NVarChar(80),  body.make    || null)
        .input('model',       mssql.NVarChar(80),  body.model   || null)
        .input('yearModel',   mssql.Int,            body.yearModel ? Number(body.yearModel) : null)
        .input('status',      mssql.NVarChar(10),  body.status  || 'Active')
        .input('remarks',     mssql.NVarChar(250), body.remarks || null)
        .query(`
          INSERT INTO PSTsVehicles (vehicleId, plateNo, vehicleType, make, model, yearModel, status, remarks)
          VALUES (@vehicleId, @plateNo, @vehicleType, @make, @model, @yearModel, @status, @remarks)
        `);
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601)
        throw new BadRequestException(`Plate number '${body.plateNo}' already exists`);
      throw err;
    }
    return this.findOne(vehicleId);
  }

  async update(vehicleId: string, body: {
    plateNo?: string; vehicleType?: string; make?: string; model?: string;
    yearModel?: number; status?: string; remarks?: string;
  }): Promise<Vehicle> {
    const existing = await this.findOne(vehicleId);
    await this.pool.request()
      .input('vehicleId',   mssql.NVarChar(30),  existing.vehicleId)
      .input('plateNo',     mssql.NVarChar(30),  body.plateNo?.trim().toUpperCase()  ?? existing.plateNo)
      .input('vehicleType', mssql.NVarChar(50),  body.vehicleType?.trim()            ?? existing.vehicleType)
      .input('make',        mssql.NVarChar(80),  body.make    !== undefined ? (body.make    || null) : existing.make)
      .input('model',       mssql.NVarChar(80),  body.model   !== undefined ? (body.model   || null) : existing.model)
      .input('yearModel',   mssql.Int,            body.yearModel !== undefined ? (body.yearModel ? Number(body.yearModel) : null) : existing.yearModel)
      .input('status',      mssql.NVarChar(10),  body.status  ?? existing.status)
      .input('remarks',     mssql.NVarChar(250), body.remarks !== undefined ? (body.remarks || null) : existing.remarks)
      .query(`
        UPDATE PSTsVehicles
        SET    plateNo=@plateNo, vehicleType=@vehicleType, make=@make, model=@model,
               yearModel=@yearModel, status=@status, remarks=@remarks, updatedAt=GETDATE()
        WHERE  vehicleId=@vehicleId
      `);
    return this.findOne(vehicleId);
  }

  async remove(vehicleId: string): Promise<{ message: string }> {
    await this.findOne(vehicleId);
    await this.pool.request()
      .input('vehicleId', mssql.NVarChar(30), vehicleId)
      .query(`DELETE FROM PSTsVehicles WHERE vehicleId=@vehicleId`);
    return { message: `Vehicle '${vehicleId}' deleted` };
  }
}
