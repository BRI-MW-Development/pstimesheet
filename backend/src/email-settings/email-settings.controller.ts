import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { EmailSettingsService } from './email-settings.service';
import { EmailService } from '../email/email.service';

@Controller()
export class EmailSettingsController {
  constructor(
    private readonly svc: EmailSettingsService,
    private readonly emailService: EmailService,
  ) {}

  // ── SMTP config ──
  @Get('email-settings')
  get() { return this.svc.get(); }

  @Post('email-settings')
  save(@Body() body: any) { return this.svc.save(body); }

  @Post('email-settings/test')
  test() { return this.emailService.testConnection(); }

  @Post('email-settings/test-send')
  testSend(@Body() body: { to: string }) { return this.svc.sendTestEmail(body.to); }

  // ── Notification rules ──
  @Get('email-notification-rules')
  getNotificationRules() { return this.svc.getNotificationRules(); }

  @Put('email-notification-rules')
  saveNotificationRules(@Body() body: { rules: any[] }) { return this.svc.saveNotificationRules(body.rules); }

  // ── Templates ──
  @Get('email-templates/:key')
  getTemplate(@Param('key') key: string) { return this.svc.getTemplate(key); }

  @Put('email-templates/:key')
  saveTemplate(@Param('key') key: string, @Body() body: { subject: string; bodyHtml: string }) {
    return this.svc.saveTemplate(key, body.subject, body.bodyHtml);
  }

  @Post('email-templates/:key/reset')
  resetTemplate(@Param('key') key: string) { return this.svc.resetTemplate(key); }

  // ── Email Log ──
  @Get('email-logs')
  getLogs(@Query('limit') limit?: string) { return this.svc.getLogs(limit ? Number(limit) : 200); }

  @Delete('email-logs')
  clearLogs() { return this.svc.clearLogs(); }

  // ── Diagnostic: force-enable and return raw DB row ──
  @Post('email-settings/force-enable')
  async forceEnable() { return this.svc.forceEnable(); }

  @Get('email-settings/raw')
  async getRaw() { return this.svc.getRaw(); }
}
