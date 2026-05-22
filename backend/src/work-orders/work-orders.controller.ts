import { Controller, Get, Query } from '@nestjs/common';
import type { ListWorkOrdersQueryDto } from './dto/list-work-orders-query.dto';
import { WorkOrdersService } from './work-orders.service';

@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get()
  async list(@Query() query: ListWorkOrdersQueryDto) {
    return this.workOrdersService.list(query);
  }
}
