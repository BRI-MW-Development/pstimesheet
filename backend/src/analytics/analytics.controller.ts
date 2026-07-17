import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @UseGuards(PermissionGuard)
  @RequirePermission('ANALYTICS', 'canReport')
  @Get()
  get(@Query('from') from: string, @Query('to') to: string) {
    const now   = new Date();
    const dfrom = from || `${now.getFullYear()}-01-01`;
    const dto   = to   || now.toISOString().slice(0, 10);
    if (dfrom > dto)
      throw new (require('@nestjs/common').BadRequestException)(`"from" (${dfrom}) must not be after "to" (${dto}).`);
    return this.svc.getAll(dfrom, dto);
  }
}
