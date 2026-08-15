import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// HR Phase 2 — Time & Attendance. Web/app clock-in only, per user decision:
// no biometric scanner/vendor SDK exists to integrate with (AttendanceSource
// enum has a single WEB value, extensible later for a real device).
@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async clockIn(employeeId: string) {
    const open = await this.prisma.timeEntry.findFirst({ where: { employeeId, clockOut: null } });
    if (open) {
      throw new BadRequestException(`Already clocked in since ${open.clockIn.toISOString()} — clock out first.`);
    }
    return this.prisma.timeEntry.create({ data: { employeeId, clockIn: new Date() } });
  }

  async clockOut(employeeId: string) {
    const open = await this.prisma.timeEntry.findFirst({ where: { employeeId, clockOut: null }, orderBy: { clockIn: 'desc' } });
    if (!open) {
      throw new BadRequestException('Not currently clocked in.');
    }
    return this.prisma.timeEntry.update({ where: { id: open.id }, data: { clockOut: new Date() } });
  }

  listForEmployee(employeeId: string) {
    return this.prisma.timeEntry.findMany({ where: { employeeId }, orderBy: { clockIn: 'desc' }, take: 50 });
  }

  async listForAdmin(params: { employeeId?: string; from?: string; to?: string }) {
    const { employeeId, from, to } = params;
    return this.prisma.timeEntry.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(from || to
          ? {
              clockIn: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { clockIn: 'desc' },
      take: 200,
    });
  }
}
