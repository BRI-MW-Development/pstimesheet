import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { HodTeamsService } from './hod-teams.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('hod-teams')
export class HodTeamsController {
  constructor(private readonly hodTeamsService: HodTeamsService) {}

  @UseGuards(PermissionGuard)
  @RequirePermission('HOD_TEAMS', 'canRead')
  @Get()
  getAll() {
    return this.hodTeamsService.getAll();
  }

  @UseGuards(PermissionGuard)
  @RequirePermission('HOD_TEAMS', 'canRead')
  @Get('my-team')
  getMyTeam(@Req() req: any) {
    const hodCode = req?.currentUser?.employeeCode ?? '';
    return this.hodTeamsService.getTeamByHod(hodCode);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission('HOD_TEAMS', 'canRead')
  @Get(':hodCode')
  getTeam(@Param('hodCode') hodCode: string) {
    return this.hodTeamsService.getTeamByHod(hodCode);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission('HOD_TEAMS', 'canWrite')
  @Post()
  addMember(@Body() body: { hodCode: string; employeeCode: string }) {
    return this.hodTeamsService.addMember(body.hodCode, body.employeeCode);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission('HOD_TEAMS', 'canWrite')
  @Delete(':hodCode/:employeeCode')
  removeMember(
    @Param('hodCode') hodCode: string,
    @Param('employeeCode') employeeCode: string,
  ) {
    return this.hodTeamsService.removeMember(hodCode, employeeCode);
  }
}
