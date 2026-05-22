import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { WoCompleteController } from './wo-complete.controller';
import { WoCompleteService } from './wo-complete.service';

@Module({
  imports: [AuditModule],
  controllers: [WoCompleteController],
  providers: [WoCompleteService],
})
export class WoCompleteModule {}
