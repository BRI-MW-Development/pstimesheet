import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Logger, NotFoundException, Param, Post, Put, Query, Req } from '@nestjs/common';
import { TimesheetsService } from './timesheets.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalSettingsService } from '../approval-settings/approval-settings.service';
import { EmailSettingsService } from '../email-settings/email-settings.service';
import { EmailService } from '../email/email.service';

@Controller('timesheets')
export class TimesheetsController {
  private readonly logger = new Logger(TimesheetsController.name);

  constructor(
    private readonly timesheetsService: TimesheetsService,
    private readonly auditService: AuditService,
    private readonly approvalSettingsService: ApprovalSettingsService,
    private readonly emailSettingsService: EmailSettingsService,
    private readonly emailService: EmailService,
  ) {}

  // Send notifications respecting the rules table
  private async notify(
    module: string,
    event: string,
    approverEmails: string[],
    submitterEmail: string | null,
    subject: string,
    html: string,
  ) {
    const logEntry = async (recipient: string, status: 'sent' | 'failed' | 'skipped', errorMsg?: string) => {
      try { await this.emailSettingsService.addLog({ module, event, recipient, subject, status, errorMsg }); } catch {}
    };
    try {
      this.logger.log(`NOTIFY: ${module}/${event} | approvers=[${approverEmails}] submitter=${submitterEmail}`);
      const rule = await this.emailSettingsService.getNotificationRule(module, event);
      this.logger.log(`NOTIFY: rule=${JSON.stringify(rule)}`);
      if (!rule) {
        this.logger.warn(`NOTIFY: no rule found for ${module}/${event}`);
        await logEntry('—', 'skipped', `No notification rule found for ${module}/${event}`);
        return;
      }
      if (!rule.enabled) {
        this.logger.warn(`NOTIFY: rule disabled for ${module}/${event}`);
        await logEntry('—', 'skipped', `Rule disabled for ${module}/${event}`);
        return;
      }
      const targets = new Set<string>();
      if (rule.sendToApprover) approverEmails.forEach(e => e && targets.add(e));
      if (rule.sendToSubmitter && submitterEmail) targets.add(submitterEmail);
      if (rule.ccEmails) rule.ccEmails.split(',').map(e => e.trim()).filter(Boolean).forEach(e => targets.add(e));
      this.logger.log(`NOTIFY: sending to [${[...targets]}]`);
      if (targets.size === 0) {
        await logEntry('—', 'skipped', 'No recipients resolved (check Notify Approver / Notify Submitter settings and approver email config)');
        return;
      }
      for (const email of targets) {
        const result = await this.emailService.send(email, subject, html);
        this.logger.log(`NOTIFY: send to ${email} => ${result.ok}${result.reason ? ' | ' + result.reason : ''}`);
        await logEntry(email, result.ok ? 'sent' : 'failed', result.ok ? undefined : result.reason);
      }
    } catch (err) {
      this.logger.error(`Notification ${module}/${event} failed`, err?.message);
      await logEntry('—', 'failed', err?.message);
    }
  }

  @Get()
  async list(
    @Query('type')        type?: string,
    @Query('workOrderNo') workOrderNo?: string,
    @Query('dateFrom')    dateFrom?: string,
    @Query('dateTo')      dateTo?: string,
    @Query('status')      status?: string,
    @Query('department')  department?: string,
    @Req() req?: any,
  ) {
    const userId = req?.currentUser?.userId;
    const roleCode = req?.currentUser?.roleCode ?? '';
    const isAdmin = ['Admin', 'Manager', 'Supervisor'].includes(roleCode);
    const seeAll = isAdmin || (await this.timesheetsService.isTimesheetApprover(roleCode));
    return this.timesheetsService.list(type, workOrderNo, dateFrom, dateTo, status, department, userId, seeAll);
  }

  @Get('pending-approvals')
  getPendingApprovals(@Query('department') department?: string) {
    return this.timesheetsService.getPendingApprovals(department);
  }

  @Get('ts-employees')
  getTsEmployees() {
    return this.timesheetsService.getTsEmployees();
  }

  @Get('project-codes')
  getProjectCodes() {
    return this.timesheetsService.getDistinctProjectCodes();
  }

