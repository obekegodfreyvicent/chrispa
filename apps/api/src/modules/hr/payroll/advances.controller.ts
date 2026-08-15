import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateAdvanceDto } from '../dto/payroll.dto';
import { EmployeesService } from '../employees.service';
import { AdvancesService } from './advances.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'HR_MANAGER')
@Controller('hr/employees/:employeeId/advances')
export class AdvancesController {
  constructor(private readonly advances: AdvancesService) {}

  @Get()
  list(@Param('employeeId') employeeId: string) {
    return this.advances.listForEmployee(employeeId);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Param('employeeId') employeeId: string, @Body() dto: CreateAdvanceDto) {
    return this.advances.create(employeeId, user.userId, dto);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'HR_MANAGER')
@Controller('hr/advances')
export class AdvanceActionsController {
  constructor(private readonly advances: AdvancesService) {}

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.advances.cancel(id);
  }
}

// Self-service — read-only, an employee sees only their own advances/balances.
@UseGuards(JwtAuthGuard)
@Controller('hr/me')
export class MyAdvancesController {
  constructor(
    private readonly advances: AdvancesService,
    private readonly employees: EmployeesService,
  ) {}

  @Get('advances')
  async myAdvances(@CurrentUser() user: { userId: string }) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.advances.listForEmployee(employee.id);
  }
}
