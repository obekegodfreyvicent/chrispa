import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AttendanceService } from './attendance.service';
import { EmployeesService } from './employees.service';

// Self-service: any authenticated staff user with a linked Employee record —
// not role-gated, unlike the rest of HR (see hr.module.ts).
@UseGuards(JwtAuthGuard)
@Controller('hr/me/attendance')
export class MyAttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly employees: EmployeesService,
  ) {}

  @Post('clock-in')
  async clockIn(@CurrentUser() user: { userId: string }) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.attendance.clockIn(employee.id);
  }

  @Post('clock-out')
  async clockOut(@CurrentUser() user: { userId: string }) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.attendance.clockOut(employee.id);
  }

  @Get()
  async list(@CurrentUser() user: { userId: string }) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.attendance.listForEmployee(employee.id);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'HR_MANAGER')
@Controller('hr/attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  list(@Query('employeeId') employeeId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.attendance.listForAdmin({ employeeId, from, to });
  }
}
