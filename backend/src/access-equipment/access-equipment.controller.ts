import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { AccessEquipmentService } from './access-equipment.service';

@Controller('access-equipment')
export class AccessEquipmentController {
  constructor(private readonly accessEquipmentService: AccessEquipmentService) {}

  @Get()
  list() { return this.accessEquipmentService.list(); }

  @Post()
  @HttpCode(201)
  async create(@Body() body: any) {
    try {
      return await this.accessEquipmentService.create(body);
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Create failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':equipmentId')
  async update(@Param('equipmentId') equipmentId: string, @Body() body: any) {
    try {
      return await this.accessEquipmentService.update(equipmentId, body);
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Update failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':equipmentId')
  async remove(@Param('equipmentId') equipmentId: string) {
    try {
      return await this.accessEquipmentService.remove(equipmentId);
    } catch (err) {
      throw new HttpException({ message: err?.message || 'Delete failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
