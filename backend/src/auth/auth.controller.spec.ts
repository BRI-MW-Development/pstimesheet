import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, HttpException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PermissionGuard } from './permission.guard';

const mockPermissionGuard = { canActivate: jest.fn().mockResolvedValue(true) };

const mockAuthService = {
  login:              jest.fn(),
  logout:             jest.fn(),
  getMyPermissions:   jest.fn(),
  getMyLoginAudit:    jest.fn(),
  getDashboardStats:  jest.fn(),
  getLoginHistory:    jest.fn(),
  getUserLoginHistory:jest.fn(),
  getActiveSessions:  jest.fn(),
  forceLogout:        jest.fn(),
  changePassword:     jest.fn(),
};

const mockUsersService = {
  findOne:jest.fn(),
  update: jest.fn(),
};

const mockReq = {
  headers: { 'user-agent': 'Jest/1.0', 'x-forwarded-for': '1.2.3.4' },
  ip: '127.0.0.1',
  sessionToken: 'tok-123',
  currentUser: { userId: 'USR-001', username: 'admin', displayName: 'Admin User', roleCode: 'ROLE-001' },
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService,    useValue: mockAuthService },
        { provide: UsersService,   useValue: mockUsersService },
        { provide: PermissionGuard, useValue: mockPermissionGuard },
      ],
    })
    .overrideGuard(PermissionGuard).useValue(mockPermissionGuard)
    .compile();
    controller = module.get<AuthController>(AuthController);
  });

  // ── POST /login ───────────────────────────────────────────────────────
  describe('login', () => {
    it('returns token on valid credentials', async () => {
      const loginResult = { token: 'abc123', expiresAt: '2026-05-21T00:00:00Z', mustChangePassword: false, user: { userId: 'USR-001', username: 'admin' } };
      mockAuthService.login.mockResolvedValue(loginResult);
      const result = await controller.login({ username: 'admin', password: 'Pass@1234' }, mockReq);
      expect(result.token).toBe('abc123');
      expect(mockAuthService.login).toHaveBeenCalledWith('admin', 'Pass@1234', '1.2.3.4', 'Jest/1.0', undefined, undefined);
    });

    it('throws HttpException on auth failure', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));
      await expect(controller.login({ username: 'x', password: 'y' }, mockReq)).rejects.toThrow(HttpException);
    });

    it('uses req.ip when x-forwarded-for is absent', async () => {
      const reqNoFwd = { ...mockReq, headers: { 'user-agent': 'Jest' } };
      mockAuthService.login.mockResolvedValue({ token: 'tok', expiresAt: '', mustChangePassword: false, user: {} });
      await controller.login({ username: 'admin', password: 'Pass@1234' }, reqNoFwd);
      expect(mockAuthService.login).toHaveBeenCalledWith('admin', 'Pass@1234', '127.0.0.1', 'Jest', undefined, undefined);
    });
  });

  // ── POST /logout ──────────────────────────────────────────────────────
  describe('logout', () => {
    it('calls logout with sessionToken and returns ok', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);
      const result = await controller.logout(mockReq);
      expect(result).toEqual({ ok: true });
      expect(mockAuthService.logout).toHaveBeenCalledWith('tok-123');
    });
  });

  // ── GET /me ───────────────────────────────────────────────────────────
  describe('me', () => {
    it('returns currentUser from request', () => {
      const result = controller.me(mockReq);
      expect(result).toEqual(mockReq.currentUser);
    });
  });

  // ── GET /profile ──────────────────────────────────────────────────────
  describe('getProfile', () => {
    it('returns user profile', async () => {
      const profile = { userId: 'USR-001', username: 'admin', displayName: 'Admin User', email: 'a@b.com' };
      mockUsersService.findOne.mockResolvedValue(profile);
      const result = await controller.getProfile(mockReq);
      expect(result.username).toBe('admin');
      expect(mockUsersService.findOne).toHaveBeenCalledWith('USR-001');
    });
  });

  // ── PATCH /profile ────────────────────────────────────────────────────
  describe('updateProfile', () => {
    it('updates and returns profile', async () => {
      const updated = { userId: 'USR-001', displayName: 'New Name', email: 'new@b.com', phone: null };
      mockUsersService.update.mockResolvedValue(updated);
      const result = await controller.updateProfile({ displayName: 'New Name', email: 'new@b.com' }, mockReq);
      expect(result.displayName).toBe('New Name');
    });

    it('throws HttpException on update failure', async () => {
      mockUsersService.update.mockRejectedValue(new Error('DB error'));
      await expect(controller.updateProfile({ displayName: 'X' }, mockReq)).rejects.toThrow(HttpException);
    });
  });

  // ── GET /permissions ──────────────────────────────────────────────────
  describe('getMyPermissions', () => {
    it('returns permissions and dataScope', async () => {
      const permsResult = {
        permissions: [{ module: 'PROD', canCreate: true, canRead: true, canWrite: true, canDelete: true, canReport: true }],
        dataScope: 'All',
      };
      mockAuthService.getMyPermissions.mockResolvedValue(permsResult);
      const result = await controller.getMyPermissions(mockReq);
      expect(result.dataScope).toBe('All');
      expect(result.permissions).toHaveLength(1);
      expect(mockAuthService.getMyPermissions).toHaveBeenCalledWith('ROLE-001');
    });
  });

  // ── GET /login-audit ─────────────────────────────────────────────────
  describe('getMyLoginAudit', () => {
    it('returns audit data', async () => {
      const audit = { previousLogin: null, successfulToday: 2, failuresToday: 0, passwordExpiry: null };
      mockAuthService.getMyLoginAudit.mockResolvedValue(audit);
      const result = await controller.getMyLoginAudit(mockReq);
      expect(result.successfulToday).toBe(2);
      expect(mockAuthService.getMyLoginAudit).toHaveBeenCalledWith('USR-001', 'tok-123');
    });
  });

  // ── GET /dashboard-stats ─────────────────────────────────────────────
  describe('getDashboardStats', () => {
    it('returns dashboard stats with meta', async () => {
      const stats = {
        timesheets: { total: 5, draft: 1, submitted: 2, approved: 2, thisMonth: 3, prodCount: 5, instCount: 0, projCount: 0 },
        woComplete: null,
        recentTimesheets: [],
        meta: { tsTypes: ['PROD'], hasWoc: false, dataScope: 'Own' },
      };
      mockAuthService.getDashboardStats.mockResolvedValue(stats);
      const result = await controller.getDashboardStats(mockReq);
      expect(result.timesheets.total).toBe(5);
      expect(result.meta.dataScope).toBe('Own');
      expect(mockAuthService.getDashboardStats).toHaveBeenCalledWith('USR-001', 'ROLE-001');
    });
  });

  // ── GET /login-history ───────────────────────────────────────────────
  describe('getLoginHistory', () => {
    it('defaults to 30 days, page 1, limit 100', async () => {
      mockAuthService.getLoginHistory.mockResolvedValue({ data: [], total: 0, page: 1, pages: 1, limit: 100 });
      await controller.getLoginHistory();
      expect(mockAuthService.getLoginHistory).toHaveBeenCalledWith(30, 1, 100);
    });

    it('parses days parameter', async () => {
      mockAuthService.getLoginHistory.mockResolvedValue({ data: [], total: 0, page: 1, pages: 1, limit: 100 });
      await controller.getLoginHistory('7');
      expect(mockAuthService.getLoginHistory).toHaveBeenCalledWith(7, 1, 100);
    });

    it('falls back to null for invalid days', async () => {
      mockAuthService.getLoginHistory.mockResolvedValue({ data: [], total: 0, page: 1, pages: 1, limit: 100 });
      await controller.getLoginHistory('abc');
      expect(mockAuthService.getLoginHistory).toHaveBeenCalledWith(null, 1, 100);
    });

    it('passes page and limit params', async () => {
      mockAuthService.getLoginHistory.mockResolvedValue({ data: [], total: 0, page: 2, pages: 5, limit: 50 });
      await controller.getLoginHistory('30', '2', '50');
      expect(mockAuthService.getLoginHistory).toHaveBeenCalledWith(30, 2, 50);
    });
  });

  // ── DELETE /sessions/:token ──────────────────────────────────────────
  describe('forceLogout', () => {
    it('forces logout of another user and returns ok', async () => {
      mockAuthService.forceLogoutUser = jest.fn().mockResolvedValue(undefined);
      const result = await controller.forceLogout('USR-002', mockReq);
      expect(result).toEqual({ ok: true });
      expect(mockAuthService.forceLogoutUser).toHaveBeenCalledWith('USR-002', 'tok-123');
    });

    it('throws ForbiddenException when trying to logout own account', async () => {
      await expect(controller.forceLogout('USR-001', mockReq)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── POST /change-password ────────────────────────────────────────────
  describe('changePassword', () => {
    it('returns ok:true on success', async () => {
      mockAuthService.changePassword.mockResolvedValue(undefined);
      const result = await controller.changePassword({ currentPassword: 'Old@1', newPassword: 'New@2' }, mockReq);
      expect(result).toEqual({ ok: true });
    });

    it('throws HttpException when body fields are missing', async () => {
      await expect(
        controller.changePassword({ currentPassword: '', newPassword: 'New@2' }, mockReq),
      ).rejects.toThrow(HttpException);

      await expect(
        controller.changePassword({ currentPassword: 'Old@1', newPassword: '' }, mockReq),
      ).rejects.toThrow(HttpException);
    });

    it('throws HttpException when service throws', async () => {
      mockAuthService.changePassword.mockRejectedValue(new Error('Wrong password'));
      await expect(
        controller.changePassword({ currentPassword: 'bad', newPassword: 'New@1' }, mockReq),
      ).rejects.toThrow(HttpException);
    });
  });
});
