import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ShiftSwapStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateShiftDto, CreateSwapRequestDto, ReviewSwapRequestDto, UpdateShiftDto } from './dto/shift.dto';

const EMPLOYEE_SUMMARY = { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } as const;

// HR Phase 2 — Shift Scheduling. Shifts are hard-deletable (unlike Employee/
// Order records) — a roster entry isn't a compliance record, just a plan.
@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateShiftDto) {
    if (new Date(dto.endAt) <= new Date(dto.startAt)) {
      throw new BadRequestException('Shift end time must be after the start time.');
    }
    return this.prisma.shift.create({
      data: { employeeId: dto.employeeId, startAt: new Date(dto.startAt), endAt: new Date(dto.endAt), role: dto.role, notes: dto.notes },
    });
  }

  async update(id: string, dto: UpdateShiftDto) {
    const existing = await this.prisma.shift.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Shift not found');
    return this.prisma.shift.update({
      where: { id },
      data: {
        ...dto,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.shift.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Shift not found');
    await this.prisma.shift.delete({ where: { id } });
    return { deleted: true };
  }

  listForAdmin(params: { employeeId?: string; from?: string; to?: string }) {
    const { employeeId, from, to } = params;
    return this.prisma.shift.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(from || to
          ? { startAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      include: { employee: EMPLOYEE_SUMMARY },
      orderBy: { startAt: 'asc' },
    });
  }

  listForEmployee(employeeId: string) {
    return this.prisma.shift.findMany({
      where: { employeeId },
      orderBy: { startAt: 'asc' },
    });
  }

  async requestSwap(shiftId: string, requestedByEmployeeId: string, dto: CreateSwapRequestDto) {
    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.employeeId !== requestedByEmployeeId) {
      throw new ForbiddenException("You can only request a swap for your own shift.");
    }
    if (dto.coverEmployeeId === requestedByEmployeeId) {
      throw new BadRequestException("You can't swap a shift with yourself.");
    }
    return this.prisma.shiftSwapRequest.create({
      data: { shiftId, requestedByEmployeeId, coverEmployeeId: dto.coverEmployeeId, reason: dto.reason },
    });
  }

  listSwapRequestsForEmployee(employeeId: string) {
    return this.prisma.shiftSwapRequest.findMany({
      where: { OR: [{ requestedByEmployeeId: employeeId }, { coverEmployeeId: employeeId }] },
      include: { shift: true, requestedBy: EMPLOYEE_SUMMARY, coverEmployee: EMPLOYEE_SUMMARY },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelSwapRequest(employeeId: string, id: string) {
    const existing = await this.prisma.shiftSwapRequest.findFirst({ where: { id, requestedByEmployeeId: employeeId } });
    if (!existing) throw new NotFoundException('Swap request not found');
    if (existing.status !== ShiftSwapStatus.PENDING) {
      throw new BadRequestException('Only pending swap requests can be cancelled.');
    }
    return this.prisma.shiftSwapRequest.update({ where: { id }, data: { status: ShiftSwapStatus.CANCELLED } });
  }

  listSwapRequestsForAdmin(status?: ShiftSwapStatus) {
    return this.prisma.shiftSwapRequest.findMany({
      where: status ? { status } : {},
      include: { shift: true, requestedBy: EMPLOYEE_SUMMARY, coverEmployee: EMPLOYEE_SUMMARY },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewSwapRequest(id: string, reviewerUserId: string, dto: ReviewSwapRequestDto) {
    const existing = await this.prisma.shiftSwapRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Swap request not found');
    if (existing.status !== ShiftSwapStatus.PENDING) {
      throw new BadRequestException('This swap request has already been reviewed.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.shiftSwapRequest.update({
        where: { id },
        data: { status: dto.status, reviewedByUserId: reviewerUserId },
      });
      if (dto.status === 'APPROVED') {
        await tx.shift.update({ where: { id: existing.shiftId }, data: { employeeId: existing.coverEmployeeId } });
      }
      return updated;
    });
  }
}
