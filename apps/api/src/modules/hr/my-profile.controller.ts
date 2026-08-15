import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { EmployeesService } from './employees.service';

// HR Phase 3 — Self-Service Portal (profile piece). Payslips aren't here —
// there's no payroll yet (Phase 4); leave balance is already covered by
// GET /hr/me/leave-requests/balance (Phase 2).
@UseGuards(JwtAuthGuard)
@Controller('hr/me/profile')
export class MyProfileController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  async get(@CurrentUser() user: { userId: string }) {
    return this.employees.getByUserId(user.userId);
  }

  @Patch()
  async update(@CurrentUser() user: { userId: string }, @Body() dto: UpdateMyProfileDto) {
    return this.employees.updateMyProfile(user.userId, dto);
  }
}
