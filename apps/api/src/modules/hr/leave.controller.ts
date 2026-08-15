import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LeaveRequestStatus } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateLeaveRequestDto, ReviewLeaveRequestDto } from './dto/leave-request.dto';
import { EmployeesService } from './employees.service';
import { LeaveService } from './leave.service';

// Self-service — see MyAttendanceController for the same "not role-gated,
// resolves own Employee via userId" pattern.
@UseGuards(JwtAuthGuard)
@Controller('hr/me/leave-requests')
export class MyLeaveController {
  constructor(
    private readonly leave: LeaveService,
    private readonly employees: EmployeesService,
  ) {}

  @Get()
  async list(@CurrentUser() user: { userId: string }) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.leave.listForEmployee(employee.id);
  }

  @Get('balance')
  async balance(@CurrentUser() user: { userId: string }, @Query('year') year?: string) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.leave.balance(employee.id, year ? parseInt(year, 10) : undefined);
  }

  @Post()
  async create(@CurrentUser() user: { userId: string }, @Body() dto: CreateLeaveRequestDto) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.leave.create(employee.id, dto);
  }

  @Delete(':id')
  async cancel(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.leave.cancel(employee.id, id);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'HR_MANAGER')
@Controller('hr/leave-requests')
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get()
  list(@Query('status') status?: LeaveRequestStatus, @Query('employeeId') employeeId?: string) {
    return this.leave.listForAdmin({ status, employeeId });
  }

  @Patch(':id')
  review(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: ReviewLeaveRequestDto) {
    return this.leave.review(id, user.userId, dto);
  }
}
