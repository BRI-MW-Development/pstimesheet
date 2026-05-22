import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as mssql from 'mssql';
import * as nodemailer from 'nodemailer';
import { DEV_SQL_POOL } from '../database/database.constants';

@Injectable()
export class EmailSettingsService implements OnModuleInit {
  private readonly logger = new Logger(EmailSettingsService.name);

  constructor(@Inject(DEV_SQL_POOL) private readonly pool: mssql.ConnectionPool) {}

  async onModuleInit() {
    try {
      // Add missing columns to existing PSEmailSettings table
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSEmailSettings') AND name='enabled')
          ALTER TABLE PSEmailSettings ADD enabled BIT NOT NULL DEFAULT 1;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSEmailSettings') AND name='provider')
          ALTER TABLE PSEmailSettings ADD provider NVARCHAR(10) DEFAULT 'smtp' NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSEmailSettings') AND name='graphTenantId')
          ALTER TABLE PSEmailSettings ADD graphTenantId NVARCHAR(200) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSEmailSettings') AND name='graphClientId')
          ALTER TABLE PSEmailSettings ADD graphClientId NVARCHAR(200) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSEmailSettings') AND name='graphClientSecret')
          ALTER TABLE PSEmailSettings ADD graphClientSecret NVARCHAR(500) NULL;
      `);
      // Log and fix current email settings state
      const diagRes = await this.pool.request().query(`SELECT TOP 1 id, enabled, provider, fromEmail FROM PSEmailSettings ORDER BY id`);
      const diagRow = diagRes.recordset[0];
      if (diagRow) {
        console.log(`[EmailSettings] DB row: id=${diagRow.id} enabled=${diagRow.enabled} provider=${diagRow.provider} fromEmail=${diagRow.fromEmail}`);
        if (!diagRow.enabled) {
          await this.pool.request()
            .input('id', mssql.Int, diagRow.id)
            .query(`UPDATE PSEmailSettings SET enabled = 1 WHERE id = @id`);
          console.log(`[EmailSettings] enabled was falsy — auto-corrected to 1 in DB`);
        }
      }
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PSEmailNotificationRules')
        CREATE TABLE PSEmailNotificationRules (
          id               INT IDENTITY PRIMARY KEY,
          module           NVARCHAR(20)  NOT NULL,
          event            NVARCHAR(20)  NOT NULL,
          enabled          BIT           NOT NULL DEFAULT 1,
          sendToApprover   BIT           NOT NULL DEFAULT 1,
          sendToSubmitter  BIT           NOT NULL DEFAULT 1,
          ccEmails         NVARCHAR(500) NULL,
          CONSTRAINT uq_email_rule UNIQUE (module, event)
        )
      `);
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PSEmailTemplates')
        CREATE TABLE PSEmailTemplates (
          id          INT IDENTITY PRIMARY KEY,
          templateKey NVARCHAR(50)  NOT NULL UNIQUE,
          subject     NVARCHAR(500) NOT NULL,
          bodyHtml    NVARCHAR(MAX) NOT NULL,
          updatedAt   DATETIME DEFAULT GETDATE()
        )
      `);
      // Seed default notification rules if the table is empty
      const ruleCount = await this.pool.request().query(`SELECT COUNT(*) AS cnt FROM PSEmailNotificationRules`);
      if ((ruleCount.recordset[0]?.cnt ?? 0) === 0) {
        await this.saveNotificationRules(this._defaultRules);
      }
      // Email send log table
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PSEmailLog')
        CREATE TABLE PSEmailLog (
          id          INT IDENTITY PRIMARY KEY,
          sentAt      DATETIME NOT NULL DEFAULT GETDATE(),
          module      NVARCHAR(20)  NULL,
          event       NVARCHAR(20)  NULL,
          recipient   NVARCHAR(200) NOT NULL,
          subject     NVARCHAR(500) NOT NULL,
          status      NVARCHAR(10)  NOT NULL,
          errorMsg    NVARCHAR(500) NULL
        )
      `);
    } catch (err) {
      this.logger.warn(`Schema init skipped (will retry on next request): ${(err as Error)?.message}`);
    }
  }

  async get() {
    const res = await this.pool.request().query(`SELECT TOP 1 * FROM PSEmailSettings ORDER BY id`);
    const row = res.recordset[0];
    if (!row) return { provider: 'smtp', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', fromEmail: '', fromName: '', enabled: false, graphTenantId: '', graphClientId: '', graphClientSecret: '' };
    return {
      ...row,
      provider: row.provider || 'smtp',
      smtpPass: row.smtpPass ? '••••••••' : '',
      graphClientSecret: row.graphClientSecret ? '••••••••' : '',
    };
  }

  async getSettings() {
    const res = await this.pool.request().query(`SELECT TOP 1 * FROM PSEmailSettings ORDER BY id`);
    return res.recordset[0] ?? null;
  }

  async save(body: any) {
    const existing = await this.pool.request().query(`SELECT TOP 1 id, smtpPass, graphClientSecret FROM PSEmailSettings ORDER BY id`);
    const prev = existing.recordset[0];
    const passToSave = (body.smtpPass && body.smtpPass !== '••••••••') ? body.smtpPass : (prev?.smtpPass ?? '');
    const secretToSave = (body.graphClientSecret && body.graphClientSecret !== '••••••••') ? body.graphClientSecret : (prev?.graphClientSecret ?? '');

    if (prev) {
      await this.pool.request()
        .input('id',          mssql.Int,           prev.id)
        .input('provider',    mssql.NVarChar(10),  body.provider || 'smtp')
        .input('host',        mssql.NVarChar(200), body.smtpHost || null)
        .input('port',        mssql.Int,           Number(body.smtpPort) || 587)
        .input('user',        mssql.NVarChar(200), body.smtpUser || null)
        .input('pass',        mssql.NVarChar(500), passToSave || null)
        .input('from',        mssql.NVarChar(200), body.fromEmail || null)
        .input('fromName',    mssql.NVarChar(200), body.fromName || null)
        .input('enabled',     mssql.Bit,           body.enabled ? 1 : 0)
        .input('tenantId',    mssql.NVarChar(200), body.graphTenantId || null)
        .input('clientId',    mssql.NVarChar(200), body.graphClientId || null)
        .input('clientSecret',mssql.NVarChar(500), secretToSave || null)
        .query(`UPDATE PSEmailSettings SET provider=@provider,
          smtpHost=@host, smtpPort=@port, smtpUser=@user, smtpPass=@pass,
          fromEmail=@from, fromName=@fromName, enabled=@enabled,
          graphTenantId=@tenantId, graphClientId=@clientId, graphClientSecret=@clientSecret,
          updatedAt=GETDATE() WHERE id=@id`);
    } else {
      await this.pool.request()
        .input('provider',    mssql.NVarChar(10),  body.provider || 'smtp')
        .input('host',        mssql.NVarChar(200), body.smtpHost || null)
        .input('port',        mssql.Int,           Number(body.smtpPort) || 587)
        .input('user',        mssql.NVarChar(200), body.smtpUser || null)
        .input('pass',        mssql.NVarChar(500), passToSave || null)
        .input('from',        mssql.NVarChar(200), body.fromEmail || null)
        .input('fromName',    mssql.NVarChar(200), body.fromName || null)
        .input('enabled',     mssql.Bit,           body.enabled ? 1 : 0)
        .input('tenantId',    mssql.NVarChar(200), body.graphTenantId || null)
        .input('clientId',    mssql.NVarChar(200), body.graphClientId || null)
        .input('clientSecret',mssql.NVarChar(500), secretToSave || null)
        .query(`INSERT INTO PSEmailSettings (provider, smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName, enabled, graphTenantId, graphClientId, graphClientSecret)
                VALUES (@provider, @host, @port, @user, @pass, @from, @fromName, @enabled, @tenantId, @clientId, @clientSecret)`);
    }
    return { ok: true };
  }

  // ── Microsoft Graph API email ──
  static async sendViaGraph(cfg: any, to: string, subject: string, html: string): Promise<void> {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${cfg.graphTenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: cfg.graphClientId,
          client_secret: cfg.graphClientSecret,
          scope: 'https://graph.microsoft.com/.default',
        }),
      }
    );
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Graph: failed to obtain access token');
    }
    const mailRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${cfg.fromEmail}/sendMail`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'HTML', content: html },
            toRecipients: [{ emailAddress: { address: to } }],
          },
        }),
      }
    );
    if (!mailRes.ok) {
      const err = await mailRes.json().catch(() => ({})) as any;
      throw new Error(err?.error?.message || `Graph API error ${mailRes.status}`);
    }
  }

  // ── Notification Rules ──

  private readonly _defaultRules = [
    { module: 'PROD', event: 'SUBMIT',   enabled: true,  sendToApprover: true,  sendToSubmitter: false, ccEmails: '' },
    { module: 'PROD', event: 'APPROVE',  enabled: true,  sendToApprover: false, sendToSubmitter: true,  ccEmails: '' },
    { module: 'PROD', event: 'REJECT',   enabled: true,  sendToApprover: false, sendToSubmitter: true,  ccEmails: '' },
    { module: 'INST', event: 'SUBMIT',   enabled: true,  sendToApprover: true,  sendToSubmitter: false, ccEmails: '' },
    { module: 'INST', event: 'APPROVE',  enabled: true,  sendToApprover: false, sendToSubmitter: true,  ccEmails: '' },
    { module: 'INST', event: 'REJECT',   enabled: true,  sendToApprover: false, sendToSubmitter: true,  ccEmails: '' },
    { module: 'WO',   event: 'COMPLETE', enabled: true,  sendToApprover: false, sendToSubmitter: false, ccEmails: '' },
  ];

  async getNotificationRule(module: string, event: string) {
    const res = await this.pool.request()
      .input('module', mssql.NVarChar(20), module)
      .input('event',  mssql.NVarChar(20), event)
      .query(`SELECT TOP 1 * FROM PSEmailNotificationRules WHERE module=@module AND event=@event`);
    return res.recordset[0] ?? null;
  }

  async getNotificationRules() {
    const res = await this.pool.request().query(`SELECT * FROM PSEmailNotificationRules ORDER BY module, event`);
    if (res.recordset.length === 0) {
      await this.saveNotificationRules(this._defaultRules);
      return this._defaultRules;
    }
    return res.recordset;
  }

  async saveNotificationRules(rules: Array<{ module: string; event: string; enabled: boolean; sendToApprover: boolean; sendToSubmitter: boolean; ccEmails?: string }>) {
    for (const r of rules) {
      await this.pool.request()
        .input('module',          mssql.NVarChar(20),  r.module)
        .input('event',           mssql.NVarChar(20),  r.event)
        .input('enabled',         mssql.Bit,           r.enabled ? 1 : 0)
        .input('sendToApprover',  mssql.Bit,           r.sendToApprover ? 1 : 0)
        .input('sendToSubmitter', mssql.Bit,           r.sendToSubmitter ? 1 : 0)
        .input('ccEmails',        mssql.NVarChar(500), r.ccEmails || null)
        .query(`
          MERGE PSEmailNotificationRules AS target
          USING (SELECT @module AS module, @event AS event) AS src ON (target.module = src.module AND target.event = src.event)
          WHEN MATCHED THEN
            UPDATE SET enabled=@enabled, sendToApprover=@sendToApprover, sendToSubmitter=@sendToSubmitter, ccEmails=@ccEmails
          WHEN NOT MATCHED THEN
            INSERT (module, event, enabled, sendToApprover, sendToSubmitter, ccEmails)
            VALUES (@module, @event, @enabled, @sendToApprover, @sendToSubmitter, @ccEmails);
        `);
    }
    return { ok: true };
  }

  // ── Templates ──

  getDefaultTemplate(key: string): { subject: string; bodyHtml: string } {
    const defaults: Record<string, { subject: string; bodyHtml: string }> = {
      TIMESHEET_SUBMIT: {
        subject: '[TimesheetPro] Timesheet {{docNo}} Submitted for Approval',
        bodyHtml: `<p>A timesheet has been submitted and requires your approval.</p>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
  <tr><td style="color:#6b7280;padding-right:16px">Document No</td><td><strong>{{docNo}}</strong></td></tr>
  <tr><td style="color:#6b7280">Type</td><td>{{type}}</td></tr>
  <tr><td style="color:#6b7280">Submitted By</td><td>{{submitter}}</td></tr>
  <tr><td style="color:#6b7280">Department</td><td>{{department}}</td></tr>
  <tr><td style="color:#6b7280">Date</td><td>{{date}}</td></tr>
