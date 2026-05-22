import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, NotFoundException, BadRequestException } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { AuditService } from '../audit/audit.service';
import { PermissionGuard } from '../auth/permission.guard';

// Mock PermissionGuard so controller tests don't need a real DB pool.
const mockPermissionGuard = { canActivate: jest.fn().mockResolvedValue(true) };

const mockRolesService = {
  findAll:        jest.fn(),
  findOne:        jest.fn(),
  getPermissions: jest.fn(),
  nextRoleCode:   jest.fn(),
  create:         jest.fn(),
  update:         jest.fn(),
  savePermissions:jest.fn(),
  remove:         jest.fn(),
};

const mockAuditService = {
  log:  jest.fn(),
  diff: jest.fn().mockReturnValue('no changes'),
};

const mockReq = { currentUser: { userId: 'USR-001', displayName: 'Admin User' } };

const role = {
  roleCode: 'ROLE-001', roleName: 'Admin', deptScope: 'All', dataScope: 'All',
  status: 'Active', userCount: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01',
};

describe('RolesController', () => {
  let controller: RolesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        { provide: RolesService,     useValue: mockRolesService },
        { provide: AuditService,     useValue: mockAuditService },
        { provide: PermissionGuard,  useValue: mockPermissionGuard },
      ],
    })
    .overrideGuard(PermissionGuard).useValue(mockPermissionGuard)
    .compile();
    controller = module.get<RolesController>(RolesController);
  });

  // ── GET / ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('returns roles array', async () => {
      mockRolesService.findAll.mockResolvedValue([role]);
      expect(await controller.findAll()).toEqual([role]);
    });

    it('throws HttpException when service throws', async () => {
      mockRolesService.findAll.mockRejectedValue(new Error('DB down'));
      await expect(controller.findAll()).rejects.toThrow(HttpException);
    });
  });

  // ── GET /next-code ───────────────────────────────────────────────────
  describe('nextCode', () => {
    it('returns next role code', async () => {
      mockRolesService.nextRoleCode.mockResolvedValue('ROLE-011');
      expect(await controller.nextCode()).toEqual({ roleCode: 'ROLE-011' });
    });
  });

  // ── GET /:roleCode ───────────────────────────────────────────────────
  describe('findOne', () => {
    it('returns a single role', async () => {
      mockRolesService.findOne.mockResolvedValue(role);
      expect(await controller.findOne('ROLE-001')).toEqual(role);
    });

    it('propagates NotFoundException', async () => {
      mockRolesService.findOne.mockRejectedValue(new NotFoundException('Role not found'));
      await expect(controller.findOne('ROLE-999')).rejects.toThrow(NotFoundException);
    });
  });

  // ── GET /:roleCode/permissions ───────────────────────────────────────
  describe('getPermissions', () => {
    it('returns permissions for a role', async () => {
      const perms = [{ module: 'PROD', canCreate: true, canRead: true, canWrite: true, canDelete: true, canReport: true }];
      mockRolesService.getPermissions.mockResolvedValue(perms);
      const result = await controller.getPermissions('ROLE-001');
      expect(result).toEqual(perms);
    });
  });

  // ── POST / ───────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates a role, logs audit, returns result', async () => {
      const newRole = { ...role, roleCode: 'ROLE-011', roleName: 'Finance' };
      mockRolesService.create.mockResolvedValue(newRole);
      const result = await controller.create({ roleName: 'Finance' }, mockReq);
      expect(result.roleCode).toBe('ROLE-011');
      expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE' }));
    });

    it('throws HttpException on service error', async () => {
      mockRolesService.create.mockRejectedValue(new BadRequestException('roleName is required'));
      await expect(controller.create({}, mockReq)).rejects.toThrow(HttpException);
    });
  });

  // ── PATCH /:roleCode ─────────────────────────────────────────────────
  describe('update', () => {
    it('updates a role, logs audit, returns result', async () => {
      const updated = { ...role, roleName: 'Super Admin' };
      mockRolesService.findOne.mockResolvedValue(role);
      mockRolesService.update.mockResolvedValue(updated);
      const result = await controller.update('ROLE-001', { roleName: 'Super Admin' }, mockReq);
      expect(result.roleName).toBe('Super Admin');
      expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE' }));
    });

    it('throws HttpException when role not found', async () => {
      mockRolesService.findOne.mockResolvedValue(null);
      mockRolesService.update.mockRejectedValue(new NotFoundException('not found'));
      await expect(controller.update('ROLE-999', {}, mockReq)).rejects.toThrow(HttpException);
    });
  });

  // ── PUT /:roleCode/permissions ───────────────────────────────────────
  describe('savePermissions', () => {
    it('saves permissions and returns ok:true', async () => {
      mockRolesService.savePermissions.mockResolvedValue(undefined);
      const result = await controller.savePermissions('ROLE-001', { permissions: [] }, mockReq);
      expect(result).toEqual({ ok: true });
      expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PERMISSIONS' }));
    });

    it('handles missing permissions key gracefully', async () => {
      mockRolesService.savePermissions.mockResolvedValue(undefined);
      const result = await controller.savePermissions('ROLE-001', {} as any, mockReq);
      expect(result).toEqual({ ok: true });
    });

    it('throws HttpException on service error', async () => {
      mockRolesService.savePermissions.mockRejectedValue(new NotFoundException('not found'));
      await expect(controller.savePermissions('ROLE-999', { permissions: [] }, mockReq)).rejects.toThrow(HttpException);
    });
  });

  // ── DELETE /:roleCode ────────────────────────────────────────────────
  describe('remove', () => {
    it('removes a role and logs audit', async () => {
      mockRolesService.remove.mockResolvedValue({ message: "Role 'ROLE-003' deleted" });
      const result = await controller.remove('ROLE-003', mockReq);
      expect(result.message).toContain('ROLE-003');
      expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE' }));
    });

    it('throws HttpException when users are assigned', async () => {
      mockRolesService.remove.mockRejectedValue(new BadRequestException('Cannot delete role with 2 assigned user(s)'));
      await expect(controller.remove('ROLE-001', mockReq)).rejects.toThrow(HttpException);
    });
  });
});
