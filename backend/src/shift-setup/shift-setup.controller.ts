import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { CreateShiftDto } from './dto/create-shift.dto';
import type { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftSetupService } from './shift-setup.service';

@Controller('system-settings/shifts')
export class ShiftSetupController {
  constructor(private readonly shiftSetupService: ShiftSetupService) {}

  @Get()
  findAll() {
    return this.shiftSetupService.findAll();
  }

  @Get(':shiftCode')
  findOne(@Param('shiftCode') shiftCode: string) {
    return this.shiftSetupService.findOne(shiftCode);
  }

  @Post()
  create(@Body() payload: CreateShiftDto) {
    return this.shiftSetupService.create(payload);
  }

  @Patch(':shiftCode')
  update(@Param('shiftCode') shiftCode: string, @Body() payload: UpdateShiftDto) {
    return this.shiftSetupService.update(shiftCode, payload);
  }

  @Delete(':shiftCode')
  remove(@Param('shiftCode') shiftCode: string) {
    return this.shiftSetupService.remove(shiftCode);
  }
}
