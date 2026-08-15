import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, Prisma, UserRole } from '@prisma/client';
import { ActivityLogService, ActorInfo, deriveActorType, RequestInfo, SYSTEM_ROLE } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PostJournalEntryDto } from './dto/journal-entry.dto';

// FIN-FR-1/2 (docs/SRS.md §20): the double-entry core. Every other Finance
// service (Intercompany, FinancialReports) is built on top of this one.
@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // ASSET/EXPENSE increase on the debit side; LIABILITY/EQUITY/REVENUE
  // increase on the credit side — the one universal rule every balance
  // calculation in this module ultimately rests on.
  static normalBalanceSign(type: AccountType): 1 | -1 {
    return type === AccountType.ASSET || type === AccountType.EXPENSE ? 1 : -1;
  }

  // Finds (or lazily opens) the entity's fiscal period for a given date.
  // Real close-of-books workflows pre-create/close periods deliberately;
  // this codebase's minimum core auto-opens one on first use so posting
  // isn't blocked on a separate "open the period" admin step, and still
  // enforces closed-period immutability once a period IS explicitly closed
  // (see closePeriod()).
  private async ensureOpenPeriod(tx: Prisma.TransactionClient, entityId: string, date: Date) {
    const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    let period = await tx.fiscalPeriod.findUnique({ where: { entityId_month: { entityId, month } } });
    if (!period) {
      period = await tx.fiscalPeriod.create({ data: { entityId, month } });
    }
    if (period.status === 'CLOSED') {
      throw new BadRequestException(
        `The fiscal period for ${month.toISOString().slice(0, 7)} is closed for this entity — reopen it before posting.`,
      );
    }
    return period;
  }

  async closePeriod(entityId: string, month: string) {
    const monthDate = new Date(month);
    const normalized = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1));
    const period = await this.prisma.fiscalPeriod.findUnique({ where: { entityId_month: { entityId, month: normalized } } });
    if (!period) throw new NotFoundException('No fiscal period exists for this entity/month yet.');
    return this.prisma.fiscalPeriod.update({ where: { id: period.id }, data: { status: 'CLOSED', closedAt: new Date() } });
  }

  async reopenPeriod(entityId: string, month: string) {
    const monthDate = new Date(month);
    const normalized = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1));
    const period = await this.prisma.fiscalPeriod.findUnique({ where: { entityId_month: { entityId, month: normalized } } });
    if (!period) throw new NotFoundException('No fiscal period exists for this entity/month yet.');
    return this.prisma.fiscalPeriod.update({ where: { id: period.id }, data: { status: 'OPEN', closedAt: null } });
  }

  listPeriods(entityId: string) {
    return this.prisma.fiscalPeriod.findMany({ where: { entityId }, orderBy: { month: 'desc' } });
  }

  // The one hard business rule this whole module exists to enforce: a
  // journal entry's debits must equal its credits, to the cent. Shared by
  // postEntry() and IntercompanyService (which posts two linked entries,
  // each independently balanced).
  static assertBalanced(lines: { debitAmount?: number; creditAmount?: number }[]) {
    let debitTotal = new Prisma.Decimal(0);
    let creditTotal = new Prisma.Decimal(0);
    for (const line of lines) {
      const debit = new Prisma.Decimal(line.debitAmount ?? 0);
      const credit = new Prisma.Decimal(line.creditAmount ?? 0);
      if (debit.gt(0) && credit.gt(0)) {
        throw new BadRequestException('A journal line cannot have both a debit and a credit amount.');
      }
      if (debit.eq(0) && credit.eq(0)) {
        throw new BadRequestException('Every journal line needs a non-zero debit or credit amount.');
      }
      debitTotal = debitTotal.add(debit);
      creditTotal = creditTotal.add(credit);
    }
    if (!debitTotal.eq(creditTotal)) {
      throw new BadRequestException(
        `Journal entry does not balance: total debits ${debitTotal.toFixed(2)} ≠ total credits ${creditTotal.toFixed(2)}.`,
      );
    }
    return { debitTotal, creditTotal };
  }

  async postEntry(dto: PostJournalEntryDto, actor: ActorInfo, context: RequestInfo = {}) {
    return this.prisma.$transaction((tx) => this.postEntryInternal(tx, dto, actor, context));
  }

  // Extracted so IntercompanyService can post the two linked entries an
  // intercompany transaction requires inside ONE outer $transaction — true
  // atomicity (both post or neither does), not two independent calls that
  // could leave one entity's books written and the other's not.
  async postEntryInternal(
    tx: Prisma.TransactionClient,
    dto: PostJournalEntryDto,
    actor: ActorInfo,
    context: RequestInfo = {},
    intercompanyGroupId?: string,
  ) {
    JournalService.assertBalanced(dto.lines);

    const entity = await tx.legalEntity.findUnique({ where: { id: dto.entityId } });
    if (!entity) throw new NotFoundException('Legal entity not found');

    const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
    const accounts = await tx.account.findMany({ where: { id: { in: accountIds }, entityId: dto.entityId } });
    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('One or more accounts do not belong to this entity, or do not exist.');
    }

    const date = new Date(dto.date);
    const period = await this.ensureOpenPeriod(tx, dto.entityId, date);

    const last = await tx.journalEntry.findFirst({ where: { entityId: dto.entityId }, orderBy: { entryNumber: 'desc' } });
    const entryNumber = (last?.entryNumber ?? 0) + 1;

    const entry = await tx.journalEntry.create({
      data: {
        entityId: dto.entityId,
        fiscalPeriodId: period.id,
        entryNumber,
        date,
        description: dto.description,
        fxRateToGroupCurrency: entity.currentGroupFxRate,
        createdByUserId: actor.userId,
        intercompanyGroupId,
        lines: {
          create: dto.lines.map((l) => ({
            accountId: l.accountId,
            debitAmount: l.debitAmount ?? 0,
            creditAmount: l.creditAmount ?? 0,
            memo: l.memo,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });

    await this.activityLog.record(
      {
        actorUserId: actor.userId,
        // SYSTEM_ROLE is a sentinel, not a real UserRole — ActivityLog.actorRole
        // is a UserRole? enum column that would reject it at the DB level.
        actorRole: actor.role === SYSTEM_ROLE ? undefined : (actor.role as UserRole),
        actorType: deriveActorType(actor.role),
        action: 'JOURNAL_ENTRY_POSTED',
        entityType: 'JournalEntry',
        entityId: entry.id,
        description: `Posted journal entry #${entryNumber} for ${entity.name}: "${dto.description}"`,
        metadata: { entityCode: entity.code, debitTotal: entry.lines.reduce((s, l) => s + Number(l.debitAmount), 0) },
        ...context,
      },
      tx,
    );

    return entry;
  }

  listEntries(entityId: string, params: { skip?: number; take?: number } = {}) {
    return this.prisma.journalEntry.findMany({
      where: { entityId },
      include: { lines: { include: { account: true } } },
      orderBy: { entryNumber: 'desc' },
      skip: params.skip ?? 0,
      take: params.take ?? 50,
    });
  }

  async getEntry(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: true } }, entity: true },
    });
    if (!entry) throw new NotFoundException('Journal entry not found');
    return entry;
  }

  // Net movement on one account, optionally as-of a date and/or from a date
  // (for a period's activity rather than a running balance) — the primitive
  // FinancialReportsService builds every statement from.
  async getAccountBalance(accountId: string, params: { from?: Date; to?: Date } = {}): Promise<Prisma.Decimal> {
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId,
        journalEntry: {
          status: 'POSTED',
          ...(params.from || params.to
            ? { date: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } }
            : {}),
        },
      },
      select: { debitAmount: true, creditAmount: true },
    });
    const sign = JournalService.normalBalanceSign(account.type);
    let balance = new Prisma.Decimal(0);
    for (const line of lines) {
      balance = balance.add(line.debitAmount).sub(line.creditAmount);
    }
    return sign === 1 ? balance : balance.neg();
  }
}
