import { UseGuards, Controller, Get, Query } from '@nestjs/common';
import type { ListMachineryQueryDto } from './dto/list-machinery-query.dto';
import { MachineryService } from './machinery.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('machinery')
export class MachineryController {
  constructor(private readonly machineryService: MachineryService) {}

  @UseGuards(PermissionGuard)
  @RequirePermission('MACHINERY', 'canRead')
  @Get()
  async list(@Query() query: ListMachineryQueryDto) {
    return this.machineryService.list(query);
  }
}
