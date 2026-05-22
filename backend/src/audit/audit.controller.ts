import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

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
