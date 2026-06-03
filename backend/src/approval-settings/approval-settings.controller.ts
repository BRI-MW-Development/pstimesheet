import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApprovalSettingsService } from './approval-settings.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('approval-settings')
export class ApprovalSettingsController {
  constructor(private readonly svc: ApprovalSettingsService) {}

  @UseGuards(PermissionGuard) @RequirePermission('SETTINGS', 'canRead')
  @Get()
  list() { return this.svc.list(); }

  @UseGuards(PermissionGuard) @RequirePermission('SETTINGS', 'canWrite')
  @Post()
  create(@Body() body: any) { return this.svc.upsert([body]); }

  @UseGuards(PermissionGuard) @RequirePermission('SETTINGS', 'canWrite')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.upsert([{ ...body, id: Number(id) }]);
  }

  @UseGuards(PermissionGuard) @RequirePermission('SETTINGS', 'canWrite')
  @Put()
  upsertAll(@Body() body: { rows: any[] }) { return this.svc.upsert(body.rows ?? []); }

  @UseGuards(PermissionGuard) @RequirePermission('SETTINGS', 'canDelete')
  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(Number(id)); }
}
