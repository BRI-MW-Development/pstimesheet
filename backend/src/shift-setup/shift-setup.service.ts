import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';
import type { CreateShiftDto } from './dto/create-shift.dto';
import type { UpdateShiftDto } from './dto/update-shift.dto';
import type { Shift } from './shift-setup.types';

@Injectable()
export class ShiftSetupService {
  private readonly logger = new Logger(ShiftSetupService.name);

  constructor(@Inject(DEV_SQL_POOL) private readonly pool: ConnectionPool) {}

  async findAll(): Promise<Shift[]> {
    const res = await this.pool.request()
      .query<Shift>(`
        SELECT shiftCode, shiftName, startTime, endTime, graceMinutes, status,
               CONVERT(VARCHAR(24), createdAt, 126) AS createdAt,
               CONVERT(VARCHAR(24), updatedAt, 126) AS updatedAt
        FROM   PSTsShifts
        ORDER BY shiftCode
      `);
    return res.recordset;
  }

  async findOne(shiftCode: string): Promise<Shift> {
    const code = this.normalize(shiftCode);
    const res  = await this.pool.request()
      .input('shiftCode', mssql.NVarChar(30), code)
      .query<Shift>(`
        SELECT shiftCode, shiftName, startTime, endTime, graceMinutes, status,
               CONVERT(VARCHAR(24), createdAt, 126) AS createdAt,
               CONVERT(VARCHAR(24), updatedAt, 126) AS updatedAt
        FROM   PSTsShifts WHERE shiftCode = @shiftCode
      `);
    if (!res.recordset[0]) throw new NotFoundException(`Shift '${code}' not found`);
    return res.recordset[0];
  }

  async create(payload: CreateShiftDto): Promise<Shift> {
    this.validateCreate(payload);
    const code = this.normalize(payload.shiftCode);

    try {
      await this.pool.request()
        .input('shiftCode',    mssql.NVarChar(30),  code)
        .input('shiftName',    mssql.NVarChar(100), payload.shiftName.trim())
        .input('startTime',    mssql.NVarChar(5),   payload.startTime)
        .input('endTime',      mssql.NVarChar(5),   payload.endTime)
        .input('graceMinutes', mssql.Int,            payload.graceMinutes)
        .input('status',       mssql.NVarChar(10),  payload.status)
        .query(`
          INSERT INTO PSTsShifts (shiftCode, shiftName, startTime, endTime, graceMinutes, status)
          VALUES (@shiftCode, @shiftName, @startTime, @endTime, @graceMinutes, @status)
        `);
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) {
        throw new BadRequestException(`Shift '${code}' already exists`);
      }
      throw err;
    }

    return this.findOne(code);
  }

  async update(shiftCode: string, payload: UpdateShiftDto): Promise<Shift> {
    const existing = await this.findOne(shiftCode);
    this.validateUpdate(payload);

    await this.pool.request()
      .input('shiftCode',    mssql.NVarChar(30),  existing.shiftCode)
      .input('shiftName',    mssql.NVarChar(100), payload.shiftName?.trim()   ?? existing.shiftName)
      .input('startTime',    mssql.NVarChar(5),   payload.startTime           ?? existing.startTime)
      .input('endTime',      mssql.NVarChar(5),   payload.endTime             ?? existing.endTime)
      .input('graceMinutes', mssql.Int,            payload.graceMinutes        ?? existing.graceMinutes)
      .input('status',       mssql.NVarChar(10),  payload.status              ?? existing.status)
      .query(`
        UPDATE PSTsShifts
        SET    shiftName    = @shiftName,
               startTime    = @startTime,
               endTime      = @endTime,
               graceMinutes = @graceMinutes,
               status       = @status,
               updatedAt    = GETDATE()
        WHERE  shiftCode = @shiftCode
      `);

    return this.findOne(existing.shiftCode);
  }

  async remove(shiftCode: string): Promise<{ message: string }> {
    const existing = await this.findOne(shiftCode);
    await this.pool.request()
      .input('shiftCode', mssql.NVarChar(30), existing.shiftCode)
      .query(`DELETE FROM PSTsShifts WHERE shiftCode = @shiftCode`);
    return { message: `Shift '${existing.shiftCode}' deleted` };
  }

  private normalize(value: string): string {
    return value.trim().toUpperCase();
  }

  private validateCreate(payload: CreateShiftDto): void {
    if (!payload?.shiftCode?.trim())  throw new BadRequestException('shiftCode is required');
    if (!payload?.shiftName?.trim())  throw new BadRequestException('shiftName is required');
    this.validateTime(payload.startTime, 'startTime');
    this.validateTime(payload.endTime, 'endTime');
    this.validateGrace(payload.graceMinutes);
    this.validateStatus(payload.status);
  }

  private validateUpdate(payload: UpdateShiftDto): void {
    if (payload.shiftName !== undefined && !payload.shiftName.trim())
      throw new BadRequestException('shiftName cannot be empty');
    if (payload.startTime  !== undefined) this.validateTime(payload.startTime,  'startTime');
    if (payload.endTime    !== undefined) this.validateTime(payload.endTime,    'endTime');
    if (payload.graceMinutes !== undefined) this.validateGrace(payload.graceMinutes);
    if (payload.status     !== undefined) this.validateStatus(payload.status);
  }

  private validateTime(value: string, field: string): void {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value))
      throw new BadRequestException(`${field} must be in HH:MM format`);
  }

  private validateGrace(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 180)
      throw new BadRequestException('graceMinutes must be an integer between 0 and 180');
  }

  private validateStatus(value: string): void {
    if (value !== 'Active' && value !== 'Inactive')
      throw new BadRequestException("status must be 'Active' or 'Inactive'");
  }
}
