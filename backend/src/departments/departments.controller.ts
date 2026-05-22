import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import type { ListDepartmentsQueryDto } from './dto/list-departments-query.dto';
import { DepartmentsService } from './departments.service';
import type { UpdateDepartmentProfileDto } from './departments.service';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async list(@Query() query: ListDepartmentsQueryDto) {
    return this.departmentsService.list(query);
  }

  @Put(':id/profile')
  async updateProfile(
    @Param('id') id: string,
    @Body() body: UpdateDepartmentProfileDto,
  ) {
    await this.departmentsService.updateProfile(Number(id), body);
    return { ok: true };
  }
}
