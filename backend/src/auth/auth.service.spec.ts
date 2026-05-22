import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { DEV_SQL_POOL, SQL_POOL } from '../database/database.constants';
import * as crypto from 'crypto';

// ── Mock DB request helper ────────────────────────────────────────────────────
function makeRequest(queryResult: any) {
  const req: any = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue(queryResult) };
  return req;
}

function makePool(queryResults: any[]) {
  let callIdx = 0;
  const pool = {
    request: jest.fn(() => {
      const result = queryResults[callIdx] ?? { recordset: [] };
      callIdx++;
      return makeRequest(result);
    }),
  };
  return pool;
}

// ── SHA-256 helper (mirrors auth service) ─────────────────────────────────────
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// ── UsersService mock ────────────────────────────────────────────────────────
const mockUsersService = {
  validatePasswordPolicy: jest.fn(),
  hash: jest.fn((pw: string) => sha256(pw)),
  checkPasswordHistory: jest.fn().mockResolvedValue(undefined),
  pushPasswordHistory: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;
  let devPool: any;
  let livePool: any;

  async function buildService(devQueries: any[], liveQueries: any[] = []) {
    devPool  = makePool(devQueries);
    livePool = makePool(liveQueries);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DEV_SQL_POOL, useValue: devPool },
        { provide: SQL_POOL,     useValue: livePool },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  }

  // ── onModuleInit ─────────────────────────────────────────────────────────
  describe('onModuleInit', () => {
    it('clears expired failed attempts on startup and schedules index creation', async () => {
      await buildService([{ recordset: [] }]);
      const setImmediateSpy = jest.spyOn(global, 'setImmediate').mockImplementation((fn: any) => { fn(); return {} as any; });
      // Provide enough pool results for createIndexes (6 checks + up to 6 creates)
      devPool = makePool(Array(12).fill({ recordset: [] }));
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: DEV_SQL_POOL, useValue: devPool },
          { provide: SQL_POOL,     useValue: livePool },
          { provide: UsersService, useValue: mockUsersService },
        ],
      }).compile();
      service = module.get<AuthService>(AuthService);
      await service.onModuleInit();
      expect(setImmediateSpy).toHaveBeenCalled();
      setImmediateSpy.mockRestore();
    });

    it('does not throw when DB is unavailable', async () => {
      devPool = { request: jest.fn(() => ({ input: jest.fn().mockReturnThis(), query: jest.fn().mockRejectedValue(new Error('DB down')) })) };
      livePool = makePool([]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: DEV_SQL_POOL, useValue: devPool },
          { provide: SQL_POOL,     useValue: livePool },
          { provide: UsersService, useValue: mockUsersService },
        ],
      }).compile();
      service = module.get<AuthService>(AuthService);
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  // ── login ────────────────────────────────────────────────────────────────
  describe('login', () => {
    // Use a real bcrypt hash so checkPassword works correctly without mocking.
    const import_bcrypt = require('bcrypt');
    const REAL_HASH = import_bcrypt.hashSync('Pass@1234', 4); // cost 4 for fast tests

    const user = {
      userId: 'USR-001', username: 'admin', displayName: 'Admin User',
      passwordHash: REAL_HASH, roleCode: 'ROLE-001',
      status: 'Active', mustChangePassword: false, employeeCode: null,
    };

    it('returns token on valid credentials', async () => {
      await buildService([
        { recordset: [user] },           // findUser
        { recordset: [{ cnt: 0 }] },     // countRecentFails
        { recordset: [] },               // INSERT session
        { recordset: [] },               // logHistory
      ]);
      const result = await service.login('admin', 'Pass@1234', '127.0.0.1', 'Jest/1.0');
      expect(result).toHaveProperty('token');
      expect(result.mustChangePassword).toBe(false);
      expect(result.user.username).toBe('admin');
    });

    it('returns token and migrates legacy SHA-256 hash to bcrypt on login', async () => {
      const legacyUser = { ...user, passwordHash: sha256('Pass@1234') }; // SHA-256 hash
      await buildService([
        { recordset: [legacyUser] },     // findUser
        { recordset: [{ cnt: 0 }] },     // countRecentFails
        { recordset: [] },               // bcrypt migration UPDATE
        { recordset: [] },               // INSERT session
        { recordset: [] },               // logHistory
      ]);
      const result = await service.login('admin', 'Pass@1234', '127.0.0.1', 'Jest/1.0');
      expect(result).toHaveProperty('token');
    });

    it('throws UnauthorizedException on wrong password', async () => {
      await buildService([
        { recordset: [user] },           // findUser
        { recordset: [{ cnt: 0 }] },     // countRecentFails
        { recordset: [] },               // recordFailedAttempt INSERT
        { recordset: [] },               // logHistory
      ]);
      await expect(service.login('admin', 'wrongpass', '127.0.0.1', 'Jest')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      await buildService([
        { recordset: [] },               // findUser — no rows
        { recordset: [{ cnt: 0 }] },     // countRecentFails
        { recordset: [] },               // recordFailedAttempt
        { recordset: [] },               // logHistory
      ]);
      await expect(service.login('nobody', 'Pass@1234', '127.0.0.1', 'Jest')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when account is locked (≥10 fails)', async () => {
      await buildService([
        { recordset: [user] },           // findUser
        { recordset: [{ cnt: 10 }] },    // countRecentFails — at limit
        { recordset: [] },               // logHistory
      ]);
      await expect(service.login('admin', 'Pass@1234', '127.0.0.1', 'Jest')).rejects.toThrow('Account locked');
    });

    it('throws UnauthorizedException when account is inactive', async () => {
      const inactiveUser = { ...user, status: 'Inactive' };
      await buildService([
        { recordset: [inactiveUser] },   // findUser
        { recordset: [{ cnt: 0 }] },     // countRecentFails
        { recordset: [] },               // logHistory
      ]);
      await expect(service.login('admin', 'Pass@1234', '127.0.0.1', 'Jest')).rejects.toThrow('inactive');
    });
  });

  // ── logout ───────────────────────────────────────────────────────────────
  describe('logout', () => {
    it('updates session to inactive', async () => {
      await buildService([{ recordset: [] }]);
      await expect(service.logout('some-token')).resolves.not.toThrow();
    });
  });

  // ── validateSession ──────────────────────────────────────────────────────
  describe('validateSession', () => {
    it('returns user info for valid session', async () => {
      const session = {
        userId: 'USR-001', username: 'admin', displayName: 'Admin User',
        roleCode: 'ROLE-001', employeeCode: null,
        expiresAt: new Date(Date.now() + 3600_000),
        isActive: true,
      };
      await buildService([
        { recordset: [session] },   // SELECT session + JOIN users
        { recordset: [] },          // UPDATE lastActiveAt
      ]);
      const result = await service.validateSession('valid-token');
      expect(result.username).toBe('admin');
      expect(result.roleCode).toBe('ROLE-001');
    });

    it('throws UnauthorizedException for expired session', async () => {
      const expired = {
        userId: 'USR-001', username: 'admin', displayName: 'Admin User',
        roleCode: 'ROLE-001', employeeCode: null,
        expiresAt: new Date(Date.now() - 1000),
        isActive: true,
      };
      await buildService([{ recordset: [expired] }]);
      await expect(service.validateSession('old-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for non-existent session', async () => {
      await buildService([{ recordset: [] }]);
      await expect(service.validateSession('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for inactive session', async () => {
      const inactive = {
        userId: 'USR-001', username: 'admin', displayName: 'Admin',
        roleCode: 'ROLE-001', employeeCode: null,
        expiresAt: new Date(Date.now() + 3600_000),
        isActive: false,
      };
      await buildService([{ recordset: [inactive] }]);
      await expect(service.validateSession('token')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── getMyPermissions ─────────────────────────────────────────────────────
  describe('getMyPermissions', () => {
    it('returns permissions and dataScope for a role', async () => {
      const perms = [
        { module: 'PROD', canCreate: true, canRead: true, canWrite: true, canDelete: false, canReport: true },
        { module: 'INST', canCreate: true, canRead: true, canWrite: true, canDelete: false, canReport: true },
      ];
      await buildService([
        { recordset: perms },               // permissions query
        { recordset: [{ dataScope: 'OwnDept' }] }, // role dataScope query
      ]);
      const result = await service.getMyPermissions('ROLE-003');
      expect(result.permissions).toHaveLength(2);
      expect(result.dataScope).toBe('OwnDept');
    });

    it('defaults dataScope to All when role not found', async () => {
      await buildService([
        { recordset: [] },   // no permissions
        { recordset: [] },   // role not found
      ]);
      const result = await service.getMyPermissions('ROLE-999');
      expect(result.dataScope).toBe('All');
    });
  });

  // ── getDashboardStats ────────────────────────────────────────────────────
  describe('getDashboardStats', () => {
    it('returns full stats for Admin (All scope, all TS types)', async () => {
      // Request order: #1 roleQ, #2 permsQ, #3 tsReq (pre-alloc), #4 recReq (pre-alloc), #5 woc (inside Promise.all)
      await buildService([
        { recordset: [{ dataScope: 'All' }] },                                                  // #1 role dataScope
        { recordset: [{ module: 'PROD' }, { module: 'INST' }, { module: 'PROJ' }, { module: 'WO_COMPLETE' }] }, // #2 permissions
        { recordset: [{ total:10, draft:2, submitted:3, approved:5, thisMonth:4, prodCount:4, instCount:3, projCount:3 }] }, // #3 ts stats
        { recordset: [{ tsDocNo:'TS-001', tsType:'PROD', status:'Draft' }] },                   // #4 recent (recReq)
        { recordset: [{ total:8, thisMonth:3 }] },                                               // #5 woc stats
      ]);
      const result = await service.getDashboardStats('USR-001', 'ROLE-001');
      expect(result.timesheets.total).toBe(10);
      expect(result.woComplete).not.toBeNull();
      expect(result.woComplete!.thisMonth).toBe(3);
      expect(result.meta.dataScope).toBe('All');
      expect(result.meta.tsTypes).toContain('PROD');
      expect(result.meta.hasWoc).toBe(true);
    });

    it('returns null woComplete when user has no WO_COMPLETE permission', async () => {
      await buildService([
        { recordset: [{ dataScope: 'Own' }] },                     // role dataScope
        { recordset: [{ module: 'PROJ' }] },                       // only PROJ access
        { recordset: [{ total:2, draft:1, submitted:1, approved:0, thisMonth:2, prodCount:0, instCount:0, projCount:2 }] }, // ts
        { recordset: [{ tsDocNo:'PR-001' }] },                     // recent
      ]);
      const result = await service.getDashboardStats('USR-006', 'ROLE-006');
      expect(result.woComplete).toBeNull();
      expect(result.meta.dataScope).toBe('Own');
      expect(result.meta.tsTypes).toEqual(['PROJ']);
      expect(result.meta.hasWoc).toBe(false);
    });

    it('returns zero stats when user has no TS permissions', async () => {
      await buildService([
        { recordset: [{ dataScope: 'All' }] },   // role dataScope
        { recordset: [] },                         // no TS permissions
        { recordset: [{ total:0, draft:0, submitted:0, approved:0, thisMonth:0, prodCount:0, instCount:0, projCount:0 }] },
        { recordset: [] },                         // recent
      ]);
      const result = await service.getDashboardStats('USR-007', 'ROLE-007');
      expect(result.timesheets.total).toBe(0);
      expect(result.meta.tsTypes).toHaveLength(0);
    });

    it('builds Own-scope filter for Production User (ROLE-009)', async () => {
      await buildService([
        { recordset: [{ dataScope: 'Own' }] },
        { recordset: [{ module: 'PROD' }] },
        { recordset: [{ total:3, draft:1, submitted:1, approved:1, thisMonth:3, prodCount:3, instCount:0, projCount:0 }] },
        { recordset: [] },
      ]);
      const result = await service.getDashboardStats('USR-009', 'ROLE-009');
      expect(result.meta.dataScope).toBe('Own');
      expect(result.meta.tsTypes).toEqual(['PROD']);
    });

    it('handles DB error gracefully and returns zeros', async () => {
      // Both parallel queries throw — the .catch() fallbacks kick in
      const errPool = {
        request: jest.fn(() => ({
          input: jest.fn().mockReturnThis(),
          query: jest.fn().mockRejectedValue(new Error('DB error')),
        })),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: DEV_SQL_POOL, useValue: errPool },
          { provide: SQL_POOL,     useValue: makePool([]) },
          { provide: UsersService, useValue: mockUsersService },
        ],
      }).compile();
      service = module.get<AuthService>(AuthService);
      const result = await service.getDashboardStats('USR-001', 'ROLE-001');
      expect(result.timesheets.total).toBe(0);
    });
  });

  // ── getMyLoginAudit ──────────────────────────────────────────────────────
  describe('getMyLoginAudit', () => {
    it('returns all audit fields', async () => {
      const prevLogin  = new Date('2026-05-19T09:00:00Z');
      const lastChange = new Date('2026-03-01T00:00:00Z');
      await buildService([
        { recordset: [{ attemptAt: prevLogin }] },   // prevLogin
        { recordset: [] },                            // prevMobile
        { recordset: [{ cnt: 3 }] },                 // successfulToday
        { recordset: [{ cnt: 1 }] },                 // failuresToday
        { recordset: [{ changedAt: lastChange }] },  // lastPwChange
      ]);
      const result = await service.getMyLoginAudit('USR-001', 'tok-123');
      expect(result.successfulToday).toBe(3);
      expect(result.failuresToday).toBe(1);
      expect(result.previousLogin).toEqual(prevLogin);
      expect(result.previousMobileLogin).toBeNull();
      expect(result.passwordExpiry).toBeTruthy();
    });

    it('returns null expiry when no password change history', async () => {
      await buildService([
        { recordset: [] },             // prevLogin
        { recordset: [] },             // prevMobile
        { recordset: [{ cnt: 1 }] },   // successfulToday
        { recordset: [{ cnt: 0 }] },   // failuresToday
        { recordset: [] },             // no pw history
      ]);
      const result = await service.getMyLoginAudit('USR-001', 'tok-123');
      expect(result.passwordExpiry).toBeNull();
      expect(result.lastPasswordChange).toBeNull();
    });
  });

  // ── changePassword ───────────────────────────────────────────────────────
  describe('changePassword', () => {
    it('throws when current password is wrong', async () => {
      await buildService([
        { recordset: [{ userId: 'USR-001', username: 'admin', passwordHash: sha256('correct') }] }, // findUserById
      ]);
      await expect(
        service.changePassword('USR-001', 'wrong', 'NewPass@1', 'tok'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when user is not found', async () => {
      await buildService([{ recordset: [] }]);
      await expect(
        service.changePassword('USR-999', 'Pass@1234', 'New@5678', 'tok'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('succeeds with correct current password', async () => {
      // Use a bcrypt hash so the migration branch is not triggered during this test.
      const bcryptHash = '$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ12345';
      await buildService([
        { recordset: [{ userId: 'USR-001', username: 'admin', passwordHash: bcryptHash }] }, // findUserById
        { recordset: [] }, // UPDATE passwordHash
        { recordset: [] }, // invalidate other sessions
      ]);
      mockUsersService.validatePasswordPolicy.mockReturnValue(undefined);
      mockUsersService.hash.mockReturnValue('$2b$12$newhashnewhashnewhashnuuABCDEFGHIJKLMNOPQRSTUVWXYZ12');
      mockUsersService.checkPasswordHistory.mockResolvedValue(undefined);
      mockUsersService.pushPasswordHistory.mockResolvedValue(undefined);

      // We need checkPassword to pass — bcrypt.compareSync would fail with a fake hash.
      // Spy on the private method via prototype.
      jest.spyOn(service as any, 'checkPassword').mockReturnValue(true);

      await expect(
        service.changePassword('USR-001', 'OldPass@1', 'NewPass@2', 'current-tok'),
      ).resolves.not.toThrow();
    });
  });
});
