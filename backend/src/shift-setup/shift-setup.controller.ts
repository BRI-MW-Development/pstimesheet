import { UseGuards, Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { CreateShiftDto } from './dto/create-shift.dto';
import type { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftSetupService } from './shift-setup.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('system-settings/shifts')
export class ShiftSetupController {
  constructor(private readonly shiftSetupService: ShiftSetupService) {}

  @UseGuards(PermissionGuard)
  @RequirePermission('SHIFTS', 'canRead')
  @Get()
  findAll() {
    return this.shiftSetupService.findAll();
  }

  @Get(':shiftCode')
  findOne(@Param('shiftCode') shiftCode: string) {
    return this.shiftSetupService.findOne(shiftCode);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission('SHIFTS', 'canCreate')
  @Post()
  create(@Body() payload: CreateShiftDto) {
    return this.shiftSetupService.create(payload);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission('SHIFTS', 'canWrite')
  @Patch(':shiftCode')
  update(@Param('shiftCode') shiftCode: string, @Body() payload: UpdateShiftDto) {
    return this.shiftSetupService.update(shiftCode, payload);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission('SHIFTS', 'canDelete')
  @Delete(':shiftCode')
  remove(@Param('shiftCode') shiftCode: string) {
    return this.shiftSetupService.remove(shiftCode);
  }
}
