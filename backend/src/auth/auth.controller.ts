import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './auth.guard';
import { UsersService } from '../users/users.service';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { username: string; password: string; city?: string; country?: string }, @Req() req: any) {
    const ip        = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '0.0.0.0';
    const userAgent = (req.headers['user-agent'] as string) || '';
    try {
      return await this.authService.login(body.username, body.password, ip, userAgent, body.city, body.country);
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Login failed' }, HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: any) {
    await this.authService.logout(req.sessionToken);
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: any) {
    return req.currentUser;
  }

  @Get('profile')
  async getProfile(@Req() req: any) {
    const user = await this.usersService.findOne(req.currentUser.userId);
    const profileImageUrl = await this.usersService.getProfileImageUrl(req.currentUser.userId);
    return { ...user, profileImageUrl };
  }

  @Patch('profile')
  async updateProfile(@Body() body: { displayName?: string; email?: string; phone?: string }, @Req() req: any) {
    try {
      const { displayName, email, phone } = body;
      return await this.usersService.update(req.currentUser.userId, { displayName, email, phone });
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Update failed' }, err?.status ?? HttpStatus.BAD_REQUEST);
    }
  }

  @Post('profile/image')
  async uploadProfileImage(
    @Body() body: { fileData: string; mimeType: string; fileName: string },
    @Req() req: any,
  ) {
    try {
      // Validate MIME type and data URL signature on the backend
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];
      if (!body.mimeType || !allowed.includes(body.mimeType.toLowerCase()))
        throw new HttpException({ message: 'Only image files are accepted (JPEG, PNG, WEBP, HEIC).' }, HttpStatus.BAD_REQUEST);
      if (!body.fileData?.startsWith('data:image/'))
        throw new HttpException({ message: 'Invalid image data.' }, HttpStatus.BAD_REQUEST);
      // Limit base64 payload to ~10 MB
      if (body.fileData.length > 14_000_000)
        throw new HttpException({ message: 'Image exceeds the 10 MB size limit.' }, HttpStatus.BAD_REQUEST);
      return await this.usersService.uploadProfileImage(req.currentUser.userId, body.fileData, body.mimeType, body.fileName);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException({ message: err?.message || 'Upload failed' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('permissions')
  getMyPermissions(@Req() req: any) {
    return this.authService.getMyPermissions(req.currentUser.roleCode);
  }

  @Get('login-audit')
  getMyLoginAudit(@Req() req: any) {
    return this.authService.getMyLoginAudit(req.currentUser.userId, req.sessionToken);
  }

  @Get('dashboard-stats')
  getDashboardStats(@Req() req: any) {
    return this.authService.getDashboardStats(req.currentUser.userId, req.currentUser.roleCode, req.currentUser.departmentCode ?? null);
  }

  @Get('login-history')
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canRead')
  getLoginHistory(
    @Query('days')  days?:  string,
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    const d = days  ? Number(days)  : 30;
    const p = page  ? Number(page)  : 1;
    const l = limit ? Number(limit) : 100;
    return this.authService.getLoginHistory(
      isNaN(d) || d <= 0 ? null : d,
      isNaN(p) || p < 1  ? 1    : p,
      isNaN(l) || l < 1  ? 100  : l,
    );
  }

  @Get('login-history/:userId')
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canRead')
  getUserLoginHistory(
    @Param('userId') userId: string,
    @Query('days')   days?:  string,
    @Query('page')   page?:  string,
    @Query('limit')  limit?: string,
  ) {
    const d = days  ? Number(days)  : 30;
    const p = page  ? Number(page)  : 1;
    const l = limit ? Number(limit) : 100;
    return this.authService.getUserLoginHistory(
      userId,
      isNaN(d) || d <= 0 ? null : d,
      isNaN(p) || p < 1  ? 1    : p,
      isNaN(l) || l < 1  ? 100  : l,
    );
  }

  @Get('sessions')
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canRead')
  async getActiveSessions(@Req() req: any) {
    const sessions = await this.authService.getActiveSessions();
    // Strip the raw token but add a safe boolean so the frontend can highlight the caller's session.
    return sessions.map(({ sessionToken, ...rest }: any) => ({
      ...rest,
      isCurrent: sessionToken === req.sessionToken,
    }));
  }

  @Delete('sessions/user/:userId')
  @UseGuards(PermissionGuard)
  @RequirePermission('USERS', 'canWrite')
  async forceLogout(@Param('userId') targetUserId: string, @Req() req: any) {
    if (targetUserId === req.currentUser.userId)
      throw new ForbiddenException('Cannot force-logout your own account');
    await this.authService.forceLogoutUser(targetUserId, req.sessionToken);
    return { ok: true };
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(@Body() body: { currentPassword: string; newPassword: string }, @Req() req: any) {
    if (!body.currentPassword || !body.newPassword)
      throw new HttpException({ message: 'currentPassword and newPassword are required' }, HttpStatus.BAD_REQUEST);
    try {
      await this.authService.changePassword(req.currentUser.userId, body.currentPassword, body.newPassword, req.sessionToken);
      return { ok: true };
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Change password failed' },
        err?.status ?? HttpStatus.BAD_REQUEST);
    }
  }
}