</table>
<p style="margin-top:16px">Please review and action this timesheet in TimesheetPro.</p>`,
      },
      TIMESHEET_APPROVE: {
        subject: '[TimesheetPro] Timesheet {{docNo}} Approved',
        bodyHtml: `<p>Your timesheet has been approved.</p>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
  <tr><td style="color:#6b7280;padding-right:16px">Document No</td><td><strong>{{docNo}}</strong></td></tr>
  <tr><td style="color:#6b7280">Approved By</td><td>{{approver}}</td></tr>
  <tr><td style="color:#6b7280">Date</td><td>{{date}}</td></tr>
</table>`,
      },
      TIMESHEET_REJECT: {
        subject: '[TimesheetPro] Timesheet {{docNo}} Rejected',
        bodyHtml: `<p>Your timesheet has been rejected.</p>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
  <tr><td style="color:#6b7280;padding-right:16px">Document No</td><td><strong>{{docNo}}</strong></td></tr>
  <tr><td style="color:#6b7280">Rejected By</td><td>{{approver}}</td></tr>
  <tr><td style="color:#6b7280">Reason</td><td>{{reason}}</td></tr>
  <tr><td style="color:#6b7280">Date</td><td>{{date}}</td></tr>
</table>
<p style="margin-top:16px">Please update and resubmit your timesheet in TimesheetPro.</p>`,
      },
      WO_COMPLETE: {
        subject: '[TimesheetPro] Work Order {{workOrder}} Completed',
        bodyHtml: `<p>A work order has been marked as complete.</p>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
  <tr><td style="color:#6b7280;padding-right:16px">Work Order</td><td><strong>{{workOrder}}</strong></td></tr>
  <tr><td style="color:#6b7280">Completed By</td><td>{{submitter}}</td></tr>
  <tr><td style="color:#6b7280">Date</td><td>{{date}}</td></tr>
