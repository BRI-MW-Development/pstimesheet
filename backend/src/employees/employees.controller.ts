import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import type { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  async list(@Query() query: ListEmployeesQueryDto) {
    return this.employeesService.list(query);
  }

  @Patch(':employeeNo')
  @HttpCode(200)
  async updateProfile(@Param('employeeNo') employeeNo: string, @Body() body: any) {
    try {
      await this.employeesService.updateProfile(employeeNo, body);
      return { ok: true };
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Update failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
