import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';
import { ApprovalSettingsModule } from '../approval-settings/approval-settings.module';
import { EmailSettingsModule } from '../email-settings/email-settings.module';
import { EmailModule } from '../email/email.module';
import { S3Module } from '../s3/s3.module';
import { HodTeamsModule } from '../hod-teams/hod-teams.module';

@Module({
  imports: [AuditModule, ApprovalSettingsModule, EmailSettingsModule, EmailModule, S3Module, HodTeamsModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsService],
})
export class TimesheetsModule {}
