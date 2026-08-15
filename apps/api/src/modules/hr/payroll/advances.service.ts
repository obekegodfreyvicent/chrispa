import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SalaryAdvanceStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateAdvanceDto } from '../dto/payroll.dto';

// HR Phase 4 — cash advances against future salary. balanceRemainingUgx is
// only decremented when a payroll period carrying a repayment installment
// is *finalized* (see PayrollService.finalize()), not when it's merely
// run/re-run — see the comment on the SalaryAdvance model.
@Injectable()
export class AdvancesService {
  constructor(private readonly prisma: PrismaService) {}

  listForEmployee(employeeId: string) {
    return this.prisma.salaryAdvance.findMany({ where: { employeeId }, orderBy: { issuedAt: 'desc' } });
  }

  create(employeeId: string, approvedByUserId: string, dto: CreateAdvanceDto) {
    return this.prisma.salaryAdvance.create({
      data: {
        employeeId,
        approvedByUserId,
        principalUgx: dto.principalUgx,
        balanceRemainingUgx: dto.principalUgx,
        monthlyInstallmentUgx: dto.monthlyInstallmentUgx,
        note: dto.note,
      },
    });
  }

  async cancel(id: string) {
    const advance = await this.prisma.salaryAdvance.findUnique({ where: { id } });
    if (!advance) throw new NotFoundException('Advance not found');
    if (advance.status !== SalaryAdvanceStatus.ACTIVE) {
      throw new BadRequestException('Only an active advance can be cancelled.');
    }
    return this.prisma.salaryAdvance.update({ where: { id }, data: { status: SalaryAdvanceStatus.CANCELLED } });
  }

  // Used by PayrollService.run() to preview this period's due installments
  // without touching the ledger.
  listActiveForEmployee(employeeId: string) {
    return this.prisma.salaryAdvance.findMany({ where: { employeeId, status: SalaryAdvanceStatus.ACTIVE } });
  }
}
