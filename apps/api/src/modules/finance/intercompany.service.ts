import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ActorInfo, RequestInfo } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AllocateManagementFeeDto, RecordIntercompanyTransferDto } from './dto/intercompany.dto';
import { JournalService } from './journal.service';

// FIN-FR-4/5 (docs/SRS.md §20): intercompany automation. Every method here
// posts to TWO entities' books atomically (same outer $transaction) and
// tags both resulting JournalEntry rows with a shared intercompanyGroupId —
// FinancialReportsService's consolidation step finds pairs by that ID (via
// the isIntercompany accounts they hit) and nets them to zero, which is
// what "automatically reconciles due-to/due-from... and eliminations" means
// in practice: the pairing is enforced at creation time, not reconstructed
// later by guessing which entries match.
@Injectable()
export class IntercompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  // Finds this entity's existing Intercompany Receivable/Payable account
  // for a specific counterparty, or provisions one on first use — every
  // entity pair gets its own account (not one shared "Intercompany" bucket)
  // so a per-counterparty balance is always directly readable, not just
  // derivable.
  private async ensureIntercompanyAccount(
    tx: Prisma.TransactionClient,
    entityId: string,
    counterpartyEntityId: string,
    kind: 'RECEIVABLE' | 'PAYABLE',
  ) {
    const existing = await tx.account.findFirst({
      where: { entityId, counterpartyEntityId, isIntercompany: true, type: kind === 'RECEIVABLE' ? AccountType.ASSET : AccountType.LIABILITY },
    });
    if (existing) return existing;

    const counterparty = await tx.legalEntity.findUniqueOrThrow({ where: { id: counterpartyEntityId } });
    const code = kind === 'RECEIVABLE' ? `1600-${counterparty.code}` : `2200-${counterparty.code}`;
    const name = kind === 'RECEIVABLE' ? `Intercompany Receivable — ${counterparty.name}` : `Intercompany Payable — ${counterparty.name}`;
    return tx.account.create({
      data: {
        entityId,
        code,
        name,
        type: kind === 'RECEIVABLE' ? AccountType.ASSET : AccountType.LIABILITY,
        cashFlowCategory: 'OPERATING',
        isIntercompany: true,
        counterpartyEntityId,
      },
    });
  }

  // Intercompany amounts (the DTOs' `amount` field) are denominated in the
  // GROUP reporting currency, not either entity's own functional currency —
  // the same way a real intercompany invoice is agreed in one currency and
  // each side then translates it into their own books at their own spot
  // rate. Using the raw group-currency figure directly in an entity's local
  // journal would silently mix currencies within one ledger; this converts
  // it via that entity's currentGroupFxRate first.
  private localAmount(entity: { currentGroupFxRate: Prisma.Decimal }, amountInGroupCurrency: number): Prisma.Decimal {
    return new Prisma.Decimal(amountInGroupCurrency).div(entity.currentGroupFxRate);
  }

  async allocateManagementFee(dto: AllocateManagementFeeDto, actor: ActorInfo, context: RequestInfo = {}) {
    if (dto.parentEntityId === dto.subsidiaryEntityId) {
      throw new BadRequestException('An entity cannot allocate a management fee to itself.');
    }
    const [parentEntity, subsidiaryEntity, feeIncomeAccount, feeExpenseAccount] = await Promise.all([
      this.prisma.legalEntity.findUniqueOrThrow({ where: { id: dto.parentEntityId } }),
      this.prisma.legalEntity.findUniqueOrThrow({ where: { id: dto.subsidiaryEntityId } }),
      this.prisma.account.findFirst({ where: { entityId: dto.parentEntityId, code: '4900' } }),
      this.prisma.account.findFirst({ where: { entityId: dto.subsidiaryEntityId, code: '5200' } }),
    ]);
    if (!feeIncomeAccount || !feeExpenseAccount) {
      throw new NotFoundException(
        'Both entities need the standard chart-of-accounts template applied (accounts 4900/5200) before allocating a management fee.',
      );
    }
    const parentAmount = this.localAmount(parentEntity, dto.amount);
    const subsidiaryAmount = this.localAmount(subsidiaryEntity, dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const groupId = randomUUID();
      const receivable = await this.ensureIntercompanyAccount(tx, dto.parentEntityId, dto.subsidiaryEntityId, 'RECEIVABLE');
      const payable = await this.ensureIntercompanyAccount(tx, dto.subsidiaryEntityId, dto.parentEntityId, 'PAYABLE');

      const parentEntry = await this.journal.postEntryInternal(
        tx,
        {
          entityId: dto.parentEntityId,
          date: dto.date,
          description: `Management fee billed to subsidiary — ${dto.description} (${dto.amount} group currency)`,
          lines: [
            { accountId: receivable.id, debitAmount: parentAmount.toNumber() },
            { accountId: feeIncomeAccount.id, creditAmount: parentAmount.toNumber() },
          ],
        },
        actor,
        context,
        groupId,
      );

      const subsidiaryEntry = await this.journal.postEntryInternal(
        tx,
        {
          entityId: dto.subsidiaryEntityId,
          date: dto.date,
          description: `Management fee from parent — ${dto.description} (${dto.amount} group currency)`,
          lines: [
            { accountId: feeExpenseAccount.id, debitAmount: subsidiaryAmount.toNumber() },
            { accountId: payable.id, creditAmount: subsidiaryAmount.toNumber() },
          ],
        },
        actor,
        context,
        groupId,
      );

      return { intercompanyGroupId: groupId, parentEntry, subsidiaryEntry };
    });
  }

  async recordTransfer(dto: RecordIntercompanyTransferDto, actor: ActorInfo, context: RequestInfo = {}) {
    if (dto.creditorEntityId === dto.debtorEntityId) {
      throw new BadRequestException('Creditor and debtor must be different entities.');
    }
    const [creditorEntity, debtorEntity] = await Promise.all([
      this.prisma.legalEntity.findUniqueOrThrow({ where: { id: dto.creditorEntityId } }),
      this.prisma.legalEntity.findUniqueOrThrow({ where: { id: dto.debtorEntityId } }),
    ]);
    // See allocateManagementFee()'s comment on localAmount() — dto.amount is
    // in the group reporting currency; each side records it translated into
    // their own functional currency.
    const creditorAmount = this.localAmount(creditorEntity, dto.amount);
    const debtorAmount = this.localAmount(debtorEntity, dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const groupId = randomUUID();
      const receivable = await this.ensureIntercompanyAccount(tx, dto.creditorEntityId, dto.debtorEntityId, 'RECEIVABLE');
      const payable = await this.ensureIntercompanyAccount(tx, dto.debtorEntityId, dto.creditorEntityId, 'PAYABLE');

      const creditorEntry = await this.journal.postEntryInternal(
        tx,
        {
          entityId: dto.creditorEntityId,
          date: dto.date,
          description: `Intercompany advance to counterparty — ${dto.description} (${dto.amount} group currency)`,
          lines: [
            { accountId: receivable.id, debitAmount: creditorAmount.toNumber() },
            { accountId: dto.creditorSourceAccountId, creditAmount: creditorAmount.toNumber() },
          ],
        },
        actor,
        context,
        groupId,
      );

      const debtorEntry = await this.journal.postEntryInternal(
        tx,
        {
          entityId: dto.debtorEntityId,
          date: dto.date,
          description: `Intercompany advance from counterparty — ${dto.description} (${dto.amount} group currency)`,
          lines: [
            { accountId: dto.debtorDestinationAccountId, debitAmount: debtorAmount.toNumber() },
            { accountId: payable.id, creditAmount: debtorAmount.toNumber() },
          ],
        },
        actor,
        context,
        groupId,
      );

      return { intercompanyGroupId: groupId, creditorEntry, debtorEntry };
    });
  }

  // Per-counterparty due-to/due-from balances for one entity — the direct
  // "reconciled" view: each row is one counterparty and what's owed either
  // way, read straight off the intercompany accounts rather than
  // re-deriving it from raw journal lines each time.
  async dueToDueFrom(entityId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { entityId, isIntercompany: true },
      include: { counterpartyEntity: { select: { id: true, name: true, code: true } } },
    });
    const balances = await Promise.all(
      accounts.map(async (a) => ({
        counterparty: a.counterpartyEntity,
        accountType: a.type,
        balance: await this.journal.getAccountBalance(a.id),
      })),
    );
    return balances;
  }
}
