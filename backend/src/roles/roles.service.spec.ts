import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RolesService, RolePermission } from './roles.service';
import { DEV_SQL_POOL } from '../database/database.constants';

// ── Mock pool builder ────────────────────────────────────────────────────────
function makeRequest(result: any) {
  return { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue(result) };
}

function makePool(results: any[]) {
  let idx = 0;
  const txRequest = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [] }) };
  const tx = { begin: jest.fn().mockResolvedValue(undefined), commit: jest.fn().mockResolvedValue(undefined), rollback: jest.fn().mockResolvedValue(undefined), request: jest.fn(() => txRequest) };
  return {
    request: jest.fn(() => makeRequest(results[idx++] ?? { recordset: [] })),
    transaction: jest.fn(() => tx),
    _tx: tx,
  };
}

// ── Sample data ──────────────────────────────────────────────────────────────
const roleAdmin = {
  roleCode: 'ROLE-001', roleName: 'Admin', deptScope: 'All', dataScope: 'All',
  status: 'Active', userCount: 1, createdAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00',
};
const roleInstLead = {
  roleCode: 'ROLE-003', roleName: 'Installation Lead', deptScope: 'Installation', dataScope: 'OwnDept',
  status: 'Active', userCount: 0, createdAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00',
};

const permsAdmin: RolePermission[] = [
  { module: 'PROD', canCreate: true, canRead: true, canWrite: true, canDelete: true, canReport: true },
  { module: 'INST', canCreate: true, canRead: true, canWrite: true, canDelete: true, canReport: true },
];

