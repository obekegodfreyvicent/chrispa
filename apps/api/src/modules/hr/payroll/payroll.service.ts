import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PayrollAdjustmentType, PayrollPeriodStatus, PayrollPeriodType, SalaryAdvanceStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateAdjustmentDto, CreatePayrollPeriodDto } from '../dto/payroll.dto';
import { calculateOvertimePay, computePayslip, monthsEmployedInYear } from './paye-nssf.util';

const DEDUCTION_TYPES: PayrollAdjustmentType[] = [PayrollAdjustmentType.PENALTY, PayrollAdjustmentType.OTHER_DEDUCTION];

// HR Phase 4 — Payroll. A PayrollPeriod moves DRAFT -> COMPUTED (repeatable —
// re-running replaces that period's payslips) -> FINALIZED (locked, no
// further re-runs). Payslips snapshot every figure at computation time so a
// later salary/allowance/adjustment change doesn't rewrite pay history.
@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeMonth(month: string): Date {
    const d = new Date(month);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  // Shared by run(), overtimePreview(), and runThirteenthMonth() — the same
  // "who gets paid" rule everywhere.
  private eligibleEmployees() {
    return this.prisma.employee.findMany({
      where: { employmentStatus: { in: ['ACTIVE', 'ON_LEAVE'] }, baseSalaryUgx: { not: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        baseSalaryUgx: true,
        standardHoursPerDay: true,
        overtimeRateMultiplier: true,
        hireDate: true,
        terminationDate: true,
      },
    });
  }

  async createPeriod(createdByUserId: string, dto: CreatePayrollPeriodDto) {
    const month = this.normalizeMonth(dto.month);
    const existing = await this.prisma.payrollPeriod.findUnique({
      where: { month_type: { month, type: PayrollPeriodType.REGULAR } },
    });
    if (existing) throw new BadRequestException('A payroll period already exists for that month.');
    return this.prisma.payrollPeriod.create({ data: { month, createdByUserId } });
  }

  listPeriods() {
    return this.prisma.payrollPeriod.findMany({
      orderBy: { month: 'desc' },
      include: { _count: { select: { payslips: true } } },
    });
  }

  async getPeriod(id: string) {
    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id },
      include: {
        payslips: {
          include: {
            employee: { select: { firstName: true, lastName: true, employeeNumber: true, jobTitle: true } },
            advanceRepayments: true,
          },
          orderBy: { employee: { firstName: 'asc' } },
        },
        adjustments: {
          include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!period) throw new NotFoundException('Payroll period not found');
    return period;
  }

  async run(periodId: string) {
    const period = await this.prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Payroll period not found');
    if (period.type !== PayrollPeriodType.REGULAR) {
      throw new BadRequestException('Use the 13th-month endpoint for THIRTEENTH_MONTH periods.');
    }
    if (period.status === PayrollPeriodStatus.FINALIZED) {
      throw new BadRequestException('This payroll period is finalized and can no longer be re-run.');
    }

    const employees = await this.eligibleEmployees();
    const employeeIds = employees.map((e) => e.id);

    const [allowances, adjustments, advances] = await Promise.all([
      this.prisma.employeeAllowance.findMany({ where: { employeeId: { in: employeeIds }, active: true } }),
      this.prisma.payrollAdjustment.findMany({ where: { periodId, employeeId: { in: employeeIds } } }),
      this.prisma.salaryAdvance.findMany({ where: { employeeId: { in: employeeIds }, status: SalaryAdvanceStatus.ACTIVE } }),
    ]);

    await this.prisma.$transaction(async (tx) => {
      // Cascades to PayslipAdvanceRepayment too — safe to recompute from
      // scratch since nothing is committed to the SalaryAdvance ledger
      // until finalize().
      await tx.payslip.deleteMany({ where: { periodId } });

      for (const employee of employees) {
        const empAllowances = allowances.filter((a) => a.employeeId === employee.id);
        const empAdjustments = adjustments.filter((a) => a.employeeId === employee.id);
        const sumAdj = (type: PayrollAdjustmentType, taxable?: boolean) =>
          empAdjustments
            .filter((a) => a.type === type && (taxable === undefined || a.taxable === taxable))
            .reduce((sum, a) => sum + a.amountUgx, 0);

        const taxableAllowancesUgx =
          empAllowances.filter((a) => a.taxable).reduce((sum, a) => sum + a.amountUgx, 0) + sumAdj(PayrollAdjustmentType.OTHER_EARNING, true);
        const nonTaxableAllowancesUgx =
          empAllowances.filter((a) => !a.taxable).reduce((sum, a) => sum + a.amountUgx, 0) +
          sumAdj(PayrollAdjustmentType.OTHER_EARNING, false);
        const overtimeUgx = sumAdj(PayrollAdjustmentType.OVERTIME);
        const bonusUgx = sumAdj(PayrollAdjustmentType.BONUS);
        const penaltyUgx = sumAdj(PayrollAdjustmentType.PENALTY) + sumAdj(PayrollAdjustmentType.OTHER_DEDUCTION);

        const empAdvances = advances.filter((a) => a.employeeId === employee.id);
        const repaymentSplits: { advanceId: string; amountUgx: number }[] = [];
        let advanceRepaymentUgx = 0;
        for (const advance of empAdvances) {
          const due = Math.min(advance.monthlyInstallmentUgx, advance.balanceRemainingUgx);
          if (due > 0) {
            repaymentSplits.push({ advanceId: advance.id, amountUgx: due });
            advanceRepaymentUgx += due;
          }
        }

        const calc = computePayslip({
          basicSalaryUgx: employee.baseSalaryUgx as number,
          taxableAllowancesUgx,
          nonTaxableAllowancesUgx,
          overtimeUgx,
          bonusUgx,
          penaltyUgx,
          advanceRepaymentUgx,
        });

        const payslip = await tx.payslip.create({ data: { periodId, employeeId: employee.id, ...calc } });

        if (repaymentSplits.length) {
          await tx.payslipAdvanceRepayment.createMany({
            data: repaymentSplits.map((r) => ({ payslipId: payslip.id, advanceId: r.advanceId, amountUgx: r.amountUgx })),
          });
        }
      }

      await tx.payrollPeriod.update({ where: { id: periodId }, data: { status: PayrollPeriodStatus.COMPUTED } });
    });

    return this.getPeriod(periodId);
  }

  async finalize(periodId: string) {
    const period = await this.prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Payroll period not found');
    if (period.status !== PayrollPeriodStatus.COMPUTED) {
      throw new BadRequestException('Run payroll for this period before finalizing it.');
    }

    await this.prisma.$transaction(async (tx) => {
      const repayments = await tx.payslipAdvanceRepayment.findMany({ where: { payslip: { periodId } } });
      for (const repayment of repayments) {
        const advance = await tx.salaryAdvance.findUnique({ where: { id: repayment.advanceId } });
        if (!advance) continue;
        const newBalance = Math.max(0, advance.balanceRemainingUgx - repayment.amountUgx);
        await tx.salaryAdvance.update({
          where: { id: repayment.advanceId },
          data: { balanceRemainingUgx: newBalance, status: newBalance === 0 ? SalaryAdvanceStatus.PAID_OFF : advance.status },
        });
      }
      await tx.payrollPeriod.update({
        where: { id: periodId },
        data: { status: PayrollPeriodStatus.FINALIZED, finalizedAt: new Date() },
      });
    });

    return this.getPeriod(periodId);
  }

  listForEmployee(employeeId: string) {
    return this.prisma.payslip.findMany({
      where: { employeeId },
      include: { period: { select: { month: true, type: true, status: true } } },
      orderBy: { period: { month: 'desc' } },
    });
  }

  // ---------- Adjustments (bonus, penalty, confirmed overtime, other) ----------

  async createAdjustment(periodId: string, createdByUserId: string, dto: CreateAdjustmentDto) {
    const period = await this.prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Payroll period not found');
    if (period.status === PayrollPeriodStatus.FINALIZED) {
      throw new BadRequestException('This payroll period is finalized — adjustments can no longer be added.');
    }
    return this.prisma.payrollAdjustment.create({
      data: {
        periodId,
        employeeId: dto.employeeId,
        type: dto.type,
        label: dto.label,
        amountUgx: dto.amountUgx,
        taxable: DEDUCTION_TYPES.includes(dto.type) ? true : (dto.taxable ?? true),
        createdByUserId,
      },
    });
  }

  async removeAdjustment(id: string) {
    const adjustment = await this.prisma.payrollAdjustment.findUnique({ where: { id }, include: { period: true } });
    if (!adjustment) throw new NotFoundException('Adjustment not found');
    if (adjustment.period.status === PayrollPeriodStatus.FINALIZED) {
      throw new BadRequestException('This payroll period is finalized — adjustments can no longer be removed.');
    }
    await this.prisma.payrollAdjustment.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------- Overtime: computed suggestion, HR confirms via an adjustment ----------

  async overtimePreview(periodId: string) {
    const period = await this.prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Payroll period not found');
    if (period.type !== PayrollPeriodType.REGULAR) {
      throw new BadRequestException('Overtime preview only applies to regular payroll periods.');
    }

    const employees = await this.eligibleEmployees();
    const monthStart = period.month;
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));

    const [entries, confirmedAdjustments] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: {
          employeeId: { in: employees.map((e) => e.id) },
          clockIn: { gte: monthStart, lt: monthEnd },
          clockOut: { not: null },
        },
      }),
      this.prisma.payrollAdjustment.findMany({ where: { periodId, type: PayrollAdjustmentType.OVERTIME } }),
    ]);

    return employees.map((employee) => {
      const empEntries = entries.filter((e) => e.employeeId === employee.id);
      const hoursByDay = new Map<string, number>();
      for (const entry of empEntries) {
        const day = entry.clockIn.toISOString().slice(0, 10);
        const hours = (entry.clockOut!.getTime() - entry.clockIn.getTime()) / 3_600_000;
        hoursByDay.set(day, (hoursByDay.get(day) ?? 0) + hours);
      }
      let computedOvertimeHours = 0;
      for (const workedHours of hoursByDay.values()) {
        computedOvertimeHours += Math.max(0, workedHours - employee.standardHoursPerDay);
      }
      computedOvertimeHours = Math.round(computedOvertimeHours * 100) / 100;

      const computedPayUgx = calculateOvertimePay(
        employee.baseSalaryUgx as number,
        employee.standardHoursPerDay,
        computedOvertimeHours,
        employee.overtimeRateMultiplier,
      );

      const empConfirmed = confirmedAdjustments.filter((a) => a.employeeId === employee.id);
      const confirmedPayUgx = empConfirmed.length ? empConfirmed.reduce((sum, a) => sum + a.amountUgx, 0) : null;

      return {
        employeeId: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        computedOvertimeHours,
        computedPayUgx,
        confirmedPayUgx,
      };
    });
  }

  // ---------- 13th month cheque ----------

  async runThirteenthMonth(year: number, createdByUserId: string) {
    const month = new Date(Date.UTC(year, 11, 1));
    let period = await this.prisma.payrollPeriod.findUnique({
      where: { month_type: { month, type: PayrollPeriodType.THIRTEENTH_MONTH } },
    });
    if (period && period.status === PayrollPeriodStatus.FINALIZED) {
      throw new BadRequestException('13th-month pay for this year is already finalized.');
    }
    if (!period) {
      period = await this.prisma.payrollPeriod.create({
        data: { month, type: PayrollPeriodType.THIRTEENTH_MONTH, createdByUserId },
      });
    }
    const periodId = period.id;

    const employees = await this.eligibleEmployees();

    await this.prisma.$transaction(async (tx) => {
      await tx.payslip.deleteMany({ where: { periodId } });
      for (const employee of employees) {
        const months = monthsEmployedInYear(employee.hireDate, employee.terminationDate, year);
        if (months === 0) continue;
        const proratedBasicUgx = Math.round(((employee.baseSalaryUgx as number) * months) / 12);
        const calc = computePayslip({ basicSalaryUgx: proratedBasicUgx });
        await tx.payslip.create({ data: { periodId, employeeId: employee.id, ...calc } });
      }
      await tx.payrollPeriod.update({ where: { id: periodId }, data: { status: PayrollPeriodStatus.COMPUTED } });
    });

    return this.getPeriod(periodId);
  }
}
