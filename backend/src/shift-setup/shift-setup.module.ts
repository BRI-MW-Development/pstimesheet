import { Module } from '@nestjs/common';
import { ShiftSetupController } from './shift-setup.controller';
import { ShiftSetupService } from './shift-setup.service';

@Module({
  controllers: [ShiftSetupController],
  providers: [ShiftSetupService],
})
export class ShiftSetupModule {}
