import { Controller, Get, Query } from '@nestjs/common';
import type { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async list(@Query() query: ListProjectsQueryDto) {
    return this.projectsService.list(query);
  }
}
