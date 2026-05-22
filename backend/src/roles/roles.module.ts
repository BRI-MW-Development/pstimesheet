import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { PermissionGuard } from '../auth/permission.guard';

// PermissionGuard provided locally — avoids circular dependency with AuthModule.
@Module({ imports: [AuditModule], controllers: [RolesController], providers: [RolesService, PermissionGuard] })
export class RolesModule {}
