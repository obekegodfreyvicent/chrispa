import { Global, Module } from '@nestjs/common';
import { ActivityLogAdminController } from './activity-log-admin.controller';
import { ActivityLogService } from './activity-log.service';

// @Global so any module can inject ActivityLogService without adding this
// module to its own imports — same convenience pattern as PrismaModule,
// appropriate here since logging is a cross-cutting concern touched from
// auth, catalog, orders, checkout, profile, addresses, and HR.
@Global()
@Module({
  controllers: [ActivityLogAdminController],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
