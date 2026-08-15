import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateAdjustmentDto, CreatePayrollPeriodDto } from '../dto/payroll.dto';
import { EmployeesService } from '../employees.service';
import { PayrollService } from './payroll.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'HR_MANAGER')
@Controller('hr/payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('periods')
  listPeriods() {
    return this.payroll.listPeriods();
  }

  @Post('periods')
  createPeriod(@CurrentUser() user: { userId: string }, @Body() dto: CreatePayrollPeriodDto) {
    return this.payroll.createPeriod(user.userId, dto);
  }

  @Get('periods/:id')
  getPeriod(@Param('id') id: string) {
    return this.payroll.getPeriod(id);
  }

  @Post('periods/:id/run')
  run(@Param('id') id: string) {
    return this.payroll.run(id);
  }

  @Post('periods/:id/finalize')
  finalize(@Param('id') id: string) {
    return this.payroll.finalize(id);
  }

  @Get('periods/:id/overtime-preview')
  overtimePreview(@Param('id') id: string) {
    return this.payroll.overtimePreview(id);
  }

  @Post('periods/:id/adjustments')
  createAdjustment(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: CreateAdjustmentDto) {
    return this.payroll.createAdjustment(id, user.userId, dto);
  }

  @Delete('adjustments/:id')
  removeAdjustment(@Param('id') id: string) {
    return this.payroll.removeAdjustment(id);
  }

  @Post('thirteenth-month/:year')
  runThirteenthMonth(@CurrentUser() user: { userId: string }, @Param('year', ParseIntPipe) year: number) {
    return this.payroll.runThirteenthMonth(year, user.userId);
  }
}

// Self-service — read-only, an employee sees only their own payslips.
@UseGuards(JwtAuthGuard)
@Controller('hr/me')
export class MyPayslipsController {
  constructor(
    private readonly payroll: PayrollService,
    private readonly employees: EmployeesService,
  ) {}

  @Get('payslips')
  async myPayslips(@CurrentUser() user: { userId: string }) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.payroll.listForEmployee(employee.id);
  }
}
