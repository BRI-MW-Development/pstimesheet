import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Logger, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';
import { TimesheetsService } from './timesheets.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalSettingsService } from '../approval-settings/approval-settings.service';
import { EmailSettingsService } from '../email-settings/email-settings.service';
import { EmailService } from '../email/email.service';
import { HodTeamsService } from '../hod-teams/hod-teams.service';

@Controller('timesheets')
export class TimesheetsController {
  private readonly logger = new Logger(TimesheetsController.name);

  constructor(
    private readonly timesheetsService: TimesheetsService,
    private readonly auditService: AuditService,
    private readonly approvalSettingsService: ApprovalSettingsService,
    private readonly emailSettingsService: EmailSettingsService,
    private readonly emailService: EmailService,
    private readonly hodTeamsService: HodTeamsService,
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
      approverEmails.forEach(e => e && targets.add(e));
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

  /** Normalize ?type query param to uppercase module name */
  private typeToModule(type?: string): string {
    const t = (type ?? '').toUpperCase();
    if (t === 'INST') return 'INST';
    if (t === 'PROJ') return 'PROJ';
    return 'PROD';
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
    const roleCode      = req?.currentUser?.roleCode      ?? '';
    const userId        = req?.currentUser?.userId        ?? '';
    const employeeCode  = req?.currentUser?.employeeCode  ?? null;
    const departmentCode = req?.currentUser?.departmentCode ?? null;
    await this.timesheetsService.assertPermission(roleCode, this.typeToModule(type), 'canRead');
    const [dataScope, isApprover] = await Promise.all([
      this.timesheetsService.getRoleDataScope(roleCode),
      this.timesheetsService.isTimesheetApprover(roleCode),
    ]);
    const isAdmin = ['Admin', 'Manager', 'Supervisor'].includes(roleCode);

    // Three-way scope:
    //  'All' + admin/approver → seeAll (no filter)
    //  'OwnDept'             → filter by the user's assigned department_code
    //  anything else         → filter by entered_by_user_id / employee code
    const seeAll = dataScope === 'All' && (isAdmin || isApprover);

    // HOD team filter — fetch first so it can override OwnDept/Own scope
    let teamCodes: string[] | null = null;
    if (!seeAll && employeeCode) {
      const codes = await this.hodTeamsService.getTeamByHod(employeeCode);
      if (codes.length > 0) teamCodes = codes;
    }

    // HOD team takes full priority — ignore department scope when team is assigned
    // This handles employees from different departments assigned to the same HOD
    const deptCode = (!teamCodes && dataScope === 'OwnDept') ? departmentCode : null;

    return this.timesheetsService.list(type, workOrderNo, dateFrom, dateTo, status, department, userId, seeAll, employeeCode, deptCode, teamCodes);
  }

  @Get('employee-timeline')
  async employeeTimeline(
    @Query('employeeCode') employeeCode: string,
    @Query('dateFrom')     dateFrom: string,
    @Query('dateTo')       dateTo: string,
    @Query('type')         type?: string,
  ) {
    return this.timesheetsService.getEmployeeMonthTimeline({ employeeCode, dateFrom, dateTo, type });
  }

  @UseGuards(PermissionGuard)
  @RequirePermission('TIMELINE', 'canRead')
  @Get('timeline')
  async timeline(
    @Query('date')       date: string,
    @Query('department') department?: string,
    @Query('type')       type?: string,
    @Query('hodCode')    hodCode?: string,
    @Req() req?: any,
  ) {
    const employeeCode = req?.currentUser?.employeeCode ?? null;

    let teamCodes: string[] | null = null;

    if (hodCode) {
      // Explicit HOD selected from the dropdown — include HOD + their team members
      const codes = await this.hodTeamsService.getTeamByHod(hodCode);
      teamCodes = [hodCode, ...codes];
    } else if (employeeCode) {
      // No explicit filter: check if the logged-in user IS an HOD.
      // If so, restrict to self + their team regardless of role.
      // Pure admins who are not HODs → teamCodes stays null → see all employees.
      const codes = await this.hodTeamsService.getTeamByHod(employeeCode);
      if (codes.length > 0) teamCodes = [employeeCode, ...codes];
    }

    const result = await this.timesheetsService.getTimeline({ date, department, type, teamCodes });

    // When filtering by an HOD team, append any team members who haven't entered a timesheet
    if (teamCodes && teamCodes.length > 0) {
      const presentCodes = new Set(result.map((e: any) => e.employeeCode));
      const missingCodes = teamCodes.filter(c => !presentCodes.has(c));
      if (missingCodes.length > 0) {
        const nameMap = await this.timesheetsService.getEmployeeNamesByCodes(missingCodes);
        for (const code of missingCodes) {
          result.push({
            employeeCode:    code,
            employeeName:    nameMap.get(code) || code,
            totalMinutes:    0,
            clockIn:         '',
            clockOut:        '',
            tasks:           [],
            noTimeRecorded:  true,
          });
        }
      }
    }

    return result;
  }

  @Get('pending-approvals')
  async getPendingApprovals(@Query('department') department?: string, @Query('debug') debug?: string, @Req() req?: any) {
    const roleCode    = req?.currentUser?.roleCode    ?? '';
    const userId      = req?.currentUser?.userId      ?? '';
    const displayName = req?.currentUser?.displayName ?? '';

    const isApprover = await this.timesheetsService.isTimesheetApprover(roleCode);
    if (!isApprover) throw new HttpException({ message: 'You do not have permission to view pending approvals' }, HttpStatus.FORBIDDEN);

    const all = await this.timesheetsService.getPendingApprovals(department);
    const debugMode = debug === '1';
    const debugRows: any[] = [];

    // Filter to only timesheets this specific user is authorised to approve
    const allowed: typeof all = [];
    for (const ts of all) {
      const check = await this.approvalSettingsService.canUserApproveTimesheet(
        userId, displayName, roleCode,
        { tsType: ts.tsType, department_code: ts.department_code, shiftCode: ts.shiftCode, projectId: ts.projectId, workOrderNo: ts.workOrderNo, digitalTech: ts.digitalTech },
        true,
      );
      this.logger.log(`[pending-approvals] ${ts.tsDocNo} (${ts.tsType}) dept="${ts.department_code}" user=${userId} name="${displayName}" → allowed=${check.allowed} reason="${check.reason}"`);
      if (check.allowed) allowed.push(ts);
      if (debugMode) debugRows.push({ tsDocNo: ts.tsDocNo, tsType: ts.tsType, department_code: ts.department_code, allowed: check.allowed, reason: check.reason });
    }
    this.logger.log(`[pending-approvals] user=${userId} name="${displayName}" total=${all.length} allowed=${allowed.length}`);
    if (debugMode) return { userId, displayName, total: all.length, allowed: allowed.length, rows: debugRows };
    return allowed;
  }

  @Get('ts-employees')
  async getTsEmployees(@Req() req?: any) {
    const roleCode = req?.currentUser?.roleCode ?? '';
    // Accessible to anyone with at least one timesheet read permission
    const hasProd = await this.timesheetsService.assertPermission(roleCode, 'PROD', 'canRead').then(() => true).catch(() => false);
    const hasInst = !hasProd && await this.timesheetsService.assertPermission(roleCode, 'INST', 'canRead').then(() => true).catch(() => false);
    const hasProj = !hasProd && !hasInst && await this.timesheetsService.assertPermission(roleCode, 'PROJ', 'canRead').then(() => true).catch(() => false);
    if (!hasProd && !hasInst && !hasProj) throw new HttpException({ message: 'Forbidden' }, HttpStatus.FORBIDDEN);
    return this.timesheetsService.getTsEmployees();
  }

  @Get('project-codes')
  async getProjectCodes(@Req() req?: any) {
    const roleCode = req?.currentUser?.roleCode ?? '';
    const ok = await Promise.any([
      this.timesheetsService.assertPermission(roleCode, 'PROD', 'canRead'),
      this.timesheetsService.assertPermission(roleCode, 'INST', 'canRead'),
      this.timesheetsService.assertPermission(roleCode, 'PROJ', 'canRead'),
    ]).then(() => true).catch(() => false);
    if (!ok) throw new HttpException({ message: 'Forbidden' }, HttpStatus.FORBIDDEN);
    return this.timesheetsService.getDistinctProjectCodes();
  }

  @Get('week-entries')
  async getWeekEntries(
    @Query('employeeCode') employeeCode: string,
    @Query('weekStart') weekStart: string,
    @Query('excludeDocNos') excludeDocNos?: string,
  ) {
    if (!employeeCode || !weekStart) return {};
    return this.timesheetsService.getWeekEntries(employeeCode, weekStart, excludeDocNos);
  }

  @Get('week-proj-data')
  async getWeekProjData(
    @Query('employeeCode') employeeCode: string,
    @Query('weekStart') weekStart: string,
  ) {
    if (!employeeCode || !weekStart) return {};
    return this.timesheetsService.getWeekProjData(employeeCode, weekStart);
  }

  @Get('day-entries')
  async getDayEntries(
    @Query('employeeCode') employeeCode: string,
    @Query('date') date: string,
    @Query('excludeDocNo') excludeDocNo?: string,
  ) {
    if (!employeeCode || !date) return [];
    return this.timesheetsService.getDayEntries(employeeCode, date, excludeDocNo);
  }

  @Get('proj-line-attachments/:attachId')
  async downloadProjLineAttachment(@Param('attachId') attachId: string) {
    const file = await this.timesheetsService.getProjLineAttachment(Number(attachId));
    if (!file) throw new NotFoundException('Attachment not found');
    return file;
  }

  @Delete('proj-line-attachments/:attachId')
  async removeProjLineAttachment(@Param('attachId') attachId: string) {
    await this.timesheetsService.removeProjLineAttachment(Number(attachId));
    return { ok: true };
  }

  @Post(':docNo/confirm')
  async confirmTimesheet(@Param('docNo') docNo: string, @Req() req: any) {
    try {
      const byName = req.currentUser?.displayName || req.currentUser?.userId || 'User';
      await this.timesheetsService.confirmTimesheet(docNo, byName);
      this.auditService.log({ docType: 'TIMESHEET-PROJ', docRef: docNo, action: 'CONFIRM', performedBy: req.currentUser?.userId, performedByName: byName, details: 'Confirmed by creator' });
      return { ok: true };
    } catch (err) {
      throw new HttpException((err as Error).message ?? 'Confirm failed', HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':docNo/submit')
  async submitForApproval(@Param('docNo') docNo: string, @Req() req: any) {
    try {
      await this.timesheetsService.assertPermission(req.currentUser?.roleCode ?? '', this.timesheetsService.typeFromDocNo(docNo), 'canCreate');
      const ts = await this.timesheetsService.get(docNo);
      if (!ts) throw new NotFoundException(`Timesheet ${docNo} not found`);
      const byName = req.currentUser?.displayName || '';
      await this.timesheetsService.submitForApproval(docNo, byName);
      this.auditService.log({ docType: `TIMESHEET-${(ts.tsType||'PROD').toUpperCase()}`, docRef: docNo, action: 'SUBMIT', performedBy: req.currentUser?.userId, performedByName: byName, details: 'Submitted for approval' });
      const approverEmails = await this.approvalSettingsService.getApproversForTimesheet(ts);
      const typeLabel = ts.tsType === 'INST' ? 'Installation' : 'Production';
      const submitterEmail = await this.getEmailForUser(ts.entered_by_name);
      await this.notify(
        ts.tsType === 'INST' ? 'INST' : 'PROD', 'SUBMIT',
        approverEmails,
        submitterEmail,
        `Timesheet ${docNo} submitted for approval`,
        EmailService.template('Timesheet Submitted for Approval', `
          <p style="margin:0 0 16px">A ${typeLabel} timesheet requires your approval.</p>
          <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;width:40%">Document No.</td><td style="padding:12px 16px;font-weight:700;border-bottom:1px solid #e5e7eb">${docNo}</td></tr>
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb">Submitted By</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${byName}</td></tr>
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb">Date</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${ts.entryDate}</td></tr>
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Department</td><td style="padding:12px 16px">${ts.department_code || '—'}</td></tr>
          </table>
        `),
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
        req.currentUser?.userId, req.currentUser?.displayName || '', req.currentUser?.roleCode, ts, hasCanWrite,
      );
      if (!check.allowed) throw new HttpException({ message: check.reason }, HttpStatus.FORBIDDEN);
      const byName = req.currentUser?.displayName || body?.approverName || '';
      await this.timesheetsService.approve(docNo, byName, body?.edits);
      this.auditService.log({ docType: `TIMESHEET-${(ts.tsType||'PROD').toUpperCase()}`, docRef: docNo, action: 'APPROVE', performedBy: req.currentUser?.userId, performedByName: byName, details: 'Approved' });
      const approverEmails = await this.approvalSettingsService.getApproversForTimesheet(ts);
      const typeLabel = ts.tsType === 'INST' ? 'Installation' : 'Production';
      const submitterEmail = await this.getEmailForUser(ts.entered_by_name);
      await this.notify(
        ts.tsType === 'INST' ? 'INST' : 'PROD', 'APPROVE',
        approverEmails,
        submitterEmail,
        `Timesheet ${docNo} approved`,
        EmailService.template('Timesheet Approved', `
          <p style="margin:0 0 16px">Hi ${ts.entered_by_name},</p>
          <p style="margin:0 0 20px;color:#444">Your timesheet has been approved.</p>
          <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;width:40%">Document No.</td><td style="padding:12px 16px;font-weight:700;border-bottom:1px solid #e5e7eb">${docNo}</td></tr>
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb">Type</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${typeLabel}</td></tr>
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Approved By</td><td style="padding:12px 16px">${byName}</td></tr>
          </table>
          <div style="margin:20px 0;padding:12px 16px;background:#d1fae5;border-left:4px solid #10b981;border-radius:0 6px 6px 0;font-size:13px;color:#065f46">
            ✓ Approved
          </div>
        `),
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
        req.currentUser?.userId, req.currentUser?.displayName || '', req.currentUser?.roleCode, ts, hasCanWrite,
      );
      if (!check.allowed) throw new HttpException({ message: check.reason }, HttpStatus.FORBIDDEN);
      const byName = req.currentUser?.displayName || '';
      await this.timesheetsService.reject(docNo, byName, body.reason || '');
      this.auditService.log({ docType: `TIMESHEET-${(ts.tsType||'PROD').toUpperCase()}`, docRef: docNo, action: 'REJECT', performedBy: req.currentUser?.userId, performedByName: byName, details: `Rejected: ${body.reason || '—'}` });
      const approverEmails = await this.approvalSettingsService.getApproversForTimesheet(ts);
      const typeLabel = ts.tsType === 'INST' ? 'Installation' : 'Production';
      const submitterEmail = await this.getEmailForUser(ts.entered_by_name);
      await this.notify(
        ts.tsType === 'INST' ? 'INST' : 'PROD', 'REJECT',
        approverEmails,
        submitterEmail,
        `Timesheet ${docNo} rejected`,
        EmailService.template('Timesheet Rejected', `
          <p style="margin:0 0 16px">Hi ${ts.entered_by_name},</p>
          <p style="margin:0 0 20px;color:#444">Your timesheet has been rejected and requires correction.</p>
          <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;width:40%">Document No.</td><td style="padding:12px 16px;font-weight:700;border-bottom:1px solid #e5e7eb">${docNo}</td></tr>
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb">Type</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${typeLabel}</td></tr>
            <tr><td style="padding:12px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Rejected By</td><td style="padding:12px 16px">${byName}</td></tr>
          </table>
          <div style="margin:20px 0;padding:12px 16px;background:#fee2e2;border-left:4px solid #ef4444;border-radius:0 6px 6px 0;font-size:13px;color:#991b1b">
            <strong>Reason:</strong> ${body.reason || '—'}
          </div>
          <p style="margin:0;color:#444;font-size:14px">Please correct and resubmit your timesheet.</p>
        `),
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
  async reportDetail(
    @Query('dateFrom')    dateFrom?: string,
    @Query('dateTo')      dateTo?: string,
    @Query('type')        type?: string,
    @Query('status')      status?: string,
    @Query('department')  department?: string,
    @Query('workOrderNo') workOrderNo?: string,
    @Query('projectId')   projectId?: string,
    @Req() req?: any,
  ) {
    await this.timesheetsService.assertPermission(req?.currentUser?.roleCode ?? '', this.typeToModule(type), 'canReport');
    return this.timesheetsService.reportDetail({ dateFrom, dateTo, type, status, department, workOrderNo, projectId });
  }

  @Get('report-summary')
  async reportSummary(
    @Query('dateFrom')   dateFrom?: string,
    @Query('dateTo')     dateTo?: string,
    @Query('type')       type?: string,
    @Query('status')     status?: string,
    @Query('department') department?: string,
    @Req() req?: any,
  ) {
    await this.timesheetsService.assertPermission(req?.currentUser?.roleCode ?? '', this.typeToModule(type), 'canReport');
    return this.timesheetsService.reportSummary({ dateFrom, dateTo, type, status, department });
  }

  @Get('preview-docno')
  async previewDocNo(@Query('type') type?: string, @Req() req?: any) {
    await this.timesheetsService.assertPermission(req?.currentUser?.roleCode ?? '', this.typeToModule(type), 'canCreate');
    return this.timesheetsService.previewDocNo(type || 'PROD');
  }

  @Get('doc-numbering')
  async getDocNumbering(@Req() req?: any) {
    await this.timesheetsService.assertPermission(req?.currentUser?.roleCode ?? '', 'DOC_NUMBERING', 'canRead');
    return this.timesheetsService.getDocNumberingSettings();
  }

  @Put('doc-numbering')
  async updateDocNumbering(@Body() body: { rows: { docType: string; prefix: string; sequenceDigits: number }[] }, @Req() req?: any) {
    await this.timesheetsService.assertPermission(req?.currentUser?.roleCode ?? '', 'DOC_NUMBERING', 'canWrite');
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
  async get(@Param('docNo') docNo: string, @Req() req?: any) {
    await this.timesheetsService.assertPermission(req?.currentUser?.roleCode ?? '', this.timesheetsService.typeFromDocNo(docNo), 'canRead');
    const record = await this.timesheetsService.get(docNo);
    if (!record) throw new NotFoundException(`Timesheet ${docNo} not found`);
    return record;
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: any, @Req() req: any) {
    try {
      await this.timesheetsService.assertPermission(req.currentUser?.roleCode ?? '', (body.tsType ?? 'PROD').toUpperCase(), 'canCreate');
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
      await this.timesheetsService.assertPermission(req.currentUser?.roleCode ?? '', this.timesheetsService.typeFromDocNo(docNo), 'canWrite');
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
      await this.timesheetsService.assertPermission(req.currentUser?.roleCode ?? '', 'PROJ', 'canCreate');
      const entryPerson = req.currentUser?.displayName || '';

      // Group all rows by date — one timesheet per date, multiple labour lines per timesheet
      const byDate = new Map<string, any[]>();
      for (const row of body.rows ?? []) {
        for (let i = 0; i < (row.dates?.length ?? 0); i++) {
          const startTime = (row.days?.[i]?.s ?? '').trim();
          const endTime   = (row.days?.[i]?.e ?? '').trim();
          if (!startTime && !endTime) continue;
          let duration = 0;
          if (startTime && endTime) {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);
            duration = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
          }
          const date = row.dates[i];
          if (!byDate.has(date)) byDate.set(date, []);
          byDate.get(date)!.push({
            employee:     body.employee,
            startTime:    startTime || null,
            endTime:      endTime   || null,
            duration:     String(duration),
            projectId:    row.projectId   || null,
            taskTypeCode: row.taskType    || null,
            comments:     row.comment     || null,
          });
        }
      }

      if (byDate.size === 0) {
        throw new HttpException({ message: 'No filled days found. Enter at least one time range.' }, HttpStatus.BAD_REQUEST);
      }

      const records: any[] = [];
      for (const [date, labourRows] of byDate) {
        records.push({
          tsType:          'PROJ',
          date,
          entryPerson,
          enteredByUserId: req.currentUser?.userId,
          labourRows,
        });
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
      const batchType = ((body.records?.[0]?.tsType) ?? 'PROD').toUpperCase();
      await this.timesheetsService.assertPermission(req.currentUser?.roleCode ?? '', batchType, 'canCreate');
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
      await this.timesheetsService.assertPermission(req.currentUser?.roleCode ?? '', this.timesheetsService.typeFromDocNo(docNo), 'canDelete');
      await this.timesheetsService.remove(docNo);
      this.auditService.log({ docType: 'TIMESHEET', docRef: docNo, action: 'DELETE', performedBy: req.currentUser?.userId, performedByName: req.currentUser?.displayName, details: `Deleted timesheet` });
      return { ok: true };
    } catch (err) {
      this.logger.error(`Delete ${docNo} failed`, err);
      throw new HttpException({ message: err?.message || 'Delete failed' }, err?.message?.includes('not found') ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
