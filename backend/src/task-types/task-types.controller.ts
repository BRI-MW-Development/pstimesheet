import { UseGuards, Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { TaskTypesService } from './task-types.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('task-types')
export class TaskTypesController {
  constructor(private readonly taskTypesService: TaskTypesService) {}

  @UseGuards(PermissionGuard)
  @RequirePermission('TASK_TYPES', 'canRead')
  @Get()
  list() { return this.taskTypesService.list(); }

  @UseGuards(PermissionGuard)
  @RequirePermission('TASK_TYPES', 'canCreate')
  @Post()
  @HttpCode(201)
  async create(@Body() body: any) {
    try {
      return await this.taskTypesService.create(body);
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Create failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(PermissionGuard)
  @RequirePermission('TASK_TYPES', 'canWrite')
  @Put(':taskTypeId')
  async update(@Param('taskTypeId') taskTypeId: string, @Body() body: any) {
    try {
      return await this.taskTypesService.update(taskTypeId, body);
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Update failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
