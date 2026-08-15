import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ShiftSwapStatus } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateShiftDto, CreateSwapRequestDto, ReviewSwapRequestDto, UpdateShiftDto } from './dto/shift.dto';
import { EmployeesService } from './employees.service';
import { ShiftsService } from './shifts.service';

// Self-service — same pattern as MyAttendanceController/MyLeaveController.
@UseGuards(JwtAuthGuard)
@Controller('hr/me/shifts')
export class MyShiftsController {
  constructor(
    private readonly shifts: ShiftsService,
    private readonly employees: EmployeesService,
  ) {}

  @Get()
  async list(@CurrentUser() user: { userId: string }) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.shifts.listForEmployee(employee.id);
  }

  @Get('swap-requests')
  async listSwapRequests(@CurrentUser() user: { userId: string }) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.shifts.listSwapRequestsForEmployee(employee.id);
  }

  @Post(':shiftId/swap-requests')
  async requestSwap(@CurrentUser() user: { userId: string }, @Param('shiftId') shiftId: string, @Body() dto: CreateSwapRequestDto) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.shifts.requestSwap(shiftId, employee.id, dto);
  }

  @Delete('swap-requests/:id')
  async cancelSwapRequest(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.shifts.cancelSwapRequest(employee.id, id);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'HR_MANAGER')
@Controller('hr/shifts')
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get()
  list(@Query('employeeId') employeeId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.shifts.listForAdmin({ employeeId, from, to });
  }

  @Post()
  create(@Body() dto: CreateShiftDto) {
    return this.shifts.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateShiftDto) {
    return this.shifts.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.shifts.remove(id);
  }

  @Get('swap-requests')
  listSwapRequests(@Query('status') status?: ShiftSwapStatus) {
    return this.shifts.listSwapRequestsForAdmin(status);
  }

  @Patch('swap-requests/:id')
  reviewSwapRequest(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: ReviewSwapRequestDto) {
    return this.shifts.reviewSwapRequest(id, user.userId, dto);
  }
}
