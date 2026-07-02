import { BadRequestException, Body, Controller, Delete, Get, HttpException, HttpStatus, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { WoCompleteService } from './wo-complete.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('wo-complete')
export class WoCompleteController {
  constructor(
    private readonly svc: WoCompleteService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  @Get('preview-doc-no')
  @UseGuards(PermissionGuard)
  @RequirePermission('WO_COMPLETE', 'canRead')
  previewDocNo() {
    return this.svc.previewDocNo();
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('WO_COMPLETE', 'canRead')
  list() {
    return this.svc.list();
  }

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('WO_COMPLETE', 'canCreate')
  async create(@Body() body: any, @Req() req: any) {
    try {
    const result = await this.svc.create(body);
    this.auditService.log({ docType: 'WO-COMPLETE', docRef: result.docNo || String(result.id), action: 'CREATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `WO: ${body.workOrderNumber || '—'}, Project: ${body.projectId || '—'}` });
    // Email notification for WO Complete
    if (body.notifyEmail) {
      this.emailService.send(
        body.notifyEmail,
        `Work Order ${body.workOrderNumber || result.docNo} Marked Complete`,
        EmailService.template('Work Order Complete', `
          <p style="margin:0 0 20px;color:#444">A Work Order has been marked as complete.</p>
          <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;width:40%">Work Order</td><td style="padding:12px 16px;font-weight:700;border-bottom:1px solid #e5e7eb">${body.workOrderNumber || '—'}</td></tr>
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb">Project</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${body.projectId || '—'}</td></tr>
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb">Completed Date</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${body.completedDate || '—'}</td></tr>
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Saved By</td><td style="padding:12px 16px">${req.currentUser?.displayName || '—'}</td></tr>
          </table>
        `),
      );
    }
    return result;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new HttpException({ message: err?.message || 'Create failed' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('WO_COMPLETE', 'canRead')
  async getById(@Param('id') id: string) {
    const rec = await this.svc.getById(Number(id));
    if (!rec) throw new NotFoundException('Record not found');
    return rec;
  }

  @Put(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('WO_COMPLETE', 'canWrite')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    try {
      const before = await this.svc.getById(Number(id)).catch(() => null);
      await this.svc.update(Number(id), body);
      const details = before
        ? this.auditService.diff(before, body, ['completedDate', 'projectId', 'workOrderNumber', 'department', 'status'])
        : 'Updated WO complete record';
      this.auditService.log({ docType: 'WO-COMPLETE', docRef: id, action: 'UPDATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details });
      return { success: true };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new HttpException({ message: err?.message || 'Update failed' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('WO_COMPLETE', 'canDelete')
  async remove(@Param('id') id: string, @Req() req: any) {
    const result = await this.svc.remove(Number(id));
    this.auditService.log({ docType: 'WO-COMPLETE', docRef: id, action: 'DELETE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Deleted WO complete record` });
    return result;
  }

  @Get(':id/attachments')
  listAttachments(@Param('id') id: string) {
    return this.svc.listAttachments(Number(id));
  }

  @Post(':id/attachments')
  async addAttachment(
    @Param('id') id: string,
    @Body() body: { fileName: string; mimeType: string; fileData: string; fileSize: number },
  ) {
    try {
      return await this.svc.addAttachment(Number(id), body.fileName, body.mimeType, body.fileData, body.fileSize);
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Upload failed' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('attachments/:attachId/download')
  async downloadAttachment(@Param('attachId') attachId: string) {
    const file = await this.svc.getAttachment(Number(attachId));
    if (!file) throw new NotFoundException('Attachment not found');
    return file;
  }

  @Delete('attachments/:attachId')
  removeAttachment(@Param('attachId') attachId: string) {
    return this.svc.removeAttachment(Number(attachId));
  }
}
