import { Module } from '@nestjs/common';
import { HodTeamsController } from './hod-teams.controller';
import { HodTeamsService } from './hod-teams.service';

@Module({
  controllers: [HodTeamsController],
  providers: [HodTeamsService],
  exports: [HodTeamsService],
})
export class HodTeamsModule {}
