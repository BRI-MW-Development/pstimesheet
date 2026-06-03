import { join } from 'path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccessEquipmentModule } from './access-equipment/access-equipment.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { ItemsModule } from './items/items.module';
import { TimesheetsModule } from './timesheets/timesheets.module';
import { MachineryModule } from './machinery/machinery.module';
import { ProjectsModule } from './projects/projects.module';
import { RolesModule } from './roles/roles.module';
import { ShiftSetupModule } from './shift-setup/shift-setup.module';
import { TaskTypesModule } from './task-types/task-types.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { WoCompleteModule } from './wo-complete/wo-complete.module';
import { EmailModule } from './email/email.module';
import { ApprovalSettingsModule } from './approval-settings/approval-settings.module';
import { EmailSettingsModule } from './email-settings/email-settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QcModule } from './qc/qc.module';
import { S3Module } from './s3/s3.module';
import { AnalyticsModule } from './analytics/analytics.module';

// Resolve frontend dist relative to the compiled backend output (dist/src → dist/dist)
const FRONTEND_DIST = join(__dirname, '..', '..', 'frontend', 'dist');

@Module({
  imports: [
    // Serve the React SPA in production. API routes (/api/*) take priority because
    // setGlobalPrefix('api') is applied before static serving in main.ts.
    ServeStaticModule.forRoot({
      rootPath: FRONTEND_DIST,
      serveStaticOptions: { index: false },
    }),
    DatabaseModule, EmailModule, AuditModule, AuthModule, ShiftSetupModule,
    VehiclesModule, WorkOrdersModule, WoCompleteModule, ProjectsModule,
    DepartmentsModule, MachineryModule, AccessEquipmentModule, TaskTypesModule,
    ItemsModule, EmployeesModule, TimesheetsModule, UsersModule, RolesModule,
    ApprovalSettingsModule, EmailSettingsModule, NotificationsModule, QcModule, S3Module, AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
