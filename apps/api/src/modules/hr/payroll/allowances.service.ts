import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateAllowanceDto, UpdateAllowanceDto } from '../dto/payroll.dto';

// HR Phase 4 — recurring per-employee allowances (housing, transport,
// lunch, etc.). Applied to every regular payroll run while active=true;
// see PayrollService.run().
@Injectable()
export class AllowancesService {
  constructor(private readonly prisma: PrismaService) {}

  listForEmployee(employeeId: string) {
    return this.prisma.employeeAllowance.findMany({ where: { employeeId }, orderBy: { createdAt: 'desc' } });
  }

  create(employeeId: string, dto: CreateAllowanceDto) {
    return this.prisma.employeeAllowance.create({
      data: { employeeId, type: dto.type, label: dto.label, amountUgx: dto.amountUgx, taxable: dto.taxable ?? true },
    });
  }

  async update(id: string, dto: UpdateAllowanceDto) {
    const existing = await this.prisma.employeeAllowance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Allowance not found');
    return this.prisma.employeeAllowance.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const existing = await this.prisma.employeeAllowance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Allowance not found');
    await this.prisma.employeeAllowance.delete({ where: { id } });
    return { deleted: true };
  }
}
