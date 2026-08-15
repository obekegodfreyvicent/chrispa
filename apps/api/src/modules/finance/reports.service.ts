import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, CashFlowCategory, Prisma } from '@prisma/client';
import { EntitiesService } from './entities.service';
import { JournalService } from './journal.service';
import { PrismaService } from '../../common/prisma/prisma.service';

interface ScopeParams {
  entityId?: string;
  consolidatedRootId?: string;
}

interface LineItem {
  code: string;
  name: string;
  balance: string; // Decimal serialized as string — never a JS float, for a financial figure.
}

const D = (v: Prisma.Decimal.Value = 0) => new Prisma.Decimal(v);

// FIN-FR-2/3/4 (docs/SRS.md §20): every statement is computed on read from
// posted JournalEntryLines — same "compute on read" philosophy as
// LeaveService.balance()/DashboardService.summary() elsewhere in this
// codebase, applied here because a stored/cached balance would drift the
// moment a later period's entry is posted or a period is reopened.
//
// Consolidation is a documented simplification, not a general-purpose
// multi-GAAP consolidation engine: it assumes every entity in scope shares
// the standard chart-of-accounts template (same codes — see
// AccountsService.applyStandardTemplate()), translates each entity's
// figures at its CURRENT spot rate (LegalEntity.currentGroupFxRate) rather
// than a rate snapshotted per historical period (the "closing rate" vs.
// "historical rate" distinction real consolidation accounting cares about),
// and eliminates intercompany balances/revenue by construction (every
// intercompany posting is created as a matched pair via IntercompanyService,
// so eliminating "everything flagged intercompany, or tagged with a shared
// intercompanyGroupId" is correct for full-group consolidation scope, but
// would need real counterparty-scope checking for a partial-subtree
// consolidation — not implemented). None of this replaces an accountant's
// review before real financial statements are filed or relied upon.
@Injectable()
export class FinancialReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entities: EntitiesService,
    private readonly journal: JournalService,
  ) {}

  private async resolveScope(scope: ScopeParams): Promise<{ entityIds: string[]; consolidated: boolean }> {
    if (scope.consolidatedRootId) {
      const entityIds = await this.entities.subtreeIds(scope.consolidatedRootId);
      return { entityIds, consolidated: entityIds.length > 1 };
    }
    if (scope.entityId) {
      const entity = await this.prisma.legalEntity.findUnique({ where: { id: scope.entityId } });
      if (!entity) throw new NotFoundException('Legal entity not found');
      return { entityIds: [scope.entityId], consolidated: false };
    }
    throw new NotFoundException('Provide either entityId or consolidatedRootId.');
  }

  // Every posted line for the entities in scope, in the date window, with
  // its account + owning entity attached — the one query every statement
  // below aggregates in memory from (fewer round trips than summing
  // per-account, and lets each statement apply its own grouping/elimination
  // rules over the same raw data).
  private async fetchLines(entityIds: string[], window: { asOf?: Date; from?: Date; to?: Date }) {
    return this.prisma.journalEntryLine.findMany({
      where: {
        account: { entityId: { in: entityIds } },
        journalEntry: {
          status: 'POSTED',
          ...(window.asOf ? { date: { lte: window.asOf } } : {}),
          ...(window.from || window.to
            ? { date: { ...(window.from ? { gte: window.from } : {}), ...(window.to ? { lte: window.to } : {}) } }
            : {}),
        },
      },
      include: {
        account: { include: { entity: true } },
        journalEntry: { select: { intercompanyGroupId: true } },
      },
    });
  }

  private fxRate(entity: { currentGroupFxRate: Prisma.Decimal }, consolidated: boolean): Prisma.Decimal {
    return consolidated ? entity.currentGroupFxRate : D(1);
  }

  async getBalanceSheet(scope: ScopeParams, asOf: Date) {
    const { entityIds, consolidated } = await this.resolveScope(scope);
    const lines = await this.fetchLines(entityIds, { asOf });

    const groups = new Map<string, { name: string; type: AccountType; isIntercompany: boolean; balance: Prisma.Decimal }>();
    for (const line of lines) {
      if (line.account.type === 'REVENUE' || line.account.type === 'EXPENSE') continue; // balance sheet only
      const key = `${line.account.code}::${line.account.name}`;
      const rate = this.fxRate(line.account.entity, consolidated);
      const movement = D(line.debitAmount).sub(D(line.creditAmount)).mul(rate);
      const g = groups.get(key) ?? { name: line.account.name, type: line.account.type, isIntercompany: line.account.isIntercompany, balance: D(0) };
      g.balance = g.balance.add(movement);
      groups.set(key, g);
    }

    const toSection = (type: AccountType, flipSign: boolean) =>
      [...groups.entries()]
        .filter(([, g]) => g.type === type)
        .map(([key, g]) => {
          const code = key.split('::')[0];
          const raw = flipSign ? g.balance.neg() : g.balance;
          return { code, name: g.name, balance: raw.toFixed(2), isIntercompany: g.isIntercompany };
        })
        .sort((a, b) => a.code.localeCompare(b.code));

    const assets = toSection('ASSET', false);
    const liabilities = toSection('LIABILITY', true);
    const equity = toSection('EQUITY', true);

    const interoEliminated = { receivables: D(0), payables: D(0) };
    let assetsAdj = assets;
    let liabilitiesAdj = liabilities;
    if (consolidated) {
      interoEliminated.receivables = assets.filter((a) => a.isIntercompany).reduce((s, a) => s.add(D(a.balance)), D(0));
      interoEliminated.payables = liabilities.filter((l) => l.isIntercompany).reduce((s, l) => s.add(D(l.balance)), D(0));
      assetsAdj = assets.filter((a) => !a.isIntercompany);
      liabilitiesAdj = liabilities.filter((l) => !l.isIntercompany);
    }

    // An interim balance sheet (i.e. any date that isn't a formal period
    // close) only balances once uncommitted current-period earnings are
    // folded into Equity — real accounting systems either run a closing
    // entry into Retained Earnings at year-end, or show a computed "Current
    // Period Earnings" line the rest of the year, which is what this does
    // (this codebase's minimum core doesn't implement a formal year-end
    // close). Cumulative from a fixed epoch rather than a specific fiscal
    // year start, since there's no fiscal-year-boundary concept yet either.
    const cumulativeIncome = await this.getIncomeStatement(scope, new Date('2000-01-01'), asOf);
    const currentPeriodEarnings = D(cumulativeIncome.netIncome);
    const equityWithEarnings = [...equity, { code: '3999', name: 'Current Period Earnings (Unaudited)', balance: currentPeriodEarnings.toFixed(2) }];

    const totalAssets = assetsAdj.reduce((s, a) => s.add(D(a.balance)), D(0));
    const totalLiabilities = liabilitiesAdj.reduce((s, l) => s.add(D(l.balance)), D(0));
    const totalEquity = equityWithEarnings.reduce((s, e) => s.add(D(e.balance)), D(0));

    return {
      asOf: asOf.toISOString(),
      consolidated,
      entityIds,
      assets: assetsAdj,
      totalAssets: totalAssets.toFixed(2),
      liabilities: liabilitiesAdj,
      totalLiabilities: totalLiabilities.toFixed(2),
      equity: equityWithEarnings,
      totalEquity: totalEquity.toFixed(2),
      totalLiabilitiesAndEquity: totalLiabilities.add(totalEquity).toFixed(2),
      balanced: totalAssets.eq(totalLiabilities.add(totalEquity)),
      // receivablesEliminated and payablesEliminated can differ by a few
      // cents even for a genuinely matched intercompany pair: each side's
      // local-currency amount is rounded to 2dp at posting time (see
      // IntercompanyService.localAmount()), so translating both back to
      // group currency for elimination doesn't cancel out perfectly — a
      // real, expected FX-rounding residual, not a data-integrity bug. It's
      // the reason `balanced` can read `false` by a fraction of a currency
      // unit on a consolidated statement; a real system would sweep this
      // into a dedicated FX-rounding/translation-adjustment account (5300
      // exists in the standard template for exactly this) — that automatic
      // sweep isn't implemented here.
      intercompanyEliminations: consolidated
        ? { receivablesEliminated: interoEliminated.receivables.toFixed(2), payablesEliminated: interoEliminated.payables.toFixed(2) }
        : null,
    };
  }

  async getIncomeStatement(scope: ScopeParams, from: Date, to: Date) {
    const { entityIds, consolidated } = await this.resolveScope(scope);
    const lines = await this.fetchLines(entityIds, { from, to });

    const groups = new Map<string, { name: string; type: AccountType; balance: Prisma.Decimal; intercompany: boolean }>();
    for (const line of lines) {
      if (line.account.type !== 'REVENUE' && line.account.type !== 'EXPENSE') continue;
      // Consolidated view: intercompany revenue/expense (management fees
      // etc. between entities in this same group) nets to zero at the group
      // level — see the class-level comment on why this is scope-simplified.
      if (consolidated && line.journalEntry.intercompanyGroupId) continue;
      const key = `${line.account.code}::${line.account.name}`;
      const rate = this.fxRate(line.account.entity, consolidated);
      const movement = D(line.creditAmount).sub(D(line.debitAmount)).mul(rate); // credit-normal raw; flipped below for expense
      const g = groups.get(key) ?? { name: line.account.name, type: line.account.type, balance: D(0), intercompany: line.account.isIntercompany };
      g.balance = g.balance.add(movement);
      groups.set(key, g);
    }

    const toSection = (type: AccountType) =>
      [...groups.entries()]
        .filter(([, g]) => g.type === type)
        .map(([key, g]) => ({ code: key.split('::')[0], name: g.name, balance: (type === 'EXPENSE' ? g.balance.neg() : g.balance).toFixed(2) }))
        .sort((a, b) => a.code.localeCompare(b.code));

    const revenue = toSection('REVENUE');
    const expenses = toSection('EXPENSE');
    const totalRevenue = revenue.reduce((s, r) => s.add(D(r.balance)), D(0));
    const totalExpenses = expenses.reduce((s, e) => s.add(D(e.balance)), D(0));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      consolidated,
      entityIds,
      revenue,
      totalRevenue: totalRevenue.toFixed(2),
      expenses,
      totalExpenses: totalExpenses.toFixed(2),
      netIncome: totalRevenue.sub(totalExpenses).toFixed(2),
    };
  }

  // Indirect method. Starts from net income, then adjusts for the period's
  // movement in every non-cash balance-sheet account, bucketed by the
  // account's cashFlowCategory. Retained Earnings (3900) is deliberately
  // excluded from the Financing bucket — its movement is driven by net
  // income (already the starting point) plus any dividend postings, and
  // including its raw movement again would double-count net income. A real
  // dividend-paid line would need its own account/handling — not built here.
  async getCashFlowStatement(scope: ScopeParams, from: Date, to: Date) {
    const { entityIds, consolidated } = await this.resolveScope(scope);
    const income = await this.getIncomeStatement(scope, from, to);
    const lines = await this.fetchLines(entityIds, { from, to });

    const byCategory = { OPERATING: D(0), INVESTING: D(0), FINANCING: D(0) };
    for (const line of lines) {
      const acct = line.account;
      if (acct.type !== 'ASSET' && acct.type !== 'LIABILITY' && acct.type !== 'EQUITY') continue;
      if (acct.code === '1000') continue; // cash itself — the thing being reconciled to, not a reconciling item
      if (acct.code === '3900') continue; // retained earnings — see method comment
      const category: CashFlowCategory | null = acct.cashFlowCategory;
      if (!category) continue;

      const rate = this.fxRate(acct.entity, consolidated);
      // Raw debit-minus-credit movement, in the account's own debit-normal
      // convention (so a liability/equity increase shows up negative here).
      // The cash effect is always the negation of that raw movement: an
      // asset increase consumes cash (-rawMovement, rawMovement already
      // positive); a liability/equity increase frees cash (-rawMovement,
      // rawMovement already negative, so this correctly comes out positive).
      // Same single rule for both account kinds — no branch needed.
      const rawMovement = D(line.debitAmount).sub(D(line.creditAmount)).mul(rate);
      byCategory[category] = byCategory[category].add(rawMovement.neg());
    }

    const netIncome = D(income.netIncome);
    const operating = netIncome.add(byCategory.OPERATING);
    const investing = byCategory.INVESTING;
    const financing = byCategory.FINANCING;
    const netChange = operating.add(investing).add(financing);

    const cashLines = lines.filter((l) => l.account.code === '1000');
    const actualCashMovement = cashLines.reduce((s, l) => {
      const rate = this.fxRate(l.account.entity, consolidated);
      return s.add(D(l.debitAmount).sub(D(l.creditAmount)).mul(rate));
    }, D(0));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      consolidated,
      entityIds,
      netIncome: netIncome.toFixed(2),
      operatingActivities: operating.toFixed(2),
      investingActivities: investing.toFixed(2),
      financingActivities: financing.toFixed(2),
      netChangeInCash: netChange.toFixed(2),
      actualCashMovement: actualCashMovement.toFixed(2),
      reconciles: netChange.eq(actualCashMovement),
    };
  }
}
