import { Module } from '@nestjs/common';
import { MachineryController } from './machinery.controller';
import { MachineryService } from './machinery.service';

@Module({
  controllers: [MachineryController],
  providers: [MachineryService],
})
export class MachineryModule {}
