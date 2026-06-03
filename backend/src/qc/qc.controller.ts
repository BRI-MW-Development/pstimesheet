import { Body, Controller, Delete, Get, HttpException, HttpStatus, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { QcService } from './qc.service';
import { AuditService } from '../audit/audit.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('qc')
export class QcController {
  constructor(private readonly svc: QcService, private readonly auditService: AuditService) {}

  @Get('preview-doc-no')
  @UseGuards(PermissionGuard)
  @RequirePermission('QC', 'canRead')
  previewDocNo() { return this.svc.previewDocNo(); }

  @Get('eligible-wos')
  getEligibleWos() { return this.svc.getFullQcWoNumbers(); } // used by WOC page — keep public

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('QC', 'canRead')
  list(@Query() q: any) { return this.svc.list({ dateFrom: q.dateFrom, dateTo: q.dateTo, status: q.status, workOrderNo: q.workOrderNo }); }

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('QC', 'canCreate')
  async create(@Body() body: any, @Req() req: any) {
    try {
      const enteredBy = req.currentUser?.displayName ?? req.currentUser?.username ?? '';
      // Attach the inspector's profile image key from the current user session
      if (!body.inspectorImageKey && req.currentUser?.userId) {
        body.inspectorImageKey = await this.svc.getUserProfileImageKey(req.currentUser.userId);
      }
      const result = await this.svc.create(body, enteredBy);
      this.auditService.log({ docType: 'QC', docRef: result.docNo, action: 'CREATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `WO: ${body.workOrderNo || '—'}, Project: ${body.projectCode || '—'}` });
      return result;
    } catch (err) {
      throw new HttpException({ message: (err as Error)?.message || 'Create failed' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('QC', 'canRead')
  async getById(@Param('id') id: string) {
    const rec = await this.svc.getById(Number(id));
    if (!rec) throw new NotFoundException('QC record not found');
    return rec;
  }

  @Put(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('QC', 'canWrite')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    try {
      const rec = await this.svc.getById(Number(id));
      if (!rec) throw new NotFoundException('QC record not found');
      const isApprover = ['Admin', 'Manager', 'Supervisor'].includes(req.currentUser?.roleCode);
      // Non-approvers cannot edit a Failed record
      if (rec.status === 'Failed' && !isApprover)
        throw new HttpException({ message: 'A Failed QC record can only be edited by an approver.' }, HttpStatus.FORBIDDEN);
      if (!body.inspectorImageKey && req.currentUser?.userId) {
        body.inspectorImageKey = await this.svc.getUserProfileImageKey(req.currentUser.userId);
      }
      await this.svc.update(Number(id), body);
      this.auditService.log({ docType: 'QC', docRef: id, action: 'UPDATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Status: ${body.status || '—'}` });
      return { success: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException({ message: (err as Error)?.message || 'Update failed' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('QC', 'canDelete')
  async remove(@Param('id') id: string, @Req() req: any) {
    const rec = await this.svc.getById(Number(id));
    if (!rec) throw new NotFoundException('QC record not found');
    // Only allow deletion of non-Passed records; Admins/Managers/Supervisors can delete any
    const isApprover = req.currentUser?.canApprove ||
      ['Admin', 'Manager', 'Supervisor'].includes(req.currentUser?.roleCode);
    if (rec.status === 'Passed' && !isApprover)
      throw new HttpException({ message: 'A Passed QC record can only be deleted by an approver.' }, HttpStatus.FORBIDDEN);
    const result = await this.svc.remove(Number(id));
    this.auditService.log({ docType: 'QC', docRef: id, action: 'DELETE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: 'Deleted QC record' });
    return result;
  }

  // Comments
  @Get(':id/comments')
  listComments(@Param('id') id: string) { return this.svc.listComments(Number(id)); }

  @Post(':id/comments')
  async addComment(@Param('id') id: string, @Body() body: { commentText: string }, @Req() req: any) {
    const author   = req.currentUser?.displayName ?? req.currentUser?.username ?? 'Unknown';
    const authorId = req.currentUser?.userId;
    return this.svc.addComment(Number(id), body.commentText, author, authorId);
  }

  @Delete('comments/:commentId')
  async deleteComment(@Param('commentId') commentId: string, @Req() req: any) {
    const comment = await this.svc.getCommentById(Number(commentId));
    if (!comment) throw new NotFoundException('Comment not found');
    const isApprover = ['Admin', 'Manager', 'Supervisor'].includes(req.currentUser?.roleCode);
    // Use userId for authorship check — more reliable than display name
    const isAuthor   = comment.authorUserId
      ? comment.authorUserId === req.currentUser?.userId
      : comment.authorName === (req.currentUser?.displayName ?? req.currentUser?.username);
    if (!isApprover && !isAuthor)
      throw new HttpException({ message: 'You can only delete your own comments.' }, HttpStatus.FORBIDDEN);
    return this.svc.deleteComment(Number(commentId));
  }

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
