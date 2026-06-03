import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
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

  @Post(':employeeNo/image')
  async uploadImage(
    @Param('employeeNo') employeeNo: string,
    @Body() body: { fileData: string; mimeType: string; fileName: string },
  ) {
    try {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];
      if (!body.mimeType || !allowed.includes(body.mimeType.toLowerCase()))
        throw new HttpException({ message: 'Only image files are accepted.' }, HttpStatus.BAD_REQUEST);
      if (!body.fileData?.startsWith('data:image/'))
        throw new HttpException({ message: 'Invalid image data.' }, HttpStatus.BAD_REQUEST);
      if (body.fileData.length > 14_000_000)
        throw new HttpException({ message: 'Image exceeds the 10 MB size limit.' }, HttpStatus.BAD_REQUEST);
      return await this.employeesService.uploadImage(employeeNo, body.fileData, body.mimeType, body.fileName);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException({ message: err?.message || 'Upload failed' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
