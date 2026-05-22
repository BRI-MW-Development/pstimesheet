import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { DEV_SQL_POOL } from '../database/database.constants';

const BCRYPT_ROUNDS = 12;

export interface User {
  userId: string;
  username: string;
  displayName: string;
  roleCode: string;
  email: string | null;
  phone: string | null;
  status: string;
  mustChangePassword: boolean;
  employeeCode: string | null;
  departmentCode: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const PW_HISTORY_KEEP = 3;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(@Inject(DEV_SQL_POOL) private readonly pool: ConnectionPool) {}

  async onModuleInit() {
    try {
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsUsers') AND name='employeeCode')
          ALTER TABLE PSTsUsers ADD employeeCode NVARCHAR(30) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsUsers') AND name='departmentCode')
          ALTER TABLE PSTsUsers ADD departmentCode NVARCHAR(30) NULL;
        -- Widen passwordHash column to hold bcrypt hashes (60 chars) and legacy SHA-256 (64 chars)
        IF EXISTS (
          SELECT 1 FROM sys.columns
          WHERE object_id=OBJECT_ID('PSTsUsers') AND name='passwordHash' AND max_length < 200
        ) ALTER TABLE PSTsUsers ALTER COLUMN passwordHash NVARCHAR(100) NOT NULL;
        IF EXISTS (
          SELECT 1 FROM sys.columns
          WHERE object_id=OBJECT_ID('PSTsPasswordHistory') AND name='passwordHash' AND max_length < 200
        ) ALTER TABLE PSTsPasswordHistory ALTER COLUMN passwordHash NVARCHAR(100) NOT NULL;
      `);
    } catch (err) {
      this.logger.warn(`Schema init skipped (will retry on next request): ${(err as Error)?.message}`);
    }
  }

  async findAll(): Promise<User[]> {
    const res = await this.pool.request().query<User>(`
      SELECT u.userId, u.username, u.displayName, u.roleCode,
             ISNULL(r.roleName, u.roleCode) AS roleName,
             u.email, u.phone, u.status,
             u.mustChangePassword, u.employeeCode, u.departmentCode,
             CONVERT(VARCHAR(24), u.createdAt, 126) AS createdAt,
             CONVERT(VARCHAR(24), u.updatedAt, 126) AS updatedAt,
             CONVERT(VARCHAR(24), ll.attemptAt, 126) AS lastLoginAt,
             CASE WHEN ISNULL(fa.failCount, 0) >= 10 THEN 1 ELSE 0 END AS isLocked
      FROM   PSTsUsers u
      LEFT JOIN PSTsRoles r ON r.roleCode = u.roleCode
      OUTER APPLY (
        SELECT TOP 1 l.attemptAt FROM PSTsLoginHistory l
        WHERE l.userId = u.userId AND l.success = 1
        ORDER BY l.attemptAt DESC
      ) ll
      OUTER APPLY (
        SELECT COUNT(*) AS failCount FROM PSTsFailedAttempts fa
        WHERE fa.username = u.username
          AND fa.attemptAt >= DATEADD(MINUTE, -15, GETDATE())
      ) fa
      ORDER BY u.userId
    `);
    return res.recordset;
  }

  async findOne(userId: string): Promise<User> {
    const res = await this.pool.request()
      .input('userId', mssql.NVarChar(30), userId)
      .query<User>(`
        SELECT u.userId, u.username, u.displayName, u.roleCode,
               ISNULL(r.roleName, u.roleCode) AS roleName,
               u.email, u.phone, u.status,
               u.mustChangePassword, u.employeeCode, u.departmentCode,
               CONVERT(VARCHAR(24), u.createdAt, 126) AS createdAt,
               CONVERT(VARCHAR(24), u.updatedAt, 126) AS updatedAt,
               CONVERT(VARCHAR(24), (
                 SELECT TOP 1 l.attemptAt FROM PSTsLoginHistory l
                 WHERE l.userId = u.userId AND l.success = 1
                 ORDER BY l.attemptAt DESC
               ), 126) AS lastLoginAt
        FROM   PSTsUsers u
        LEFT JOIN PSTsRoles r ON r.roleCode = u.roleCode
        WHERE  u.userId = @userId
      `);
    if (!res.recordset[0]) throw new NotFoundException(`User '${userId}' not found`);
    return res.recordset[0];
  }

  async nextUserId(): Promise<string> {
    const res = await this.pool.request().query<{ maxNo: number }>(`
      SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(userId, 5, LEN(userId)) AS INT)), 0) AS maxNo
      FROM PSTsUsers WHERE userId LIKE 'USR-%'
    `);
    const next = (res.recordset[0]?.maxNo ?? 0) + 1;
    return `USR-${String(next).padStart(4, '0')}`;
  }

  async create(body: {
    username: string; displayName: string; password: string;
    roleCode: string; email?: string; phone?: string; status: string;
    employeeCode?: string; departmentCode?: string;
  }): Promise<User> {
    if (!body.username?.trim())    throw new BadRequestException('username is required');
    if (!body.displayName?.trim()) throw new BadRequestException('displayName is required');
    if (!body.password?.trim())    throw new BadRequestException('password is required');
    if (!body.roleCode?.trim())    throw new BadRequestException('roleCode is required');

    this.validatePasswordPolicy(body.password, body.username);

    const userId       = await this.nextUserId();
    const passwordHash = this.hash(body.password);

    try {
      await this.pool.request()
        .input('userId',         mssql.NVarChar(30),  userId)
        .input('username',       mssql.NVarChar(50),  body.username.trim())
        .input('displayName',    mssql.NVarChar(100), body.displayName.trim())
        .input('passwordHash',   mssql.NVarChar(100), passwordHash)
        .input('roleCode',       mssql.NVarChar(30),  body.roleCode.trim())
        .input('email',          mssql.NVarChar(150), body.email          || null)
        .input('phone',          mssql.NVarChar(30),  body.phone          || null)
        .input('status',         mssql.NVarChar(10),  body.status         || 'Active')
        .input('employeeCode',   mssql.NVarChar(30),  body.employeeCode   || null)
        .input('departmentCode', mssql.NVarChar(30),  body.departmentCode || null)
        .query(`
          INSERT INTO PSTsUsers (userId, username, displayName, passwordHash, roleCode, email, phone, status, employeeCode, departmentCode)
          VALUES (@userId, @username, @displayName, @passwordHash, @roleCode, @email, @phone, @status, @employeeCode, @departmentCode)
        `);
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601)
        throw new BadRequestException(`Username '${body.username}' already exists`);
      throw err;
    }

    await this.pushPasswordHistory(userId, passwordHash);
    return this.findOne(userId);
  }

  async update(userId: string, body: {
    displayName?: string; password?: string;
    roleCode?: string; email?: string; phone?: string; status?: string;
    employeeCode?: string; departmentCode?: string;
  }): Promise<User> {
    const existing = await this.findOne(userId);

    let passwordHash: string | null = null;
    if (body.password) {
      this.validatePasswordPolicy(body.password, existing.username);
      await this.checkPasswordHistory(userId, body.password);
      passwordHash = this.hash(body.password);
    }

    await this.pool.request()
      .input('userId',         mssql.NVarChar(30),  existing.userId)
      .input('displayName',    mssql.NVarChar(100), body.displayName?.trim()  ?? existing.displayName)
      .input('passwordHash',   mssql.NVarChar(100), passwordHash)
      .input('roleCode',       mssql.NVarChar(30),  body.roleCode?.trim()     ?? existing.roleCode)
      .input('email',          mssql.NVarChar(150), body.email          !== undefined ? (body.email  || null) : existing.email)
      .input('phone',          mssql.NVarChar(30),  body.phone          !== undefined ? (body.phone  || null) : existing.phone)
      .input('status',         mssql.NVarChar(10),  body.status               ?? existing.status)
      .input('employeeCode',   mssql.NVarChar(30),  body.employeeCode   !== undefined ? (body.employeeCode   || null) : existing.employeeCode)
      .input('departmentCode', mssql.NVarChar(30),  body.departmentCode !== undefined ? (body.departmentCode || null) : existing.departmentCode)
      .query(`
        UPDATE PSTsUsers
        SET    displayName    = @displayName,
               passwordHash   = CASE WHEN @passwordHash IS NOT NULL THEN @passwordHash ELSE passwordHash END,
               roleCode       = @roleCode,
               email          = @email,
               phone          = @phone,
               status         = @status,
               employeeCode   = @employeeCode,
               departmentCode = @departmentCode,
               updatedAt      = GETDATE()
        WHERE  userId = @userId
      `);

    if (passwordHash) await this.pushPasswordHistory(userId, passwordHash);
    return this.findOne(userId);
  }

  async resetPassword(userId: string): Promise<{ tempPassword: string }> {
    const user = await this.findOne(userId);
    const tempPassword = this.generateTempPassword();
    const passwordHash = this.hash(tempPassword);

    await this.pool.request()
      .input('userId',       mssql.NVarChar(30),  user.userId)
      .input('passwordHash', mssql.NVarChar(100), passwordHash)
      .query(`
        UPDATE PSTsUsers
        SET    passwordHash       = @passwordHash,
               mustChangePassword = 1,
               updatedAt          = GETDATE()
        WHERE  userId = @userId
      `);

    await this.pushPasswordHistory(userId, passwordHash);
    return { tempPassword };
  }

  async remove(userId: string): Promise<{ message: string }> {
    await this.findOne(userId);
    await this.pool.request()
      .input('userId', mssql.NVarChar(30), userId)
      .query(`DELETE FROM PSTsUsers WHERE userId = @userId`);
    return { message: `User '${userId}' deleted` };
  }

  async unlock(userId: string): Promise<{ message: string }> {
    const user = await this.findOne(userId);
    await this.pool.request()
      .input('username', mssql.NVarChar(50), user.username)
      .query(`DELETE FROM PSTsFailedAttempts WHERE username = @username`);
    return { message: `User '${user.username}' unlocked` };
  }

  // ── Password policy ────────────────────────────────────────────────────────
  validatePasswordPolicy(password: string, username: string): void {
    const errors: string[] = [];
    if (password.length < 8)                   errors.push('at least 8 characters');
    if (!/[A-Z]/.test(password))               errors.push('one uppercase letter');
    if (!/[a-z]/.test(password))               errors.push('one lowercase letter');
    if (!/[0-9]/.test(password))               errors.push('one number');
    if (!/[^A-Za-z0-9]/.test(password))        errors.push('one special character');
    if (/\s/.test(password))                   errors.push('no spaces allowed');
    if (username && password.toLowerCase().includes(username.toLowerCase()))
                                               errors.push('password must not contain username');
    if (errors.length) throw new BadRequestException(`Password must have: ${errors.join(', ')}`);
  }

  // ── Password history ───────────────────────────────────────────────────────
  // Accepts the plaintext password — required for bcrypt comparison (salted, non-deterministic).
  async checkPasswordHistory(userId: string, plain: string): Promise<void> {
    const res = await this.pool.request()
      .input('userId', mssql.NVarChar(30), userId)
      .input('keep',   mssql.Int,          PW_HISTORY_KEEP)
      .query<{ passwordHash: string }>(`
        SELECT TOP (@keep) passwordHash FROM PSTsPasswordHistory
        WHERE userId = @userId ORDER BY changedAt DESC
      `);
    const reused = res.recordset.some(r => {
      if (r.passwordHash.startsWith('$2b$')) return bcrypt.compareSync(plain, r.passwordHash);
      // legacy SHA-256 history entries
      return crypto.createHash('sha256').update(plain).digest('hex') === r.passwordHash;
    });
    if (reused) throw new BadRequestException(`Cannot reuse one of your last ${PW_HISTORY_KEEP} passwords`);
  }

  async pushPasswordHistory(userId: string, passwordHash: string): Promise<void> {
    await this.pool.request()
      .input('userId',       mssql.NVarChar(30),  userId)
      .input('passwordHash', mssql.NVarChar(100), passwordHash)
      .query(`INSERT INTO PSTsPasswordHistory (userId, passwordHash) VALUES (@userId, @passwordHash)`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  hash(plain: string): string {
    return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
  }

  private generateTempPassword(): string {
    const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower   = 'abcdefghjkmnpqrstuvwxyz';
    const digits  = '23456789';
    const special = '!@#$%^&*';
    const all     = upper + lower + digits + special;
    const rand    = (set: string) => set[crypto.randomInt(set.length)];
    const base    = [rand(upper), rand(lower), rand(digits), rand(special)];
    for (let i = 0; i < 6; i++) base.push(rand(all));
    // Fisher-Yates shuffle
    for (let i = base.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [base[i], base[j]] = [base[j], base[i]];
    }
    return base.join('');
  }
}
