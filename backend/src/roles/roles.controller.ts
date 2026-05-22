import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Logger, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { AuditService } from '../audit/audit.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('roles')
export class RolesController {
  private readonly logger = new Logger(RolesController.name);

  constructor(
    private readonly rolesService: RolesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('ROLES', 'canRead')
  async findAll() {
    try {
      return await this.rolesService.findAll();
    } catch (err) {
      this.logger.error(`findAll failed: ${err?.message}`, err?.stack);
      throw new HttpException({ message: err?.message || 'Failed to load roles' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('next-code')
  @UseGuards(PermissionGuard)
  @RequirePermission('ROLES', 'canCreate')
  nextCode() { return this.rolesService.nextRoleCode().then(roleCode => ({ roleCode })); }

  @Get(':roleCode')
  @UseGuards(PermissionGuard)
  @RequirePermission('ROLES', 'canRead')
  findOne(@Param('roleCode') roleCode: string) { return this.rolesService.findOne(roleCode); }

  @Get(':roleCode/permissions')
  @UseGuards(PermissionGuard)
  @RequirePermission('ROLES', 'canRead')
  getPermissions(@Param('roleCode') roleCode: string) { return this.rolesService.getPermissions(roleCode); }

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('ROLES', 'canCreate')
  async create(@Body() body: any, @Req() req: any) {
    try {
      const result = await this.rolesService.create(body);
      this.auditService.log({ docType: 'ROLE', docRef: result.roleCode, action: 'CREATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Created role: ${result.roleName}` });
      return result;
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Create failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':roleCode')
  @UseGuards(PermissionGuard)
  @RequirePermission('ROLES', 'canWrite')
  async update(@Param('roleCode') roleCode: string, @Body() body: any, @Req() req: any) {
    try {
      const before = await this.rolesService.findOne(roleCode).catch(() => null);
      const result = await this.rolesService.update(roleCode, body);
      const details = before
        ? this.auditService.diff(before, body, ['roleName', 'deptScope', 'dataScope', 'status'])
        : `Updated role: ${result.roleName}`;
      this.auditService.log({ docType: 'ROLE', docRef: roleCode, action: 'UPDATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details });
      return result;
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Update failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':roleCode/permissions')
  @UseGuards(PermissionGuard)
  @RequirePermission('ROLES', 'canWrite')
  async savePermissions(@Param('roleCode') roleCode: string, @Body() body: { permissions: any[] }, @Req() req: any) {
    try {
      await this.rolesService.savePermissions(roleCode, body.permissions || []);
      this.auditService.log({ docType: 'ROLE', docRef: roleCode, action: 'PERMISSIONS', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Updated permissions (${body.permissions?.length ?? 0} modules)` });
      return { ok: true };
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Save failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':roleCode')
  @UseGuards(PermissionGuard)
  @RequirePermission('ROLES', 'canDelete')
  async remove(@Param('roleCode') roleCode: string, @Req() req: any) {
    try {
      const result = await this.rolesService.remove(roleCode);
      this.auditService.log({ docType: 'ROLE', docRef: roleCode, action: 'DELETE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Deleted role` });
      return result;
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Delete failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
