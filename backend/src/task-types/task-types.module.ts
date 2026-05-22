import { Module } from '@nestjs/common';
import { TaskTypesController } from './task-types.controller';
import { TaskTypesService } from './task-types.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TaskTypesController],
  providers: [TaskTypesService],
})
export class TaskTypesModule {}
