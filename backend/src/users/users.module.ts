import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { EmailSettingsModule } from '../email-settings/email-settings.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PermissionGuard } from '../auth/permission.guard';

// PermissionGuard is provided locally — DEV_SQL_POOL comes from the global DatabaseModule,
// so no AuthModule import is needed (which would create a circular dependency).
@Module({ imports: [AuditModule, EmailModule, EmailSettingsModule], controllers: [UsersController], providers: [UsersService, PermissionGuard], exports: [UsersService] })
export class UsersModule {}