  @Post(':docNo/submit')
  async submitForApproval(@Param('docNo') docNo: string, @Req() req: any) {
    try {
      const ts = await this.timesheetsService.get(docNo);
      if (!ts) throw new NotFoundException(`Timesheet ${docNo} not found`);
      const byName = req.currentUser?.displayName || '';
      await this.timesheetsService.submitForApproval(docNo, byName);
      this.auditService.log({ docType: `TIMESHEET-${(ts.tsType||'PROD').toUpperCase()}`, docRef: docNo, action: 'SUBMIT', performedBy: req.currentUser?.userId, performedByName: byName, details: 'Submitted for approval' });
      const approverSetting = await this.approvalSettingsService.getByDepartment(ts.department_code);
      const typeLabel = ts.tsType === 'INST' ? 'Installation' : 'Production';
      const submitterEmail = await this.getEmailForUser(ts.entered_by_name);
      await this.notify(
        ts.tsType === 'INST' ? 'INST' : 'PROD', 'SUBMIT',
        approverSetting?.approverEmails ?? [],
        submitterEmail,
        `Timesheet ${docNo} submitted for approval`,
        `<p>A ${typeLabel} timesheet <strong>${docNo}</strong> has been submitted for approval.</p>
         <p><b>Submitted by:</b> ${byName}<br><b>Date:</b> ${ts.entryDate}<br><b>Department:</b> ${ts.department_code || '—'}</p>
         <p>Please log in to review and approve or reject it.</p>`,
      );
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException({ message: err?.message || 'Submit failed' }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':docNo/approve')
  async approve(@Param('docNo') docNo: string, @Body() body: any, @Req() req: any) {
    try {
      const ts = await this.timesheetsService.get(docNo);
      if (!ts) throw new NotFoundException(`Timesheet ${docNo} not found`);
      // Check against Approval Settings rules (+ canWrite as fallback)
      const hasCanWrite = await this.isTimesheetApprover(req.currentUser?.roleCode);
      const check = await this.approvalSettingsService.canUserApproveTimesheet(
        req.currentUser?.userId, req.currentUser?.roleCode, ts, hasCanWrite,
      );
      if (!check.allowed) throw new HttpException({ message: check.reason }, HttpStatus.FORBIDDEN);
      const byName = req.currentUser?.displayName || body?.approverName || '';
      await this.timesheetsService.approve(docNo, byName, body?.edits);
      this.auditService.log({ docType: `TIMESHEET-${(ts.tsType||'PROD').toUpperCase()}`, docRef: docNo, action: 'APPROVE', performedBy: req.currentUser?.userId, performedByName: byName, details: 'Approved' });
      const approverSetting = await this.approvalSettingsService.getByDepartment(ts.department_code);
      const typeLabel = ts.tsType === 'INST' ? 'Installation' : 'Production';
      const submitterEmail = await this.getEmailForUser(ts.entered_by_name);
      await this.notify(
        ts.tsType === 'INST' ? 'INST' : 'PROD', 'APPROVE',
        approverSetting?.approverEmails ?? [],
        submitterEmail,
        `Timesheet ${docNo} approved`,
        `<p>Hi ${ts.entered_by_name},</p>
         <p>Your ${typeLabel} timesheet <strong>${docNo}</strong> has been <span style="color:green"><b>approved</b></span> by ${byName}.</p>`,
      );
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException({ message: err?.message || 'Approve failed' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':docNo/reject')
  async reject(@Param('docNo') docNo: string, @Body() body: { reason: string }, @Req() req: any) {
    try {
      const ts = await this.timesheetsService.get(docNo);
      if (!ts) throw new NotFoundException(`Timesheet ${docNo} not found`);
      const hasCanWrite = await this.isTimesheetApprover(req.currentUser?.roleCode);
      const check = await this.approvalSettingsService.canUserApproveTimesheet(
        req.currentUser?.userId, req.currentUser?.roleCode, ts, hasCanWrite,
      );
      if (!check.allowed) throw new HttpException({ message: check.reason }, HttpStatus.FORBIDDEN);
      const byName = req.currentUser?.displayName || '';
      await this.timesheetsService.reject(docNo, byName, body.reason || '');
      this.auditService.log({ docType: `TIMESHEET-${(ts.tsType||'PROD').toUpperCase()}`, docRef: docNo, action: 'REJECT', performedBy: req.currentUser?.userId, performedByName: byName, details: `Rejected: ${body.reason || '—'}` });
      const approverSetting = await this.approvalSettingsService.getByDepartment(ts.department_code);
      const typeLabel = ts.tsType === 'INST' ? 'Installation' : 'Production';
      const submitterEmail = await this.getEmailForUser(ts.entered_by_name);
      await this.notify(
        ts.tsType === 'INST' ? 'INST' : 'PROD', 'REJECT',
        approverSetting?.approverEmails ?? [],
        submitterEmail,
        `Timesheet ${docNo} rejected`,
        `<p>Hi ${ts.entered_by_name},</p>
         <p>Your ${typeLabel} timesheet <strong>${docNo}</strong> has been <span style="color:red"><b>rejected</b></span> by ${byName}.</p>
         <p><b>Reason:</b> ${body.reason || '—'}</p>
         <p>Please correct and resubmit.</p>`,
      );
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException({ message: err?.message || 'Reject failed' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** True when the user's role has canWrite on any timesheet module */
  private async isTimesheetApprover(roleCode: string): Promise<boolean> {
    return this.timesheetsService.isTimesheetApprover(roleCode);
  }

  private async getEmailForUser(displayName: string): Promise<string | null> {
    try {
      return await this.timesheetsService.getEmailByDisplayName(displayName);
    } catch { return null; }
  }

  @Get('report-detail')
  reportDetail(
    @Query('dateFrom')    dateFrom?: string,
    @Query('dateTo')      dateTo?: string,
    @Query('type')        type?: string,
    @Query('status')      status?: string,
    @Query('department')  department?: string,
    @Query('workOrderNo') workOrderNo?: string,
  ) {
    return this.timesheetsService.reportDetail({ dateFrom, dateTo, type, status, department, workOrderNo });
  }

  @Get('report-summary')
  reportSummary(
    @Query('dateFrom')   dateFrom?: string,
    @Query('dateTo')     dateTo?: string,
    @Query('type')       type?: string,
    @Query('status')     status?: string,
    @Query('department') department?: string,
  ) {
    return this.timesheetsService.reportSummary({ dateFrom, dateTo, type, status, department });
  }

  @Get('preview-docno')
  previewDocNo(@Query('type') type?: string) {
    return this.timesheetsService.previewDocNo(type || 'PROD');
  }

  @Get('doc-numbering')
  getDocNumbering() {
    return this.timesheetsService.getDocNumberingSettings();
  }

  @Put('doc-numbering')
  async updateDocNumbering(@Body() body: { rows: { docType: string; prefix: string; sequenceDigits: number }[] }) {
    try {
      await this.timesheetsService.updateDocNumberingSettings(body.rows);
      return { ok: true };
    } catch (err) {
      this.logger.error('Update doc numbering failed', err);
      throw new HttpException(
        { message: err?.message || 'Update failed' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':docNo')
  async get(@Param('docNo') docNo: string) {
    const record = await this.timesheetsService.get(docNo);
    if (!record) throw new NotFoundException(`Timesheet ${docNo} not found`);
    return record;
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: any, @Req() req: any) {
    try {
      // Enforce entry person from authenticated session — never trust client
      body.entryPerson    = req.currentUser?.displayName ?? req.currentUser?.username ?? body.entryPerson;
      body.entered_by_name = body.entryPerson;
      body.enteredByUserId = req.currentUser?.userId;
      const result = await this.timesheetsService.create(body);
      this.auditService.log({ docType: `TIMESHEET-${(body.tsType||'PROD').toUpperCase()}`, docRef: result.docNo, action: 'CREATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Created by ${body.entered_by_name}` });
      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('Create failed', err);
      throw new HttpException({ message: err?.message || 'Create failed', detail: err?.originalError?.message || '' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':docNo')
  async update(@Param('docNo') docNo: string, @Body() body: any, @Req() req: any) {
    try {
      const before = await this.timesheetsService.get(docNo).catch(() => null);
      const isApprover = await this.isTimesheetApprover(req.currentUser?.roleCode);
      // Non-approvers cannot edit a Submitted timesheet
      if (before?.status === 'Submitted' && !isApprover)
        throw new HttpException({ message: 'Only an approver can edit a Submitted timesheet.' }, HttpStatus.FORBIDDEN);
      const result = await this.timesheetsService.update(docNo, body);
      const details = before
        ? this.auditService.diff(before, body, ['status', 'department', 'workOrderNo', 'entryDate', 'shiftCode', 'remarks', 'entered_by_name'])
        : 'Updated timesheet';
      this.auditService.log({ docType: `TIMESHEET-${(body.tsType || before?.tsType || 'PROD').toUpperCase()}`, docRef: docNo, action: 'UPDATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details });
      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Update ${docNo} failed`, err);
      throw new HttpException({ message: err?.message || 'Update failed', detail: err?.originalError?.message || '' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('weekly')
  @HttpCode(201)
  async createWeekly(
    @Body() body: { employee: string; weekStart: string; rows: { projectId: string; taskType: string; days: { s: string; e: string }[]; dates: string[]; comment: string }[] },
    @Req() req: any,
  ) {
    try {
      const entryPerson = req.currentUser?.displayName || '';
      const records: any[] = [];

      for (const row of body.rows ?? []) {
        for (let i = 0; i < (row.dates?.length ?? 0); i++) {
          const startTime = (row.days?.[i]?.s ?? '').trim();
          const endTime   = (row.days?.[i]?.e ?? '').trim();
          if (!startTime && !endTime) continue;

          let duration = 0;
          if (startTime && endTime) {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);
            duration = (eh * 60 + em) - (sh * 60 + sm);
            if (duration < 0) duration += 1440;
          }

          records.push({
            tsType: 'PROJ',
            date: row.dates[i],
            projectId: row.projectId,
            shift: row.taskType,
            entryPerson,
            remarks: row.comment || '',
            labourRows: [{
              employee: body.employee,
              startTime: startTime || null,
              endTime:   endTime   || null,
              duration:  String(Math.max(0, duration)),
            }],
          });
        }
      }

      if (records.length === 0) {
        throw new HttpException({ message: 'No filled days found. Enter at least one time range.' }, HttpStatus.BAD_REQUEST);
      }

      const results = await this.timesheetsService.batchCreate(records);
      const count = results?.results?.length ?? 0;
      this.auditService.log({ docType: 'TIMESHEET-PROJ', docRef: `weekly-batch(${count})`, action: 'CREATE', performedBy: req.currentUser?.userId, performedByName: entryPerson, details: `Weekly batch created ${count} timesheet(s) from ${body.weekStart}` });
      return results;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('Weekly create failed', err);
      throw new HttpException({ message: err?.message || 'Weekly create failed', detail: err?.originalError?.message || '' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('batch')
  @HttpCode(201)
  async batchCreate(@Body() body: { records: any[] }, @Req() req: any) {
    try {
      const results = await this.timesheetsService.batchCreate(body.records ?? []);
      const type = body.records?.[0]?.tsType || 'PROD';
      const count = results?.results?.length ?? 0;
      this.auditService.log({ docType: `TIMESHEET-${type.toUpperCase()}`, docRef: `batch(${count})`, action: 'CREATE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Batch created ${count} timesheet(s)` });
      return results;
    } catch (err) {
      this.logger.error('Batch create failed', err);
      throw new HttpException({ message: err?.message || 'Batch create failed', detail: err?.originalError?.message || '' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':docNo')
  async remove(@Param('docNo') docNo: string, @Req() req: any) {
    try {
      await this.timesheetsService.remove(docNo);
      this.auditService.log({ docType: 'TIMESHEET', docRef: docNo, action: 'DELETE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Deleted timesheet` });
      return { ok: true };
    } catch (err) {
      this.logger.error(`Delete ${docNo} failed`, err);
      throw new HttpException({ message: err?.message || 'Delete failed' }, err?.message?.includes('not found') ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
