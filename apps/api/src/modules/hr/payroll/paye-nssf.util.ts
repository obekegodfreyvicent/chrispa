// HR Phase 4 — Payroll. Uganda resident-individual monthly PAYE bands and
// NSSF contribution rates, per the currently-published URA/NSSF rules at the
// time this was written. These are real, financially/legally consequential
// figures — if the published bands or rates ever change, or before this is
// ever used to run a real payroll (as opposed to demo/dev data), an
// accountant/tax advisor must sign off on the numbers below. See
// docs/SRS.md §18.4.
//
// This module deliberately has no dependency on Prisma/Nest — it's pure
// arithmetic so it can be unit-tested and reasoned about in isolation from
// the rest of the payroll pipeline.

// Monthly chargeable-income bands (URA, resident individuals — employment
// income). Each band's rate applies only to the slice of income that falls
// within it (marginal, not flat), computed cumulatively rather than from a
// pre-baked "base tax" constant to avoid transcription errors in that
// constant.
const PAYE_BANDS = [
  { upTo: 235_000, rate: 0 },
  { upTo: 335_000, rate: 0.1 },
  { upTo: 410_000, rate: 0.2 },
  { upTo: 10_000_000, rate: 0.3 },
] as const;

// Individuals with monthly chargeable income above UGX 10,000,000 pay an
// additional 10% surcharge on the amount above that threshold, on top of
// the 30% top-band rate above.
const HIGH_INCOME_SURCHARGE_THRESHOLD = 10_000_000;
const HIGH_INCOME_SURCHARGE_RATE = 0.1;

export function calculatePaye(monthlyGrossUgx: number): number {
  if (monthlyGrossUgx <= 0) return 0;

  let tax = 0;
  let lowerBound = 0;
  for (const band of PAYE_BANDS) {
    if (monthlyGrossUgx <= lowerBound) break;
    const taxableInBand = Math.min(monthlyGrossUgx, band.upTo) - lowerBound;
    tax += taxableInBand * band.rate;
    lowerBound = band.upTo;
  }

  // Anything above the last defined band continues at the top band's rate.
  if (monthlyGrossUgx > lowerBound) {
    const topRate = PAYE_BANDS[PAYE_BANDS.length - 1].rate;
    tax += (monthlyGrossUgx - lowerBound) * topRate;
  }

  if (monthlyGrossUgx > HIGH_INCOME_SURCHARGE_THRESHOLD) {
    tax += (monthlyGrossUgx - HIGH_INCOME_SURCHARGE_THRESHOLD) * HIGH_INCOME_SURCHARGE_RATE;
  }

  return Math.round(tax);
}

// NSSF Act: 5% employee contribution (deducted from pay) + 10% employer
// contribution (a cost to the employer, not deducted from the employee) —
// both computed on gross pay. NSSF is not PAYE-deductible in Uganda (unlike
// some neighboring jurisdictions), so PAYE above is computed on the full
// gross, not gross-minus-NSSF.
const NSSF_EMPLOYEE_RATE = 0.05;
const NSSF_EMPLOYER_RATE = 0.1;

export function calculateNssf(monthlyGrossUgx: number): { employee: number; employer: number } {
  return {
    employee: Math.round(monthlyGrossUgx * NSSF_EMPLOYEE_RATE),
    employer: Math.round(monthlyGrossUgx * NSSF_EMPLOYER_RATE),
  };
}

export interface PayslipInputs {
  basicSalaryUgx: number;
  taxableAllowancesUgx?: number;
  nonTaxableAllowancesUgx?: number;
  overtimeUgx?: number;
  bonusUgx?: number;
  penaltyUgx?: number;
  advanceRepaymentUgx?: number;
}

export interface PayslipCalculation {
  basicSalaryUgx: number;
  taxableAllowancesUgx: number;
  nonTaxableAllowancesUgx: number;
  overtimeUgx: number;
  bonusUgx: number;
  grossPayUgx: number;
  payeTaxUgx: number;
  nssfEmployeeUgx: number;
  nssfEmployerUgx: number;
  penaltyUgx: number;
  advanceRepaymentUgx: number;
  netPayUgx: number;
}

// PAYE-chargeable income = basic + taxable allowances + overtime + bonus.
// Non-taxable allowances are added to gross/net pay without going through
// PAYE. NSSF is deliberately computed on basicSalaryUgx only, not the full
// gross — otherwise every bonus/allowance/overtime figure would silently
// change the statutory contribution amount, which needs its own sign-off
// separate from ordinary payroll adjustments (see the comment on
// Payslip.nssfEmployeeUgx in schema.prisma). Penalties and advance
// repayments are post-tax deductions straight off net pay.
export function computePayslip(inputs: PayslipInputs): PayslipCalculation {
  const basicSalaryUgx = inputs.basicSalaryUgx;
  const taxableAllowancesUgx = inputs.taxableAllowancesUgx ?? 0;
  const nonTaxableAllowancesUgx = inputs.nonTaxableAllowancesUgx ?? 0;
  const overtimeUgx = inputs.overtimeUgx ?? 0;
  const bonusUgx = inputs.bonusUgx ?? 0;
  const penaltyUgx = inputs.penaltyUgx ?? 0;
  const advanceRepaymentUgx = inputs.advanceRepaymentUgx ?? 0;

  const chargeableIncomeUgx = basicSalaryUgx + taxableAllowancesUgx + overtimeUgx + bonusUgx;
  const grossPayUgx = chargeableIncomeUgx + nonTaxableAllowancesUgx;
  const payeTaxUgx = calculatePaye(chargeableIncomeUgx);
  const nssf = calculateNssf(basicSalaryUgx);
  const netPayUgx = grossPayUgx - payeTaxUgx - nssf.employee - penaltyUgx - advanceRepaymentUgx;

  return {
    basicSalaryUgx,
    taxableAllowancesUgx,
    nonTaxableAllowancesUgx,
    overtimeUgx,
    bonusUgx,
    grossPayUgx,
    payeTaxUgx,
    nssfEmployeeUgx: nssf.employee,
    nssfEmployerUgx: nssf.employer,
    penaltyUgx,
    advanceRepaymentUgx,
    netPayUgx,
  };
}

// Hourly rate derived from monthly basic salary assuming a 26 working-day
// month (a common Ugandan payroll convention for pro-rating monthly pay —
// confirm against the employer's actual policy before real use).
const STANDARD_WORKING_DAYS_PER_MONTH = 26;

export function calculateOvertimePay(
  basicSalaryUgx: number,
  standardHoursPerDay: number,
  overtimeHours: number,
  overtimeRateMultiplier: number,
): number {
  if (overtimeHours <= 0) return 0;
  const hourlyRateUgx = basicSalaryUgx / (standardHoursPerDay * STANDARD_WORKING_DAYS_PER_MONTH);
  return Math.round(hourlyRateUgx * overtimeRateMultiplier * overtimeHours);
}

// Month-granularity proration for the 13th-month cheque: counts each
// calendar month in `year` where the employee was employed for any part of
// it, between hireDate and terminationDate (or year-end if still employed).
// A day-level proration would be more precise but isn't worth the added
// complexity for a discretionary, non-statutory benefit — flagged here in
// case that judgment call needs revisiting.
export function monthsEmployedInYear(hireDate: Date, terminationDate: Date | null, year: number): number {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));

  const start = hireDate > yearStart ? hireDate : yearStart;
  const end = terminationDate && terminationDate < yearEnd ? terminationDate : yearEnd;
  if (start > end) return 0;

  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
  return Math.min(12, Math.max(0, months));
}
