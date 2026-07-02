import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @UseGuards(PermissionGuard)
  @RequirePermission('AUDIT_TRAIL', 'canRead')
  @Get()
  query(
    @Query('docType')     docType?: string,
    @Query('action')      action?: string,
    @Query('performedBy') performedBy?: string,
    @Query('dateFrom')    dateFrom?: string,
    @Query('dateTo')      dateTo?: string,
    @Query('search')      search?: string,
    @Query('limit')       limit?: string,
    @Query('offset')      offset?: string,
  ) {
    return this.auditService.query({
      docType, action, performedBy, dateFrom, dateTo, search,
      limit:  limit  ? Number(limit)  : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
