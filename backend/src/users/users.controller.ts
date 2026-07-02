import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Logger, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuditService } from '../audit/audit.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canRead')
  async findAll() {
    try {
      return await this.usersService.findAll();
    } catch (err) {
      this.logger.error(`findAll failed: ${err?.message}`, err?.stack);
      throw new HttpException({ message: err?.message || 'Failed to load users' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('next-id')
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canCreate')
  nextId() { return this.usersService.nextUserId().then(userId => ({ userId })); }

  @Get(':userId')
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canRead')
  findOne(@Param('userId') userId: string) { return this.usersService.findOne(userId); }

  @Post()
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canCreate')
  async create(@Body() body: any, @Req() req: any) {
    try {
      const result = await this.usersService.create(body);
      this.auditService.log({ docType: 'USER', docRef: result.userId, action: 'CREATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Created user: ${result.username}` });
      return result;
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Create failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':userId')
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canWrite')
  async update(@Param('userId') userId: string, @Body() body: any, @Req() req: any) {
    try {
      const before = await this.usersService.findOne(userId).catch(() => null);
      const result = await this.usersService.update(userId, body);
      const details = before
        ? this.auditService.diff(before, body, ['displayName', 'roleCode', 'email', 'phone', 'status', 'employeeCode', 'departmentCode'])
        : 'Updated user';
      this.auditService.log({ docType: 'USER', docRef: userId, action: 'UPDATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details });
      return result;
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Update failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':userId/reset-password')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canWrite')
  async resetPassword(@Param('userId') userId: string, @Req() req: any) {
    try {
      const result = await this.usersService.resetPassword(userId);
      this.auditService.log({ docType: 'USER', docRef: userId, action: 'RESET-PWD', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Password reset by admin` });
      return result;
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Reset failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':userId/unlock')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canWrite')
  async unlock(@Param('userId') userId: string, @Req() req: any) {
    try {
      const result = await this.usersService.unlock(userId);
      this.auditService.log({ docType: 'USER', docRef: userId, action: 'UNLOCK', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: 'User unlocked by admin' });
      return result;
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Unlock failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':userId/login-history')
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canRead')
  getLoginHistory(@Param('userId') userId: string) {
    return this.usersService.getLoginHistory(userId);
  }

  @Get(':userId/history')
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canRead')
  getAuditHistory(@Param('userId') userId: string) {
    return this.usersService.getAuditHistory(userId);
  }

  @Post(':userId/upload-profile-image')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canWrite')
  async uploadProfileImage(@Param('userId') userId: string, @Body() body: { fileData: string; mimeType: string; fileName: string }, @Req() req: any) {
    try {
      const result = await this.usersService.uploadProfileImage(userId, body.fileData, body.mimeType, body.fileName);
      this.auditService.log({ docType: 'USER', docRef: userId, action: 'PHOTO', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: 'Profile photo updated' });
      return result;
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Upload failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':userId/send-credentials')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canWrite')
  async sendCredentials(@Param('userId') userId: string, @Body() body: { email: string; username: string; password: string; displayName?: string }) {
    const result = await this.usersService.sendCredentials(userId, body);
    if (!result.ok) throw new HttpException({ message: result.reason || 'Email send failed' }, HttpStatus.BAD_GATEWAY);
    return { ok: true };
  }

  @Delete(':userId')
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canDelete')
  async remove(@Param('userId') userId: string, @Req() req: any) {
    try {
      const result = await this.usersService.remove(userId);
      this.auditService.log({ docType: 'USER', docRef: userId, action: 'DELETE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Deleted user` });
      return result;
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Delete failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
