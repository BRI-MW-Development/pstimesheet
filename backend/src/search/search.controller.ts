import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get()
  search(@Query('q') q: string) {
    if (!q || q.trim().length < 2) return { timesheets: [], workOrders: [], projects: [], employees: [] };
    return this.svc.search(q);
  }
}
