import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';
import { ApprovalSettingsModule } from '../approval-settings/approval-settings.module';
import { EmailSettingsModule } from '../email-settings/email-settings.module';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [AuditModule, ApprovalSettingsModule, EmailSettingsModule, S3Module],
  controllers: [TimesheetsController],
  providers: [TimesheetsService],
})
export class TimesheetsModule {}
