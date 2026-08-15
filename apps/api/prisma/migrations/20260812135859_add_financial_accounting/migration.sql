-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "CashFlowCategory" AS ENUM ('OPERATING', 'INVESTING', 'FINANCING');

-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateTable
CREATE TABLE "LegalEntity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "functionalCurrency" TEXT NOT NULL,
    "parentEntityId" TEXT,
    "currentGroupFxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LegalEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSettings" (
    "id" TEXT NOT NULL,
    "reportingCurrency" TEXT NOT NULL DEFAULT 'UGX',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GroupSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "parentAccountId" TEXT,
    "cashFlowCategory" "CashFlowCategory",
    "isIntercompany" BOOLEAN NOT NULL DEFAULT false,
    "counterpartyEntityId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalPeriod" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "month" TIMESTAMPTZ(3) NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fiscalPeriodId" TEXT NOT NULL,
    "entryNumber" INTEGER NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'POSTED',
    "fxRateToGroupCurrency" DECIMAL(18,6) NOT NULL,
    "intercompanyGroupId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntryLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debitAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "memo" TEXT,

    CONSTRAINT "JournalEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalEntity_name_key" ON "LegalEntity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LegalEntity_code_key" ON "LegalEntity"("code");

-- CreateIndex
CREATE INDEX "LegalEntity_parentEntityId_idx" ON "LegalEntity"("parentEntityId");

-- CreateIndex
CREATE INDEX "Account_entityId_idx" ON "Account"("entityId");

-- CreateIndex
CREATE INDEX "Account_parentAccountId_idx" ON "Account"("parentAccountId");

-- CreateIndex
CREATE INDEX "Account_counterpartyEntityId_idx" ON "Account"("counterpartyEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_entityId_code_key" ON "Account"("entityId", "code");

-- CreateIndex
CREATE INDEX "FiscalPeriod_entityId_idx" ON "FiscalPeriod"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_entityId_month_key" ON "FiscalPeriod"("entityId", "month");

-- CreateIndex
CREATE INDEX "JournalEntry_entityId_date_idx" ON "JournalEntry"("entityId", "date");

-- CreateIndex
CREATE INDEX "JournalEntry_fiscalPeriodId_idx" ON "JournalEntry"("fiscalPeriodId");

-- CreateIndex
CREATE INDEX "JournalEntry_intercompanyGroupId_idx" ON "JournalEntry"("intercompanyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_entityId_entryNumber_key" ON "JournalEntry"("entityId", "entryNumber");

-- CreateIndex
CREATE INDEX "JournalEntryLine_journalEntryId_idx" ON "JournalEntryLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalEntryLine_accountId_idx" ON "JournalEntryLine"("accountId");

-- AddForeignKey
ALTER TABLE "LegalEntity" ADD CONSTRAINT "LegalEntity_parentEntityId_fkey" FOREIGN KEY ("parentEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "LegalEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_counterpartyEntityId_fkey" FOREIGN KEY ("counterpartyEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "LegalEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "LegalEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
