import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  findAll() { return this.vehiclesService.findAll(); }

  @Get('next-id')
  nextId() { return this.vehiclesService.nextVehicleId().then(vehicleId => ({ vehicleId })); }

  @Get(':vehicleId')
  findOne(@Param('vehicleId') vehicleId: string) { return this.vehiclesService.findOne(vehicleId); }

  @Post()
  @HttpCode(201)
  async create(@Body() body: any) {
    try { return await this.vehiclesService.create(body); }
    catch (err) { throw new HttpException({ message: err?.message || 'Create failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Patch(':vehicleId')
  async update(@Param('vehicleId') vehicleId: string, @Body() body: any) {
    try { return await this.vehiclesService.update(vehicleId, body); }
    catch (err) { throw new HttpException({ message: err?.message || 'Update failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Delete(':vehicleId')
  async remove(@Param('vehicleId') vehicleId: string) {
    try { return await this.vehiclesService.remove(vehicleId); }
    catch (err) { throw new HttpException({ message: err?.message || 'Delete failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
