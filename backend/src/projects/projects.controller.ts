import { UseGuards, Controller, Get, Query } from '@nestjs/common';
import type { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { ProjectsService } from './projects.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @UseGuards(PermissionGuard)
  @RequirePermission('PROJECTS', 'canRead')
  @Get()
  async list(@Query() query: ListProjectsQueryDto) {
    return this.projectsService.list(query);
  }
}
