import { Module } from '@nestjs/common';
import { ApprovalSettingsController } from './approval-settings.controller';
import { ApprovalSettingsService } from './approval-settings.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ApprovalSettingsController],
  providers: [ApprovalSettingsService],
  exports: [ApprovalSettingsService],
})
export class ApprovalSettingsModule {}
