import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateAllowanceDto, UpdateAllowanceDto } from '../dto/payroll.dto';
import { EmployeesService } from '../employees.service';
import { AllowancesService } from './allowances.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'HR_MANAGER')
@Controller('hr/employees')
export class AllowancesController {
  constructor(private readonly allowances: AllowancesService) {}

  @Get(':employeeId/allowances')
  list(@Param('employeeId') employeeId: string) {
    return this.allowances.listForEmployee(employeeId);
  }

  @Post(':employeeId/allowances')
  create(@Param('employeeId') employeeId: string, @Body() dto: CreateAllowanceDto) {
    return this.allowances.create(employeeId, dto);
  }

  @Patch('allowances/:id')
  update(@Param('id') id: string, @Body() dto: UpdateAllowanceDto) {
    return this.allowances.update(id, dto);
  }

  @Delete('allowances/:id')
  remove(@Param('id') id: string) {
    return this.allowances.remove(id);
  }
}

// Self-service — read-only, an employee sees only their own allowances.
@UseGuards(JwtAuthGuard)
@Controller('hr/me')
export class MyAllowancesController {
  constructor(
    private readonly allowances: AllowancesService,
    private readonly employees: EmployeesService,
  ) {}

  @Get('allowances')
  async myAllowances(@CurrentUser() user: { userId: string }) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.allowances.listForEmployee(employee.id);
  }
}
