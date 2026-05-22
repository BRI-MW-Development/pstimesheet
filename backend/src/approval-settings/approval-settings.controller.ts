import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApprovalSettingsService } from './approval-settings.service';

@Controller('approval-settings')
export class ApprovalSettingsController {
  constructor(private readonly svc: ApprovalSettingsService) {}

  @Get()
  list() { return this.svc.list(); }

  @Post()
  create(@Body() body: any) { return this.svc.upsert([body]); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.upsert([{ ...body, id: Number(id) }]);
  }

  @Put()
  upsertAll(@Body() body: { rows: any[] }) { return this.svc.upsert(body.rows ?? []); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(Number(id)); }
}
