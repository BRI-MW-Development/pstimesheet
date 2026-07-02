import { Inject, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';
import { EmailSettingsService } from '../email-settings/email-settings.service';

const APP_URL = process.env.APP_URL || 'https://apps.professional-signs.com/login';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  static template(title: string, bodyHtml: string, showLoginBtn = true): string {
    return `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
        <div style="background:#0f7173;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;color:#fff;font-size:20px">PS TimeSheet — ${title}</h2>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          ${bodyHtml}
          ${showLoginBtn ? `<div style="margin-top:24px"><a href="${APP_URL}" style="display:inline-block;padding:12px 24px;background:#0f7173;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px">Open PS TimeSheet</a></div>` : ''}
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">If you did not expect this email, please contact your administrator.</p>
        </div>
      </div>`;
  }

  constructor(@Inject(DEV_SQL_POOL) private readonly pool: mssql.ConnectionPool) {}

  private async getSettings(): Promise<any | null> {
    const res = await this.pool.request().query(`SELECT TOP 1 * FROM PSEmailSettings ORDER BY id`);
    return res.recordset[0] ?? null;
  }

  private createTransport(cfg: any) {
    const port = Number(cfg.smtpPort) || 587;
    return nodemailer.createTransport({
      host: cfg.smtpHost,
      port,
      secure: port === 465,
      auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
      tls: { rejectUnauthorized: false },
    });
  }

  async send(to: string, subject: string, html: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      const cfg = await this.getSettings();
      this.logger.log(`EMAIL cfg: enabled=${JSON.stringify(cfg?.enabled)} provider=${cfg?.provider} fromEmail=${cfg?.fromEmail} hasSecret=${!!cfg?.graphClientSecret}`);
      if (!cfg) {
        this.logger.warn('Email not sent — no email settings configured');
        return { ok: false, reason: 'No email settings configured' };
      }
      if (!cfg.enabled) {
        this.logger.warn(`Email not sent — cfg.enabled=${JSON.stringify(cfg.enabled)} (falsy). Tick "Enable Email Notifications" in Email Settings and save.`);
        return { ok: false, reason: 'Email notifications are disabled — tick "Enable Email Notifications" in Email Settings and save' };
      }
      if ((cfg.provider || 'smtp') === 'graph') {
        await EmailSettingsService.sendViaGraph(cfg, to, subject, html);
      } else {
        const transporter = this.createTransport(cfg);
        await transporter.sendMail({ from: `"${cfg.fromName}" <${cfg.fromEmail}>`, to, subject, html });
      }
      this.logger.log(`Email sent to ${to}: ${subject}`);
      return { ok: true };
    } catch (err) {
      this.logger.error(`Email send failed to ${to}`, err?.message);
      return { ok: false, reason: err?.message || 'Send error' };
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const cfg = await this.getSettings();
      if (!cfg) return { ok: false, message: 'No email settings found' };
      if ((cfg.provider || 'smtp') === 'graph') {
        if (!cfg.graphTenantId || !cfg.graphClientId || !cfg.graphClientSecret) {
          return { ok: false, message: 'Microsoft Graph credentials incomplete' };
        }
        // Verify token is obtainable
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
        const data = await tokenRes.json() as any;
        if (!data.access_token) throw new Error(data.error_description || 'Token request failed');
        return { ok: true, message: 'Microsoft Graph connection successful' };
      } else {
        const transporter = this.createTransport(cfg);
        await transporter.verify();
        return { ok: true, message: 'SMTP connection successful' };
      }
    } catch (err) {
      return { ok: false, message: err?.message || 'Connection failed' };
    }
  }
}
