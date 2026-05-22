import { Controller, Get, Query } from '@nestjs/common';
import type { ListMachineryQueryDto } from './dto/list-machinery-query.dto';
import { MachineryService } from './machinery.service';

@Controller('machinery')
export class MachineryController {
  constructor(private readonly machineryService: MachineryService) {}

  @Get()
  async list(@Query() query: ListMachineryQueryDto) {
    return this.machineryService.list(query);
  }
}
