import { UseGuards, Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @UseGuards(PermissionGuard)
  @RequirePermission('VEHICLES', 'canRead')
  @Get()
  findAll() { return this.vehiclesService.findAll(); }

  @Get('next-id')
  nextId() { return this.vehiclesService.nextVehicleId().then(vehicleId => ({ vehicleId })); }

  @Get(':vehicleId')
  findOne(@Param('vehicleId') vehicleId: string) { return this.vehiclesService.findOne(vehicleId); }

  @UseGuards(PermissionGuard)
  @RequirePermission('VEHICLES', 'canCreate')
  @Post()
  @HttpCode(201)
  async create(@Body() body: any) {
    try { return await this.vehiclesService.create(body); }
    catch (err) { throw new HttpException({ message: err?.message || 'Create failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @UseGuards(PermissionGuard)
  @RequirePermission('VEHICLES', 'canWrite')
  @Patch(':vehicleId')
  async update(@Param('vehicleId') vehicleId: string, @Body() body: any) {
    try { return await this.vehiclesService.update(vehicleId, body); }
    catch (err) { throw new HttpException({ message: err?.message || 'Update failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @UseGuards(PermissionGuard)
  @RequirePermission('VEHICLES', 'canDelete')
  @Delete(':vehicleId')
  async remove(@Param('vehicleId') vehicleId: string) {
    try { return await this.vehiclesService.remove(vehicleId); }
    catch (err) { throw new HttpException({ message: err?.message || 'Delete failed' }, err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
