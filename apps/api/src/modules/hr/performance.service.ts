import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateFeedbackDto, CreateGoalDto, CreateReviewDto, UpdateGoalDto, UpdateReviewDto } from './dto/performance.dto';

// HR Phase 3 — Performance Tracking. Authorization is deliberately not a
// plain @Roles() check: OWNER/HR_MANAGER can manage anyone's performance
// records, but so can the target employee's own manager (Employee.managerId)
// — a real manager should be able to set goals/give feedback/write reviews
// for their direct reports without needing an HR-level role. Resolved here,
// not in a guard, because it depends on the *target* employee, not just the
// caller.
@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCanManage(callerUserId: string, callerRole: string, targetEmployeeId: string) {
    if (callerRole === 'OWNER' || callerRole === 'HR_MANAGER') return;
    const caller = await this.prisma.employee.findUnique({ where: { userId: callerUserId } });
    const target = await this.prisma.employee.findUnique({ where: { id: targetEmployeeId } });
    if (!target) throw new NotFoundException('Employee not found');
    if (!caller || target.managerId !== caller.id) {
      throw new ForbiddenException('You can only manage performance records for your direct reports.');
    }
  }

  // ---------- Goals ----------

  async createGoal(callerUserId: string, callerRole: string, employeeId: string, dto: CreateGoalDto) {
    await this.assertCanManage(callerUserId, callerRole, employeeId);
    return this.prisma.performanceGoal.create({
      data: {
        employeeId,
        title: dto.title,
        description: dto.description,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        createdByUserId: callerUserId,
      },
    });
  }

  listGoals(employeeId: string) {
    return this.prisma.performanceGoal.findMany({ where: { employeeId }, orderBy: { createdAt: 'desc' } });
  }

  async updateGoal(callerUserId: string, callerRole: string, goalId: string, dto: UpdateGoalDto) {
    const goal = await this.prisma.performanceGoal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Goal not found');
    await this.assertCanManage(callerUserId, callerRole, goal.employeeId);
    return this.prisma.performanceGoal.update({
      where: { id: goalId },
      data: { ...dto, targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined },
    });
  }

  async removeGoal(callerUserId: string, callerRole: string, goalId: string) {
    const goal = await this.prisma.performanceGoal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Goal not found');
    await this.assertCanManage(callerUserId, callerRole, goal.employeeId);
    await this.prisma.performanceGoal.delete({ where: { id: goalId } });
    return { deleted: true };
  }

  // ---------- Feedback ----------

  async giveFeedback(callerUserId: string, callerRole: string, employeeId: string, dto: CreateFeedbackDto) {
    await this.assertCanManage(callerUserId, callerRole, employeeId);
    return this.prisma.performanceFeedback.create({
      data: { employeeId, givenByUserId: callerUserId, note: dto.note },
    });
  }

  listFeedback(employeeId: string) {
    return this.prisma.performanceFeedback.findMany({
      where: { employeeId },
      include: { givenBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------- Reviews ----------

  async createReview(callerUserId: string, callerRole: string, employeeId: string, dto: CreateReviewDto) {
    await this.assertCanManage(callerUserId, callerRole, employeeId);
    return this.prisma.performanceReview.create({
      data: {
        employeeId,
        reviewerUserId: callerUserId,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        rating: dto.rating,
        strengths: dto.strengths,
        areasForImprovement: dto.areasForImprovement,
        overallComments: dto.overallComments,
      },
    });
  }

  listReviews(employeeId: string) {
    return this.prisma.performanceReview.findMany({ where: { employeeId }, orderBy: { periodStart: 'desc' } });
  }

  async updateReview(callerUserId: string, callerRole: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    await this.assertCanManage(callerUserId, callerRole, review.employeeId);
    if (review.status !== ReviewStatus.DRAFT) {
      throw new BadRequestException('Only draft reviews can be edited.');
    }
    return this.prisma.performanceReview.update({
      where: { id: reviewId },
      data: {
        ...dto,
        periodStart: dto.periodStart ? new Date(dto.periodStart) : undefined,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : undefined,
      },
    });
  }

  async submitReview(callerUserId: string, callerRole: string, reviewId: string) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    await this.assertCanManage(callerUserId, callerRole, review.employeeId);
    if (review.status !== ReviewStatus.DRAFT) {
      throw new BadRequestException('Only draft reviews can be submitted.');
    }
    return this.prisma.performanceReview.update({ where: { id: reviewId }, data: { status: ReviewStatus.SUBMITTED } });
  }

  // ---------- Self-service ----------

  async myPerformance(employeeId: string) {
    const [goals, feedback, reviews] = await Promise.all([
      this.listGoals(employeeId),
      this.listFeedback(employeeId),
      this.listReviews(employeeId),
    ]);
    return { goals, feedback, reviews };
  }

  async acknowledgeReview(employeeId: string, reviewId: string) {
    const review = await this.prisma.performanceReview.findFirst({ where: { id: reviewId, employeeId } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.status !== ReviewStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted reviews can be acknowledged.');
    }
    return this.prisma.performanceReview.update({
      where: { id: reviewId },
      data: { status: ReviewStatus.ACKNOWLEDGED, acknowledgedAt: new Date() },
    });
  }
}
