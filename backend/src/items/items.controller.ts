import { UseGuards, Controller, Get, Query } from '@nestjs/common';
import type { ListItemsQueryDto } from './dto/list-items-query.dto';
import { ItemsService } from './items.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @UseGuards(PermissionGuard)
  @RequirePermission('ITEMS', 'canRead')
  @Get()
  async list(@Query() query: ListItemsQueryDto) {
    return this.itemsService.list(query);
  }
}
