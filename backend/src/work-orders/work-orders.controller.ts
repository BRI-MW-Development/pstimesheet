import { UseGuards, Controller, Get, Query } from '@nestjs/common';
import type { ListWorkOrdersQueryDto } from './dto/list-work-orders-query.dto';
import { WorkOrdersService } from './work-orders.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @UseGuards(PermissionGuard)
  @RequirePermission('WORK_ORDERS', 'canRead')
  @Get()
  async list(@Query() query: ListWorkOrdersQueryDto) {
    return this.workOrdersService.list(query);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission('WORK_ORDERS', 'canRead')
  @Get('numbers')
  async listNumbers() {
    return this.workOrdersService.listNumbers();
  }
}