describe('RolesService', () => {
  let service: RolesService;
  let pool: any;

  async function build(queryResults: any[]) {
    pool = makePool(queryResults);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: DEV_SQL_POOL, useValue: pool },
      ],
    }).compile();
    service = module.get<RolesService>(RolesService);
  }

  // ── onModuleInit / ensureSchema ──────────────────────────────────────────
  describe('onModuleInit', () => {
    it('runs schema migration query on init', async () => {
      await build([{ recordset: [] }]);
      await service.onModuleInit();
      expect(pool.request).toHaveBeenCalledTimes(1);
    });

    it('does not throw if migration query fails', async () => {
      pool = { request: jest.fn(() => ({ input: jest.fn().mockReturnThis(), query: jest.fn().mockRejectedValue(new Error('DB')) })) };
      const module: TestingModule = await Test.createTestingModule({
        providers: [RolesService, { provide: DEV_SQL_POOL, useValue: pool }],
      }).compile();
      service = module.get<RolesService>(RolesService);
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  // ── findAll ──────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('returns all roles', async () => {
      await build([
        { recordset: [] },                              // ensureSchema
        { recordset: [roleAdmin, roleInstLead] },       // findAll query
      ]);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(result[0].roleCode).toBe('ROLE-001');
    });

    it('returns empty array when no roles exist', async () => {
      await build([
        { recordset: [] },  // ensureSchema
        { recordset: [] },  // findAll query
      ]);
      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('returns the role when found', async () => {
      await build([{ recordset: [roleAdmin] }]);
      const result = await service.findOne('ROLE-001');
      expect(result.roleName).toBe('Admin');
    });

    it('throws NotFoundException when role not found', async () => {
      await build([{ recordset: [] }]);
      await expect(service.findOne('ROLE-999')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getPermissions ───────────────────────────────────────────────────────
  describe('getPermissions', () => {
    it('returns permission list for a role', async () => {
      await build([
        { recordset: [roleAdmin] },    // findOne (role exists check)
        { recordset: permsAdmin },     // permissions query
      ]);
      const result = await service.getPermissions('ROLE-001');
      expect(result).toHaveLength(2);
      expect(result[0].module).toBe('PROD');
      expect(result[0].canDelete).toBe(true);
    });

    it('throws NotFoundException if role does not exist', async () => {
      await build([{ recordset: [] }]);
      await expect(service.getPermissions('ROLE-999')).rejects.toThrow(NotFoundException);
    });
  });

  // ── nextRoleCode ─────────────────────────────────────────────────────────
  describe('nextRoleCode', () => {
    it('returns ROLE-011 when max is ROLE-010', async () => {
      await build([{ recordset: [{ maxNo: 10 }] }]);
      const code = await service.nextRoleCode();
      expect(code).toBe('ROLE-011');
    });

    it('returns ROLE-001 when no roles exist', async () => {
      await build([{ recordset: [{ maxNo: 0 }] }]);
      const code = await service.nextRoleCode();
      expect(code).toBe('ROLE-001');
    });
  });

  // ── create ───────────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates a new role and returns it', async () => {
      const newRole = { ...roleInstLead, roleCode: 'ROLE-011', roleName: 'New Role', userCount: 0 };
      await build([
        { recordset: [{ maxNo: 10 }] },    // nextRoleCode
        { recordset: [] },                  // INSERT
        { recordset: [newRole] },           // findOne (return created)
      ]);
      const result = await service.create({ roleName: 'New Role', deptScope: 'Installation', dataScope: 'OwnDept' });
      expect(result.roleName).toBe('New Role');
      expect(result.roleCode).toBe('ROLE-011');
    });

    it('throws BadRequestException when roleName is missing', async () => {
      await build([]);
      await expect(service.create({ roleName: '' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when roleName is only whitespace', async () => {
      await build([]);
      await expect(service.create({ roleName: '   ' })).rejects.toThrow(BadRequestException);
    });
  });

  // ── update ───────────────────────────────────────────────────────────────
  describe('update', () => {
    it('updates a role and returns updated record', async () => {
      const updated = { ...roleAdmin, roleName: 'Super Admin', updatedAt: '2026-05-20T00:00:00' };
      await build([
        { recordset: [roleAdmin] },   // findOne (existence check)
        { recordset: [] },            // UPDATE
        { recordset: [updated] },     // findOne (return updated)
      ]);
      const result = await service.update('ROLE-001', { roleName: 'Super Admin' });
      expect(result.roleName).toBe('Super Admin');
    });

    it('throws NotFoundException when updating non-existent role', async () => {
      await build([{ recordset: [] }]);
      await expect(service.update('ROLE-999', { roleName: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('preserves existing values when partial update is sent', async () => {
      const updated = { ...roleAdmin, status: 'Inactive' };
      await build([
        { recordset: [roleAdmin] },   // findOne
        { recordset: [] },            // UPDATE
        { recordset: [updated] },     // findOne
      ]);
      const result = await service.update('ROLE-001', { status: 'Inactive' });
      expect(result.status).toBe('Inactive');
      expect(result.roleName).toBe('Admin');
    });
  });

  // ── savePermissions ──────────────────────────────────────────────────────
  describe('savePermissions', () => {
    it('saves all permissions via MERGE inside a transaction', async () => {
      const permsToSave: RolePermission[] = [
        { module: 'PROD', canCreate: true, canRead: true, canWrite: true, canDelete: false, canReport: true },
        { module: 'INST', canCreate: false, canRead: true, canWrite: false, canDelete: false, canReport: false },
      ];
      await build([{ recordset: [roleAdmin] }]); // findOne
      await expect(service.savePermissions('ROLE-001', permsToSave)).resolves.not.toThrow();
      // Uses pool.transaction(), not pool.request() for the MERGE calls
      expect(pool.transaction).toHaveBeenCalledTimes(1);
      expect(pool._tx.begin).toHaveBeenCalled();
      expect(pool._tx.commit).toHaveBeenCalled();
      expect(pool._tx.request).toHaveBeenCalledTimes(2); // 2 MERGE calls
    });

    it('rolls back and throws on MERGE error', async () => {
      await build([{ recordset: [roleAdmin] }]); // findOne
      pool._tx.request.mockReturnValue({
        input: jest.fn().mockReturnThis(),
        query: jest.fn().mockRejectedValue(new Error('MERGE failed')),
      });
      await expect(service.savePermissions('ROLE-001', [
        { module: 'PROD', canCreate: true, canRead: true, canWrite: true, canDelete: false, canReport: true },
      ])).rejects.toThrow('MERGE failed');
      expect(pool._tx.rollback).toHaveBeenCalled();
    });

    it('throws NotFoundException when role not found', async () => {
      await build([{ recordset: [] }]);
      await expect(service.savePermissions('ROLE-999', [])).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('deletes role with no users assigned', async () => {
      await build([
        { recordset: [roleInstLead] },     // findOne
        { recordset: [{ cnt: 0 }] },       // user count check
        { recordset: [] },                 // DELETE permissions
        { recordset: [] },                 // DELETE role
      ]);
      const result = await service.remove('ROLE-003');
      expect(result.message).toContain('ROLE-003');
    });

    it('throws BadRequestException when users are assigned to the role', async () => {
      await build([
        { recordset: [roleAdmin] },        // findOne
        { recordset: [{ cnt: 3 }] },       // 3 users assigned
      ]);
      await expect(service.remove('ROLE-001')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when role does not exist', async () => {
      await build([{ recordset: [] }]);
      await expect(service.remove('ROLE-999')).rejects.toThrow(NotFoundException);
    });
  });

  // ── canDelete = 0 for non-Admin ──────────────────────────────────────────
  describe('permission canDelete business rule', () => {
    it('non-Admin roles should not have canDelete on TS modules', async () => {
      const nonAdminPerms: RolePermission[] = [
        { module: 'PROD', canCreate: true, canRead: true, canWrite: true, canDelete: false, canReport: true },
        { module: 'INST', canCreate: true, canRead: true, canWrite: true, canDelete: false, canReport: true },
      ];
      await build([
        { recordset: [roleInstLead] },
        { recordset: nonAdminPerms },
      ]);
      const perms = await service.getPermissions('ROLE-003');
      const tsModules = perms.filter(p => ['PROD','INST','PROJ'].includes(p.module));
      tsModules.forEach(p => expect(p.canDelete).toBe(false));
    });
  });
});
