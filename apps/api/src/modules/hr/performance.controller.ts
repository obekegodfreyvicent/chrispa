import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmployeesService } from './employees.service';
import { CreateFeedbackDto, CreateGoalDto, CreateReviewDto, UpdateGoalDto, UpdateReviewDto } from './dto/performance.dto';
import { PerformanceService } from './performance.service';

type CurrentUserShape = { userId: string; role: string };

// Not role-gated at the controller level — PerformanceService.assertCanManage()
// allows OWNER/HR_MANAGER *or* the target employee's own manager. See the
// comment atop performance.service.ts.
@UseGuards(JwtAuthGuard)
@Controller('hr')
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  @Post('employees/:employeeId/goals')
  createGoal(@CurrentUser() user: CurrentUserShape, @Param('employeeId') employeeId: string, @Body() dto: CreateGoalDto) {
    return this.performance.createGoal(user.userId, user.role, employeeId, dto);
  }

  @Get('employees/:employeeId/goals')
  listGoals(@Param('employeeId') employeeId: string) {
    return this.performance.listGoals(employeeId);
  }

  @Patch('goals/:id')
  updateGoal(@CurrentUser() user: CurrentUserShape, @Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.performance.updateGoal(user.userId, user.role, id, dto);
  }

  @Delete('goals/:id')
  removeGoal(@CurrentUser() user: CurrentUserShape, @Param('id') id: string) {
    return this.performance.removeGoal(user.userId, user.role, id);
  }

  @Post('employees/:employeeId/feedback')
  giveFeedback(@CurrentUser() user: CurrentUserShape, @Param('employeeId') employeeId: string, @Body() dto: CreateFeedbackDto) {
    return this.performance.giveFeedback(user.userId, user.role, employeeId, dto);
  }

  @Get('employees/:employeeId/feedback')
  listFeedback(@Param('employeeId') employeeId: string) {
    return this.performance.listFeedback(employeeId);
  }

  @Post('employees/:employeeId/reviews')
  createReview(@CurrentUser() user: CurrentUserShape, @Param('employeeId') employeeId: string, @Body() dto: CreateReviewDto) {
    return this.performance.createReview(user.userId, user.role, employeeId, dto);
  }

  @Get('employees/:employeeId/reviews')
  listReviews(@Param('employeeId') employeeId: string) {
    return this.performance.listReviews(employeeId);
  }

  @Patch('reviews/:id')
  updateReview(@CurrentUser() user: CurrentUserShape, @Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.performance.updateReview(user.userId, user.role, id, dto);
  }

  @Post('reviews/:id/submit')
  submitReview(@CurrentUser() user: CurrentUserShape, @Param('id') id: string) {
    return this.performance.submitReview(user.userId, user.role, id);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('hr/me')
export class MyPerformanceController {
  constructor(
    private readonly performance: PerformanceService,
    private readonly employees: EmployeesService,
  ) {}

  @Get('performance')
  async myPerformance(@CurrentUser() user: { userId: string }) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.performance.myPerformance(employee.id);
  }

  @Post('reviews/:id/acknowledge')
  async acknowledgeReview(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    const employee = await this.employees.getByUserId(user.userId);
    return this.performance.acknowledgeReview(employee.id, id);
  }
}
