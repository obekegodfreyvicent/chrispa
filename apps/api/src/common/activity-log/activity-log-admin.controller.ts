import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityActorType } from '@prisma/client';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { ActivityLogService } from './activity-log.service';

// AL-FR-3 (docs/SRS.md §19): viewing surface for the unified activity log.
// OWNER-only — this feed can include cross-department detail (e.g. an HR
// record change alongside a product edit) that no single admin role should
// see just by virtue of their own write permissions, so it's scoped tighter
// than the modules it draws from (matching the precedent set by
// /admin/users, the other OWNER-only admin surface).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
@Controller('admin/activity-log')
export class ActivityLogAdminController {
  constructor(private readonly activityLog: ActivityLogService) {}

  @Get()
  list(
    @Query('actorType') actorType?: ActivityActorType,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.activityLog.query({
      actorType,
      action,
      entityType,
      actorUserId,
      departmentId,
      search,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('actions')
  actions() {
    return this.activityLog.distinctActions();
  }

  // Populates the admin UI's department filter dropdown.
  @Get('departments')
  departments() {
    return this.activityLog.listDepartments();
  }
}
