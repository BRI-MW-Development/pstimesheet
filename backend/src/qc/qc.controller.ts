import { Body, Controller, Delete, Get, HttpException, HttpStatus, NotFoundException, Param, Post, Put, Query, Req } from '@nestjs/common';
import { QcService } from './qc.service';
import { AuditService } from '../audit/audit.service';

@Controller('qc')
export class QcController {
  constructor(private readonly svc: QcService, private readonly auditService: AuditService) {}

  @Get('preview-doc-no')
  previewDocNo() { return this.svc.previewDocNo(); }

  @Get()
  list(@Query() q: any) { return this.svc.list({ dateFrom: q.dateFrom, dateTo: q.dateTo, status: q.status }); }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    try {
      const enteredBy = req.currentUser?.displayName ?? req.currentUser?.username ?? '';
      const result = await this.svc.create(body, enteredBy);
      this.auditService.log({ docType: 'QC', docRef: result.docNo, action: 'CREATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `WO: ${body.workOrderNo || '—'}, Project: ${body.projectCode || '—'}` });
      return result;
    } catch (err) {
      throw new HttpException({ message: (err as Error)?.message || 'Create failed' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const rec = await this.svc.getById(Number(id));
    if (!rec) throw new NotFoundException('QC record not found');
    return rec;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    try {
      await this.svc.update(Number(id), body);
      this.auditService.log({ docType: 'QC', docRef: id, action: 'UPDATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Status: ${body.status || '—'}` });
      return { success: true };
    } catch (err) {
      throw new HttpException({ message: (err as Error)?.message || 'Update failed' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const result = await this.svc.remove(Number(id));
    this.auditService.log({ docType: 'QC', docRef: id, action: 'DELETE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: 'Deleted QC record' });
    return result;
  }

  // Comments
  @Get(':id/comments')
  listComments(@Param('id') id: string) { return this.svc.listComments(Number(id)); }

  @Post(':id/comments')
  async addComment(@Param('id') id: string, @Body() body: { commentText: string }, @Req() req: any) {
    const author = req.currentUser?.displayName ?? req.currentUser?.username ?? 'Unknown';
    return this.svc.addComment(Number(id), body.commentText, author);
  }

  @Delete('comments/:commentId')
  deleteComment(@Param('commentId') commentId: string) { return this.svc.deleteComment(Number(commentId)); }

  // Attachments
  @Get(':id/attachments')
  listAttachments(@Param('id') id: string) { return this.svc.listAttachments(Number(id)); }

  @Post(':id/attachments')
  async addAttachment(@Param('id') id: string, @Body() body: { fileName: string; mimeType: string; fileData: string; fileSize: number }) {
    try { return await this.svc.addAttachment(Number(id), body.fileName, body.mimeType, body.fileData, body.fileSize); }
    catch (err) { throw new HttpException({ message: (err as Error)?.message || 'Upload failed' }, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get('attachments/:attachId/download')
  async downloadAttachment(@Param('attachId') attachId: string) {
    const file = await this.svc.getAttachment(Number(attachId));
    if (!file) throw new NotFoundException('Attachment not found');
    return file;
  }

  @Delete('attachments/:attachId')
  removeAttachment(@Param('attachId') attachId: string) { return this.svc.removeAttachment(Number(attachId)); }
}
