import { Module } from '@nestjs/common';
import { AccessEquipmentController } from './access-equipment.controller';
import { AccessEquipmentService } from './access-equipment.service';

@Module({
  controllers: [AccessEquipmentController],
  providers: [AccessEquipmentService],
})
export class AccessEquipmentModule {}
