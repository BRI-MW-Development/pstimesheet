import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { QcController } from './qc.controller';
import { QcService } from './qc.service';

@Module({
  imports: [AuditModule],
  controllers: [QcController],
  providers: [QcService],
})
export class QcModule {}
