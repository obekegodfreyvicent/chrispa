import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveRequest, LeaveRequestStatus, LeaveType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLeaveRequestDto, ReviewLeaveRequestDto } from './dto/leave-request.dto';

function daysInclusive(start: Date, end: Date) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / MS_PER_DAY) + 1;
}

function withDays<T extends { startDate: Date; endDate: Date }>(entry: T) {
  return { ...entry, daysRequested: daysInclusive(entry.startDate, entry.endDate) };
}

// HR Phase 2 — Leave and Absence Tracking. Balance is computed on read (not
// a stored/denormalized counter) from approved ANNUAL requests in the target
// year vs Employee.annualLeaveDaysPerYear — it's surfaced to inform the
// approve/reject decision, not hard-enforced: HR can still approve past it
// (unpaid extension, policy exception, etc.) — see docs/SRS.md §18.2.
@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  async create(employeeId: string, dto: CreateLeaveRequestDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('End date must be on or after the start date.');
    }
    const created = await this.prisma.leaveRequest.create({
      data: { employeeId, type: dto.type, startDate, endDate, reason: dto.reason },
    });
    return withDays(created);
  }

  async listForEmployee(employeeId: string) {
    const requests = await this.prisma.leaveRequest.findMany({ where: { employeeId }, orderBy: { createdAt: 'desc' } });
    return requests.map(withDays);
  }

  async cancel(employeeId: string, id: string) {
    const existing = await this.prisma.leaveRequest.findFirst({ where: { id, employeeId } });
    if (!existing) throw new NotFoundException('Leave request not found');
    if (existing.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled.');
    }
    const updated = await this.prisma.leaveRequest.update({ where: { id }, data: { status: LeaveRequestStatus.CANCELLED } });
    return withDays(updated);
  }

  async balance(employeeId: string, year?: number) {
    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const targetYear = year ?? new Date().getFullYear();
    const approved = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        type: LeaveType.ANNUAL,
        status: LeaveRequestStatus.APPROVED,
        startDate: { gte: new Date(Date.UTC(targetYear, 0, 1)), lte: new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59)) },
      },
    });
    const used = approved.reduce((sum, r) => sum + daysInclusive(r.startDate, r.endDate), 0);
    return { year: targetYear, allocated: employee.annualLeaveDaysPerYear, used, remaining: employee.annualLeaveDaysPerYear - used };
  }

  async listForAdmin(params: { status?: LeaveRequestStatus; employeeId?: string }) {
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      },
      include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map(withDays);
  }

  async review(id: string, reviewerUserId: string, dto: ReviewLeaveRequestDto): Promise<LeaveRequest & { daysRequested: number }> {
    const existing = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Leave request not found');
    if (existing.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been reviewed.');
    }
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: dto.status, reviewNotes: dto.reviewNotes, reviewedByUserId: reviewerUserId },
    });
    return withDays(updated);
  }
}
