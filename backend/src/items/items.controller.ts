import { Controller, Get, Query } from '@nestjs/common';
import type { ListItemsQueryDto } from './dto/list-items-query.dto';
import { ItemsService } from './items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  async list(@Query() query: ListItemsQueryDto) {
    return this.itemsService.list(query);
  }
}
