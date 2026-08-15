import { Injectable } from '@nestjs/common';
import { GoalStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

// HR Phase 4 — HR Dashboards & Productivity Metrics. Read-only aggregation
// over data already collected by Phases 1-3; nothing here is a stored
// counter, everything is computed on read, same philosophy as
// LeaveService.balance() in Phase 2.
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const in30Days = new Date();
    in30Days.setUTCDate(in30Days.getUTCDate() + 30);

    const [
      headcountByStatus,
      headcountByDepartmentRaw,
      pendingLeaveRequests,
      openJobPostings,
      clockedInNow,
      expiringDocuments,
      goals,
    ] = await Promise.all([
      this.prisma.employee.groupBy({ by: ['employmentStatus'], _count: true }),
      this.prisma.department.findMany({
        select: { id: true, name: true, _count: { select: { employees: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.jobPosting.count({ where: { status: 'OPEN' } }),
      this.prisma.timeEntry.count({ where: { clockOut: null, clockIn: { gte: startOfToday } } }),
      this.prisma.employeeDocument.count({ where: { expiresAt: { gte: new Date(), lte: in30Days } } }),
      this.prisma.performanceGoal.groupBy({ by: ['status'], _count: true }),
    ]);

    const totalGoals = goals.reduce((sum, g) => sum + g._count, 0);
    const completedGoals = goals.find((g) => g.status === GoalStatus.COMPLETED)?._count ?? 0;

    return {
      headcountByStatus: headcountByStatus.map((h) => ({ status: h.employmentStatus, count: h._count })),
      totalHeadcount: headcountByStatus.reduce((sum, h) => sum + h._count, 0),
      headcountByDepartment: headcountByDepartmentRaw.map((d) => ({ id: d.id, name: d.name, count: d._count.employees })),
      pendingLeaveRequests,
      openJobPostings,
      clockedInNow,
      documentsExpiringSoon: expiringDocuments,
      goalCompletionRate: totalGoals === 0 ? null : Math.round((completedGoals / totalGoals) * 100),
      totalGoals,
      completedGoals,
    };
  }
}
