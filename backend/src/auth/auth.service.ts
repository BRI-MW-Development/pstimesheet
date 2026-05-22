import { BadRequestException, Inject, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { DEV_SQL_POOL, SQL_POOL } from '../database/database.constants';
import { UsersService } from '../users/users.service';

const ALLOWED_TS_TYPES = new Set(['PROD', 'INST', 'PROJ']);

const SESSION_TTL_HOURS = 8;
const MAX_FAILED        = 10;   // per username only (not IP — internal app with shared IPs)
const LOCKOUT_MINUTES   = 15;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DEV_SQL_POOL) private readonly pool: ConnectionPool,
    @Inject(SQL_POOL)     private readonly livePool: ConnectionPool,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    try {
      // Clear all failed attempts older than the lockout window on startup.
      // This ensures a server restart unlocks all accounts immediately.
      // Only remove attempts older than the lockout window so active lockouts survive restarts.
      const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000);
      await this.pool.request()
        .input('cutoff', mssql.DateTime2, cutoff)
        .query(`DELETE FROM PSTsFailedAttempts WHERE attemptAt <= @cutoff`);
      this.logger.log('Cleared expired failed login attempts');
    } catch (err) {
      this.logger.warn(`Startup cleanup skipped: ${(err as Error)?.message}`);
    }

    // Create indexes in the background — never block startup waiting for a DB lock.
    // Each statement runs separately so one failure doesn't abort the others.
    setImmediate(() => this.createIndexes());
  }

  private async createIndexes() {
    const indexes = [
      { name: 'IX_LoginHistory_attemptAt',         sql: `CREATE INDEX IX_LoginHistory_attemptAt         ON PSTsLoginHistory (attemptAt DESC)` },
      { name: 'IX_LoginHistory_userId_attemptAt',  sql: `CREATE INDEX IX_LoginHistory_userId_attemptAt  ON PSTsLoginHistory (userId, attemptAt DESC)` },
      { name: 'IX_LoginHistory_username_success',  sql: `CREATE INDEX IX_LoginHistory_username_success  ON PSTsLoginHistory (username, success, attemptAt DESC)` },
      { name: 'IX_Sessions_isActive_expiresAt',    sql: `CREATE INDEX IX_Sessions_isActive_expiresAt    ON PSTsSessions (isActive, expiresAt) INCLUDE (userId, createdAt, lastActiveAt)` },
      { name: 'IX_Sessions_sessionToken',          sql: `CREATE INDEX IX_Sessions_sessionToken          ON PSTsSessions (sessionToken) WHERE isActive = 1` },
      { name: 'IX_FailedAttempts_username_attemptAt', sql: `CREATE INDEX IX_FailedAttempts_username_attemptAt ON PSTsFailedAttempts (username, attemptAt DESC)` },
    ];

    for (const idx of indexes) {
      try {
        const exists = await this.pool.request()
          .input('name', mssql.NVarChar(128), idx.name)
          .query(`SELECT 1 AS found FROM sys.indexes WHERE name = @name`);
        if (!exists.recordset[0]) {
          await this.pool.request().query(idx.sql);
          this.logger.log(`Created index ${idx.name}`);
        }
      } catch (err) {
        this.logger.warn(`Skipped index ${idx.name}: ${(err as Error)?.message}`);
      }
    }
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async login(username: string, password: string, ip: string, userAgent: string, clientCity?: string, clientCountry?: string) {
    const user = await this.findUser(username);

    // lockout check
    const recentFails = await this.countRecentFails(username, ip);
    if (recentFails >= MAX_FAILED) {
      await this.logHistory({ userId: user?.userId ?? null, username, success: false, ip, userAgent, failReason: 'Account locked — too many failed attempts' });
      throw new UnauthorizedException('Account locked. Try again in 15 minutes.');
    }

    if (!user || !this.checkPassword(password, user.passwordHash)) {
      await this.recordFailedAttempt(username, ip);
      await this.logHistory({ userId: user?.userId ?? null, username, success: false, ip, userAgent, failReason: 'Invalid username or password', city: clientCity, country: clientCountry });
      const remaining = MAX_FAILED - recentFails - 1;
      throw new UnauthorizedException(remaining > 0 ? `Invalid credentials. ${remaining} attempt(s) remaining.` : 'Account locked. Try again in 15 minutes.');
    }

    // Transparently migrate legacy SHA-256 hashes to bcrypt on first successful login.
    if (!user.passwordHash.startsWith('$2b$')) {
      try {
        const newHash = bcrypt.hashSync(password, 12);
        await this.pool.request()
          .input('userId', mssql.NVarChar(30),  user.userId)
          .input('hash',   mssql.NVarChar(100), newHash)
          .query(`UPDATE PSTsUsers SET passwordHash = @hash WHERE userId = @userId`);
      } catch (err) {
        this.logger.warn(`bcrypt migration failed for ${username}: ${(err as Error)?.message}`);
      }
    }

    if (user.status !== 'Active') {
      await this.logHistory({ userId: user.userId, username, success: false, ip, userAgent, failReason: 'Account inactive', city: clientCity, country: clientCountry });
      throw new UnauthorizedException('Your account is inactive. Contact an administrator.');
    }

    const token    = this.generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);

    await this.pool.request()
      .input('token',     mssql.NVarChar(64),  token)
      .input('userId',    mssql.NVarChar(30),  user.userId)
      .input('expiresAt', mssql.DateTime2,     expiresAt)
      .input('ip',        mssql.NVarChar(45),  ip)
      .input('ua',        mssql.NVarChar(500), userAgent)
      .query(`INSERT INTO PSTsSessions (sessionToken,userId,expiresAt,ipAddress,userAgent) VALUES (@token,@userId,@expiresAt,@ip,@ua)`);

    // Use client-provided geo (browser sees real public IP); fall back to server-side lookup
    let city    = clientCity    || undefined;
    let country = clientCountry || undefined;
    if (!city && !country) {
      const geo = await this.geoLookup(ip);
      city    = geo?.city;
      country = geo?.country;
    }
    await this.logHistory({ userId: user.userId, username, success: true, ip, userAgent, failReason: null, sessionToken: token, city, country });

    this.logger.log(`Login: ${username} from ${ip}`);
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      mustChangePassword: !!user.mustChangePassword,
      user: { userId: user.userId, username: user.username, displayName: user.displayName, roleCode: user.roleCode, employeeCode: user.employeeCode ?? null },
    };
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async logout(token: string) {
    await this.pool.request()
      .input('token', mssql.NVarChar(64), token)
      .query(`UPDATE PSTsSessions SET isActive=0, loggedOutAt=GETDATE() WHERE sessionToken=@token`);
  }

  // ── Validate session (used by guard) ──────────────────────────────────────
  async validateSession(token: string): Promise<{ userId: string; username: string; displayName: string; roleCode: string; employeeCode: string | null }> {
    const res = await this.pool.request()
      .input('token', mssql.NVarChar(64), token)
      .query<{ userId: string; username: string; displayName: string; roleCode: string; employeeCode: string | null; expiresAt: Date; isActive: boolean }>(`
        SELECT s.userId, u.username, u.displayName, u.roleCode, u.employeeCode, s.expiresAt, s.isActive
        FROM   PSTsSessions s
        JOIN   PSTsUsers    u ON u.userId = s.userId
        WHERE  s.sessionToken = @token
      `);
    const session = res.recordset[0];
    if (!session || !session.isActive || new Date(session.expiresAt) < new Date()) {
      throw new UnauthorizedException('Session expired or invalid. Please log in again.');
    }
    // bump lastActiveAt
    await this.pool.request()
      .input('token', mssql.NVarChar(64), token)
      .query(`UPDATE PSTsSessions SET lastActiveAt=GETDATE() WHERE sessionToken=@token`);

    return { userId: session.userId, username: session.username, displayName: session.displayName, roleCode: session.roleCode, employeeCode: session.employeeCode ?? null };
  }

  // ── Login history ──────────────────────────────────────────────────────────
  async getLoginHistory(days: number | null = 30, page = 1, limit = 100) {
    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const offset    = (safePage - 1) * safeLimit;

    const req = this.pool.request();
    let where = '';
    if (days) {
      req.input('cutoff', mssql.DateTime2, new Date(Date.now() - days * 86400_000));
      where = 'WHERE attemptAt >= @cutoff';
    }

    const [dataRes, countRes] = await Promise.all([
      req.input('offset', mssql.Int, offset)
         .input('limit',  mssql.Int, safeLimit)
         .query(`
           SELECT id, userId, username, attemptAt, success, ipAddress, userAgent, city, country, failReason
           FROM   PSTsLoginHistory ${where}
           ORDER  BY attemptAt DESC
           OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
         `),
      this.pool.request()
        .input('cutoff2', mssql.DateTime2, days ? new Date(Date.now() - days * 86400_000) : null)
        .query(`
          SELECT COUNT(*) AS total FROM PSTsLoginHistory
          ${days ? 'WHERE attemptAt >= @cutoff2' : ''}
        `),
    ]);

    return {
      data:  dataRes.recordset,
      total: countRes.recordset[0]?.total ?? 0,
      page:  safePage,
      pages: Math.ceil((countRes.recordset[0]?.total ?? 0) / safeLimit),
      limit: safeLimit,
    };
  }

  async getUserLoginHistory(userId: string, days: number | null = 30, page = 1, limit = 100) {
    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const offset    = (safePage - 1) * safeLimit;

    const req = this.pool.request().input('userId', mssql.NVarChar(30), userId);
    let where = 'WHERE userId=@userId';
    if (days) {
      req.input('cutoff', mssql.DateTime2, new Date(Date.now() - days * 86400_000));
      where += ' AND attemptAt >= @cutoff';
    }

    const [dataRes, countRes] = await Promise.all([
      req.input('offset', mssql.Int, offset)
         .input('limit',  mssql.Int, safeLimit)
         .query(`
           SELECT id, username, attemptAt, success, ipAddress, city, country, failReason
           FROM   PSTsLoginHistory ${where}
           ORDER  BY attemptAt DESC
           OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
         `),
      this.pool.request()
        .input('userId2', mssql.NVarChar(30), userId)
        .input('cutoff2', mssql.DateTime2,    days ? new Date(Date.now() - days * 86400_000) : null)
        .query(`
          SELECT COUNT(*) AS total FROM PSTsLoginHistory
          WHERE userId=@userId2
          ${days ? 'AND attemptAt >= @cutoff2' : ''}
        `),
    ]);

    return {
      data:  dataRes.recordset,
      total: countRes.recordset[0]?.total ?? 0,
      page:  safePage,
      pages: Math.ceil((countRes.recordset[0]?.total ?? 0) / safeLimit),
      limit: safeLimit,
    };
  }

  // ── Active sessions ────────────────────────────────────────────────────────
  async getActiveSessions() {
    const res = await this.pool.request().query(`
      SELECT s.sessionToken, s.userId, u.username, u.displayName,
             s.createdAt, s.expiresAt, s.lastActiveAt, s.ipAddress, s.userAgent
      FROM   PSTsSessions s
      JOIN   PSTsUsers    u ON u.userId = s.userId
      WHERE  s.isActive = 1 AND s.expiresAt > GETDATE()
      ORDER  BY s.lastActiveAt DESC
    `);
    return res.recordset;
  }

  // Invalidates all active sessions for a target user.
  // callerToken is excluded so the admin doesn't accidentally log themselves out.
  async forceLogoutUser(targetUserId: string, callerToken: string) {
    await this.pool.request()
      .input('userId',      mssql.NVarChar(30), targetUserId)
      .input('callerToken', mssql.NVarChar(64), callerToken)
      .query(`
        UPDATE PSTsSessions
        SET    isActive=0, loggedOutAt=GETDATE()
        WHERE  userId=@userId AND isActive=1 AND sessionToken<>@callerToken
      `);
  }

  // ── My login audit ────────────────────────────────────────────────────────
  async getMyLoginAudit(userId: string, currentToken: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [prevLogin, prevMobile, todaySuccess, todayFail, lastPwChange] = await Promise.all([
      // Previous successful login (excluding current session)
      this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .input('token',  mssql.NVarChar(64), currentToken)
        .query<{ attemptAt: Date }>(`
          SELECT TOP 1 attemptAt FROM PSTsLoginHistory
          WHERE userId=@userId AND success=1 AND (sessionToken IS NULL OR sessionToken<>@token)
          ORDER BY attemptAt DESC
        `),

      // Previous mobile login (detect by userAgent)
      this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .query<{ attemptAt: Date }>(`
          SELECT TOP 1 attemptAt FROM PSTsLoginHistory
          WHERE userId=@userId AND success=1
            AND (userAgent LIKE '%Mobile%' OR userAgent LIKE '%Android%' OR userAgent LIKE '%iPhone%' OR userAgent LIKE '%iPad%')
          ORDER BY attemptAt DESC
        `),

      // Successful logins today
      this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .input('today',  mssql.DateTime2,    today)
        .query<{ cnt: number }>(`
          SELECT COUNT(*) AS cnt FROM PSTsLoginHistory
          WHERE userId=@userId AND success=1 AND attemptAt >= @today
        `),

      // Failed logins today
      this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .input('today',  mssql.DateTime2,    today)
        .query<{ cnt: number }>(`
          SELECT COUNT(*) AS cnt FROM PSTsLoginHistory
          WHERE userId=@userId AND success=0 AND attemptAt >= @today
        `),

      // Last password change
      this.pool.request()
        .input('userId', mssql.NVarChar(30), userId)
        .query<{ changedAt: Date }>(`
          SELECT TOP 1 changedAt FROM PSTsPasswordHistory
          WHERE userId=@userId ORDER BY changedAt DESC
        `),
    ]);

    const lastChange = lastPwChange.recordset[0]?.changedAt ?? null;
    const expiry     = lastChange
      ? new Date(new Date(lastChange).getTime() + 90 * 86400_000).toISOString()
      : null;

    return {
      previousLogin:      prevLogin.recordset[0]?.attemptAt  ?? null,
      previousMobileLogin:prevMobile.recordset[0]?.attemptAt ?? null,
      successfulToday:    todaySuccess.recordset[0]?.cnt      ?? 0,
      failuresToday:      todayFail.recordset[0]?.cnt         ?? 0,
      lastPasswordChange: lastChange,
      passwordExpiry:     expiry,
    };
  }

  // ── My permissions ────────────────────────────────────────────────────────
  async getMyPermissions(roleCode: string) {
    const [permsRes, roleRes] = await Promise.all([
      this.pool.request()
        .input('roleCode', mssql.NVarChar(30), roleCode)
        .query<{ module: string; canCreate: boolean; canRead: boolean; canWrite: boolean; canDelete: boolean; canReport: boolean }>(`
          SELECT module, canCreate, canRead, canWrite, canDelete, canReport
          FROM   PSTsRolePermissions WHERE roleCode = @roleCode
        `),
      this.pool.request()
        .input('roleCode', mssql.NVarChar(30), roleCode)
        .query<{ dataScope: string }>(`
          SELECT ISNULL(dataScope,'All') AS dataScope FROM PSTsRoles WHERE roleCode = @roleCode
        `),
    ]);
    return {
      permissions: permsRes.recordset,
      dataScope:   roleRes.recordset[0]?.dataScope ?? 'All',
    };
  }

  // ── Dashboard stats (role-aware) ──────────────────────────────────────────
  async getDashboardStats(userId: string, roleCode: string) {
    // ── 1. Look up role's dataScope and accessible TS modules ──────────────
    const [roleQ, permsQ] = await Promise.all([
      this.pool.request()
        .input('rc', mssql.NVarChar(30), roleCode)
        .query<{ dataScope: string }>(`
          SELECT ISNULL(dataScope,'All') AS dataScope FROM PSTsRoles WHERE roleCode = @rc
        `).catch(() => ({ recordset: [{ dataScope: 'All' }] })),
      this.pool.request()
        .input('rc', mssql.NVarChar(30), roleCode)
        .query<{ module: string }>(`
          SELECT module FROM PSTsRolePermissions
          WHERE roleCode = @rc AND canRead = 1
            AND module IN ('PROD','INST','PROJ','WO_COMPLETE')
        `).catch(() => ({ recordset: [] })),
    ]);

    const dataScope   = roleQ.recordset[0]?.dataScope ?? 'All';
    const accessible  = permsQ.recordset.map(p => p.module);
    // Whitelist-filter before any SQL interpolation (C-3)
    const tsTypes     = accessible.filter(m => ALLOWED_TS_TYPES.has(m));
    const hasWoc      = accessible.includes('WO_COMPLETE');

    // ── 2. Build dynamic WHERE for PSTsHeader ─────────────────────────────
    // Values come from the ALLOWED_TS_TYPES constant set — safe for interpolation.
    const typeSql = tsTypes.length === 0
      ? '1=0'
      : tsTypes.length < 3
        ? `tsType IN (${tsTypes.map(t => `'${t}'`).join(',')})`
        : '1=1';

    // 'Own'     → filter to records entered by this user only.
    // 'OwnDept' → dept-level leaders see all records of their accessible tsTypes (no extra filter
    //             needed — the tsType permission above already restricts to their dept's type).
    // 'All'     → no additional filter.
    const ownSql = dataScope === 'Own' ? `AND enteredByUserId = @uid` : '';

    const tsWhere = `isDeleted = 0 AND ${typeSql} ${ownSql}`;

    // ── 3. Run queries in parallel ─────────────────────────────────────────
    const tsReq    = this.pool.request().input('uid', mssql.NVarChar(30), userId);
    const recReq   = this.pool.request().input('uid', mssql.NVarChar(30), userId);

    const [tsRes, wocRes, recentRes] = await Promise.all([
      tsReq.query<{ total: number; draft: number; submitted: number; approved: number; thisMonth: number; prodCount: number; instCount: number; projCount: number }>(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status='Draft'     THEN 1 ELSE 0 END) AS draft,
          SUM(CASE WHEN status='Submitted' THEN 1 ELSE 0 END) AS submitted,
          SUM(CASE WHEN status='Approved'  THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN YEAR(entryDate)=YEAR(GETDATE()) AND MONTH(entryDate)=MONTH(GETDATE()) THEN 1 ELSE 0 END) AS thisMonth,
          SUM(CASE WHEN tsType='PROD' THEN 1 ELSE 0 END) AS prodCount,
          SUM(CASE WHEN tsType='INST' THEN 1 ELSE 0 END) AS instCount,
          SUM(CASE WHEN tsType='PROJ' THEN 1 ELSE 0 END) AS projCount
        FROM PSTsHeader WHERE ${tsWhere}
      `).catch(() => ({ recordset: [{ total:0, draft:0, submitted:0, approved:0, thisMonth:0, prodCount:0, instCount:0, projCount:0 }] })),

      hasWoc
        ? this.pool.request().query<{ total: number; thisMonth: number }>(`
            SELECT COUNT(*) AS total,
              SUM(CASE WHEN YEAR(completedDate)=YEAR(GETDATE()) AND MONTH(completedDate)=MONTH(GETDATE()) THEN 1 ELSE 0 END) AS thisMonth
            FROM PsWoComplete
          `).catch(() => ({ recordset: [{ total:0, thisMonth:0 }] }))
        : Promise.resolve({ recordset: [{ total:0, thisMonth:0 }] }),

      recReq.query(`
        SELECT TOP 10 tsDocNo, tsType, projectName, entryDate, entered_by_name, status, createdAt
        FROM PSTsHeader WHERE ${tsWhere} ORDER BY createdAt DESC
      `).catch(() => ({ recordset: [] })),
    ]);

    return {
      timesheets:       tsRes.recordset[0]   ?? { total:0, draft:0, submitted:0, approved:0, thisMonth:0, prodCount:0, instCount:0, projCount:0 },
      woComplete:       hasWoc ? (wocRes.recordset[0] ?? { total:0, thisMonth:0 }) : null,
      recentTimesheets: recentRes.recordset,
      // metadata the frontend uses for conditional rendering
      meta: { tsTypes, hasWoc, dataScope },
    };
  }

  // ── Change password (self-service) ─────────────────────────────────────────
  async changePassword(userId: string, currentPassword: string, newPassword: string, currentToken: string): Promise<void> {
    const user = await this.findUserById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    if (!this.checkPassword(currentPassword, user.passwordHash))
      throw new BadRequestException('Current password is incorrect');

    this.usersService.validatePasswordPolicy(newPassword, user.username);
    await this.usersService.checkPasswordHistory(userId, newPassword);
    const newHash = this.usersService.hash(newPassword);

    await this.pool.request()
      .input('userId',       mssql.NVarChar(30),  userId)
      .input('passwordHash', mssql.NVarChar(100), newHash)
      .query(`
        UPDATE PSTsUsers
        SET    passwordHash       = @passwordHash,
               mustChangePassword = 0,
               updatedAt          = GETDATE()
        WHERE  userId = @userId
      `);

    await this.usersService.pushPasswordHistory(userId, newHash);

    // invalidate all other sessions for this user
    await this.pool.request()
      .input('userId', mssql.NVarChar(30), userId)
      .input('token',  mssql.NVarChar(64), currentToken)
      .query(`UPDATE PSTsSessions SET isActive=0, loggedOutAt=GETDATE() WHERE userId=@userId AND sessionToken<>@token AND isActive=1`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private async findUser(username: string) {
    const res = await this.pool.request()
      .input('username', mssql.NVarChar(50), username.trim())
      .query<{ userId: string; username: string; displayName: string; passwordHash: string; roleCode: string; status: string; mustChangePassword: boolean; employeeCode: string | null }>(`
        SELECT userId, username, displayName, passwordHash, roleCode, status, mustChangePassword, employeeCode
        FROM   PSTsUsers WHERE username = @username
      `);
    return res.recordset[0] ?? null;
  }

  private async findUserById(userId: string) {
    const res = await this.pool.request()
      .input('userId', mssql.NVarChar(30), userId)
      .query<{ userId: string; username: string; passwordHash: string }>(`
        SELECT userId, username, passwordHash FROM PSTsUsers WHERE userId = @userId
      `);
    return res.recordset[0] ?? null;
  }

  private checkPassword(plain: string, storedHash: string): boolean {
    if (!storedHash) return false;

    const h = storedHash.trim();

    // bcrypt ($2b$ or $2a$ from older implementations)
    if (h.startsWith('$2b$') || h.startsWith('$2a$')) {
      return bcrypt.compareSync(plain, h);
    }

    // SHA-256 in various formats Node.js or SQL Server may have produced:
    //   lowercase hex  (crypto digest('hex'))
    //   uppercase hex  (SQL Server CONVERT(..., 2) or toUpperCase())
    //   0x-prefixed    (SQL Server CONVERT(..., 1))
    //   base64         (crypto digest('base64'))
    const sha256hex = crypto.createHash('sha256').update(plain).digest('hex');
    const sha256b64 = crypto.createHash('sha256').update(plain).digest('base64');

    if (sha256hex === h || sha256hex.toUpperCase() === h)          return true;
    if (('0x' + sha256hex.toUpperCase()) === h.toUpperCase())      return true;
    if (sha256b64 === h)                                           return true;

    this.logger.warn(`checkPassword failed — stored hash: len=${h.length} prefix="${h.substring(0, 6)}"`);
    return false;
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async countRecentFails(username: string, _ip: string): Promise<number> {
    // Lock by username only — IP-based locking causes everyone on the same
    // internal network to be blocked when any one user has too many failures.
    const res = await this.pool.request()
      .input('username', mssql.NVarChar(50), username)
      .input('cutoff',   mssql.DateTime2,    new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000))
      .query<{ cnt: number }>(`
        SELECT COUNT(*) AS cnt FROM PSTsFailedAttempts
        WHERE username = @username AND attemptAt > @cutoff
      `);
    return res.recordset[0]?.cnt ?? 0;
  }

  private async recordFailedAttempt(username: string, ip: string) {
    await this.pool.request()
      .input('username', mssql.NVarChar(50), username)
      .input('ip',       mssql.NVarChar(45), ip)
      .query(`INSERT INTO PSTsFailedAttempts (username, ipAddress) VALUES (@username, @ip)`);
  }

  private async logHistory(data: {
    userId: string | null; username: string; success: boolean;
    ip: string; userAgent: string; failReason: string | null;
    sessionToken?: string; city?: string; country?: string;
  }) {
    await this.pool.request()
      .input('userId',       mssql.NVarChar(30),  data.userId)
      .input('username',     mssql.NVarChar(50),  data.username)
      .input('success',      mssql.Bit,            data.success ? 1 : 0)
      .input('ip',           mssql.NVarChar(45),  data.ip)
      .input('ua',           mssql.NVarChar(500), data.userAgent)
      .input('city',         mssql.NVarChar(100), data.city   ?? null)
      .input('country',      mssql.NVarChar(100), data.country ?? null)
      .input('failReason',   mssql.NVarChar(200), data.failReason ?? null)
      .input('sessionToken', mssql.NVarChar(64),  data.sessionToken ?? null)
      .query(`
        INSERT INTO PSTsLoginHistory (userId,username,success,ipAddress,userAgent,city,country,failReason,sessionToken)
        VALUES (@userId,@username,@success,@ip,@ua,@city,@country,@failReason,@sessionToken)
      `);
  }

  private async geoLookup(ip: string): Promise<{ city: string; country: string } | null> {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) return null;
    try {
      const res  = await fetch(`https://ip-api.com/json/${ip}?fields=city,country,status`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json() as any;
      if (data.status === 'success') return { city: data.city, country: data.country };
    } catch { /* geo lookup is best-effort */ }
    return null;
  }
}
