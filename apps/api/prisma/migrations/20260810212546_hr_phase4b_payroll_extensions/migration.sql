-- CreateEnum
CREATE TYPE "PayrollPeriodType" AS ENUM ('REGULAR', 'THIRTEENTH_MONTH');

-- CreateEnum
CREATE TYPE "AllowanceType" AS ENUM ('HOUSING', 'TRANSPORT', 'LUNCH', 'MEDICAL', 'HARDSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "SalaryAdvanceStatus" AS ENUM ('ACTIVE', 'PAID_OFF', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('BONUS', 'PENALTY', 'OVERTIME', 'OTHER_EARNING', 'OTHER_DEDUCTION');

-- DropIndex
DROP INDEX "PayrollPeriod_month_key";

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "overtimeRateMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
ADD COLUMN     "standardHoursPerDay" INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "PayrollPeriod" ADD COLUMN     "type" "PayrollPeriodType" NOT NULL DEFAULT 'REGULAR';

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "advanceRepaymentUgx" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bonusUgx" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nonTaxableAllowancesUgx" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overtimeUgx" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "penaltyUgx" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxableAllowancesUgx" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EmployeeAllowance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "AllowanceType" NOT NULL DEFAULT 'OTHER',
    "label" TEXT,
    "amountUgx" INTEGER NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmployeeAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryAdvance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "principalUgx" INTEGER NOT NULL,
    "balanceRemainingUgx" INTEGER NOT NULL,
    "monthlyInstallmentUgx" INTEGER NOT NULL,
    "status" "SalaryAdvanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipAdvanceRepayment" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "amountUgx" INTEGER NOT NULL,

    CONSTRAINT "PayslipAdvanceRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "PayrollAdjustmentType" NOT NULL,
    "label" TEXT NOT NULL,
    "amountUgx" INTEGER NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeAllowance_employeeId_idx" ON "EmployeeAllowance"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryAdvance_employeeId_idx" ON "SalaryAdvance"("employeeId");

-- CreateIndex
CREATE INDEX "PayslipAdvanceRepayment_payslipId_idx" ON "PayslipAdvanceRepayment"("payslipId");

-- CreateIndex
CREATE INDEX "PayslipAdvanceRepayment_advanceId_idx" ON "PayslipAdvanceRepayment"("advanceId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_periodId_idx" ON "PayrollAdjustment"("periodId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_employeeId_idx" ON "PayrollAdjustment"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_month_type_key" ON "PayrollPeriod"("month", "type");

-- AddForeignKey
ALTER TABLE "EmployeeAllowance" ADD CONSTRAINT "EmployeeAllowance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipAdvanceRepayment" ADD CONSTRAINT "PayslipAdvanceRepayment_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipAdvanceRepayment" ADD CONSTRAINT "PayslipAdvanceRepayment_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "SalaryAdvance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

