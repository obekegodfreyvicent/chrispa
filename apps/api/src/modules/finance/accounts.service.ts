import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAccountDto } from './dto/account.dto';

// FIN-FR-1: chart of accounts, per entity.
@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  list(entityId: string) {
    return this.prisma.account.findMany({
      where: { entityId },
      include: { counterpartyEntity: { select: { id: true, name: true, code: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async getById(id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async create(dto: CreateAccountDto) {
    if (dto.isIntercompany && !dto.counterpartyEntityId) {
      throw new BadRequestException('An intercompany account must name a counterpartyEntityId.');
    }
    return this.prisma.account.create({
      data: {
        entityId: dto.entityId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        parentAccountId: dto.parentAccountId,
        cashFlowCategory: dto.cashFlowCategory,
        isIntercompany: dto.isIntercompany ?? false,
        counterpartyEntityId: dto.counterpartyEntityId,
      },
    });
  }

  // Applies the same starter chart-of-accounts template to a new entity —
  // used at entity-creation time (see FinanceModule seed/onboarding flow)
  // so every entity in the group shares identical account codes, which is
  // what lets FinancialReportsService sum balances across entities by code
  // for consolidation without a separate mapping table (see the schema
  // comment on FinancialReportsService's consolidation method for why that's
  // a documented simplification, not a general-purpose solution).
  async applyStandardTemplate(entityId: string) {
    const template: Array<{ code: string; name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'; cashFlowCategory?: 'OPERATING' | 'INVESTING' | 'FINANCING' }> = [
      { code: '1000', name: 'Cash and Cash Equivalents', type: 'ASSET', cashFlowCategory: 'OPERATING' },
      { code: '1100', name: 'Accounts Receivable', type: 'ASSET', cashFlowCategory: 'OPERATING' },
      { code: '1200', name: 'Inventory', type: 'ASSET', cashFlowCategory: 'OPERATING' },
      { code: '1500', name: 'Property & Equipment', type: 'ASSET', cashFlowCategory: 'INVESTING' },
      { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', cashFlowCategory: 'OPERATING' },
      { code: '2100', name: 'Accrued Liabilities', type: 'LIABILITY', cashFlowCategory: 'OPERATING' },
      // MKT-FR-2: a single control account for what's owed to ALL vendors —
      // per-vendor detail lives in VendorPayout (the sub-ledger), the same
      // relationship a real "Accounts Payable — Vendors" control account has
      // to its AP sub-ledger, rather than one Account row per vendor.
      { code: '2250', name: 'Vendor Payables', type: 'LIABILITY', cashFlowCategory: 'OPERATING' },
      // TAX-FR-1: VAT collected from customers on ChrisPa's behalf, owed to
      // URA — a liability, never revenue, so it can't inflate the P&L.
      { code: '2300', name: 'VAT Payable', type: 'LIABILITY', cashFlowCategory: 'OPERATING' },
      // FIN-FR-8 (Revenue Recognition): cash already collected for an order
      // that hasn't been delivered yet — cleared to Sales Revenue only once
      // RevenueRecognitionService recognizes it at delivery. Not used for
      // Cash on Delivery, where payment and delivery coincide.
      { code: '2400', name: 'Deferred Revenue', type: 'LIABILITY', cashFlowCategory: 'OPERATING' },
      { code: '2500', name: 'Long-Term Debt', type: 'LIABILITY', cashFlowCategory: 'FINANCING' },
      { code: '3000', name: 'Share Capital', type: 'EQUITY', cashFlowCategory: 'FINANCING' },
      { code: '3900', name: 'Retained Earnings', type: 'EQUITY', cashFlowCategory: 'FINANCING' },
      { code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
      // MKT-FR-2: the platform's own cut of a vendor-owned item's sale —
      // recognized as ChrisPa's revenue instead of the item's full price
      // (the "net"/agent method, correct for a marketplace acting as agent
      // rather than principal — see RevenueRecognitionService).
      { code: '4800', name: 'Commission Income', type: 'REVENUE' },
      { code: '4900', name: 'Management Fee Income', type: 'REVENUE' },
      { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
      { code: '5100', name: 'Operating Expenses', type: 'EXPENSE' },
      // Named sub-categories of Operating Expenses for Expense Tracking
      // (docs/SRS.md §21 FIN-FR-9) — kept as separate accounts (not a tag on
      // 5100) so each has its own real, independently reportable balance.
      { code: '5101', name: 'Server & Hosting Costs', type: 'EXPENSE' },
      { code: '5102', name: 'Software Licenses', type: 'EXPENSE' },
      { code: '5103', name: 'Marketing & Advertising', type: 'EXPENSE' },
      { code: '5200', name: 'Management Fee Expense', type: 'EXPENSE' },
      { code: '5300', name: 'Foreign Exchange Gain/Loss', type: 'EXPENSE' },
      // PAY-FR-4: gateway processing fees and chargeback fees — kept
      // separate from Operating Expenses so "how much did payment
      // processing cost us" is its own directly reportable figure.
      { code: '5400', name: 'Payment Processing Fees', type: 'EXPENSE' },
    ];
    await this.prisma.account.createMany({
      data: template.map((t) => ({ entityId, ...t })),
      skipDuplicates: true,
    });
  }
}