</table>`,
      },
    };
    return defaults[key] ?? { subject: '', bodyHtml: '' };
  }

  async getTemplate(key: string) {
    const res = await this.pool.request()
      .input('key', mssql.NVarChar(50), key)
      .query(`SELECT subject, bodyHtml FROM PSEmailTemplates WHERE templateKey = @key`);
    if (res.recordset[0]) return res.recordset[0];
    return this.getDefaultTemplate(key);
  }

  async saveTemplate(key: string, subject: string, bodyHtml: string) {
    await this.pool.request()
      .input('key',      mssql.NVarChar(50),  key)
      .input('subject',  mssql.NVarChar(500), subject)
      .input('bodyHtml', mssql.NVarChar(mssql.MAX), bodyHtml)
      .query(`
        MERGE PSEmailTemplates AS target
        USING (SELECT @key AS templateKey) AS src ON (target.templateKey = src.templateKey)
        WHEN MATCHED THEN
          UPDATE SET subject=@subject, bodyHtml=@bodyHtml, updatedAt=GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (templateKey, subject, bodyHtml) VALUES (@key, @subject, @bodyHtml);
      `);
    return { ok: true };
  }

  async resetTemplate(key: string) {
    await this.pool.request()
      .input('key', mssql.NVarChar(50), key)
      .query(`DELETE FROM PSEmailTemplates WHERE templateKey = @key`);
    return this.getDefaultTemplate(key);
  }

  // ── Email Log ──

  async addLog(entry: { module?: string; event?: string; recipient: string; subject: string; status: 'sent' | 'failed' | 'skipped'; errorMsg?: string }) {
    await this.pool.request()
      .input('module',    mssql.NVarChar(20),  entry.module    || null)
      .input('event',     mssql.NVarChar(20),  entry.event     || null)
      .input('recipient', mssql.NVarChar(200), entry.recipient)
      .input('subject',   mssql.NVarChar(500), entry.subject)
      .input('status',    mssql.NVarChar(10),  entry.status)
      .input('errorMsg',  mssql.NVarChar(500), entry.errorMsg  || null)
      .query(`INSERT INTO PSEmailLog (module, event, recipient, subject, status, errorMsg) VALUES (@module, @event, @recipient, @subject, @status, @errorMsg)`);
  }

  async getLogs(limit = 100) {
    const res = await this.pool.request()
      .input('limit', mssql.Int, limit)
      .query(`SELECT TOP (@limit) * FROM PSEmailLog ORDER BY sentAt DESC`);
    return res.recordset;
  }

  async clearLogs() {
    await this.pool.request().query(`DELETE FROM PSEmailLog`);
    return { ok: true };
  }

  // ── Diagnostics ──

  async getRaw() {
    const res = await this.pool.request().query(`SELECT TOP 1 id, enabled, provider, fromEmail, fromName, smtpHost, smtpPort, smtpUser, graphTenantId, graphClientId, updatedAt FROM PSEmailSettings ORDER BY id`);
    return res.recordset[0] ?? null;
  }

  async forceEnable() {
    const existing = await this.pool.request().query(`SELECT TOP 1 id FROM PSEmailSettings ORDER BY id`);
    if (!existing.recordset[0]) return { ok: false, message: 'No row found in PSEmailSettings' };
    await this.pool.request()
      .input('id', mssql.Int, existing.recordset[0].id)
      .query(`UPDATE PSEmailSettings SET enabled = 1 WHERE id = @id`);
    const after = await this.getRaw();
    return { ok: true, message: 'enabled forced to 1', row: after };
  }

  // ── Test send ──

  private buildTransport(cfg: any) {
    const port = Number(cfg.smtpPort) || 587;
    return nodemailer.createTransport({
      host: cfg.smtpHost,
      port,
      secure: port === 465,
      auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
      tls: { rejectUnauthorized: false },
    });
  }

  async sendTestEmail(to: string) {
    const cfg = await this.getSettings();
    if (!cfg) return { ok: false, message: 'No email settings saved yet.' };
    const provider = cfg.provider || 'smtp';
    try {
      if (provider === 'graph') {
        if (!cfg.graphTenantId || !cfg.graphClientId || !cfg.graphClientSecret) {
          return { ok: false, message: 'Microsoft Graph credentials are incomplete. Fill in Tenant ID, Client ID, and Client Secret.' };
        }
        await EmailSettingsService.sendViaGraph(cfg, to, 'Test Email from TimesheetPro', '<p>This is a test email from <strong>TimesheetPro</strong>. Microsoft Graph is configured correctly.</p>');
      } else {
        if (!cfg.smtpHost) return { ok: false, message: 'SMTP Host is not configured.' };
        const transporter = this.buildTransport(cfg);
        await transporter.sendMail({
          from: cfg.fromEmail ? `"${cfg.fromName || 'TimesheetPro'}" <${cfg.fromEmail}>` : cfg.smtpUser,
          to,
          subject: 'Test Email from TimesheetPro',
          html: '<p>This is a test email from <strong>TimesheetPro</strong>. Your SMTP configuration is working correctly.</p>',
        });
      }
      return { ok: true, message: `Test email sent to ${to}.` };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Send failed.' };
    }
  }
}
