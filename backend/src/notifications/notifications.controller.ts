import { Controller, Get, HttpCode, Param, Patch, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(@Req() req: any) {
    const { userId, roleCode } = req.currentUser;
    return this.notificationsService.getForUser(userId, roleCode);
  }

  @Patch('read-all')
  @HttpCode(200)
  async markAllRead(@Req() req: any) {
    const { userId, roleCode } = req.currentUser;
    await this.notificationsService.markAllRead(userId, roleCode);
    return { ok: true };
  }

  @Patch(':key/read')
  @HttpCode(200)
  async markRead(@Param('key') key: string, @Req() req: any) {
    await this.notificationsService.markRead(req.currentUser.userId, key);
    return { ok: true };
  }
}
