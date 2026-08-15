import { Injectable, NotFoundException } from '@nestjs/common';
import { ActorInfo, RequestInfo } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EXPENSE_CATEGORY_CODES, RecordExpenseDto } from './dto/expense.dto';
import { JournalService } from './journal.service';

const CATEGORY_LABELS: Record<(typeof EXPENSE_CATEGORY_CODES)[number], string> = {
  '5101': 'Server & Hosting Costs',
  '5102': 'Software Licenses',
  '5103': 'Marketing & Advertising',
  '5100': 'Other Operating Expenses',
};

// FIN-FR-9 (docs/SRS.md §21): Expense Tracking — a thin, named wrapper over
// the same double-entry journal engine everything else in Finance uses, so
// "how much did we spend on Marketing this quarter" is just
// JournalService.getAccountBalance() on account 5103, not a separate
// tracking system to keep in sync with the ledger.
@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  categories() {
    return EXPENSE_CATEGORY_CODES.map((code) => ({ code, label: CATEGORY_LABELS[code] }));
  }

  async recordExpense(dto: RecordExpenseDto, actor: ActorInfo, context: RequestInfo = {}) {
    const expenseAccount = await this.prisma.account.findFirst({
      where: { entityId: dto.entityId, code: dto.expenseAccountCode },
    });
    if (!expenseAccount) {
      throw new NotFoundException(`Expense account ${dto.expenseAccountCode} not found for this entity — apply the standard chart-of-accounts template first.`);
    }

    return this.journal.postEntry(
      {
        entityId: dto.entityId,
        date: dto.date,
        description: `${CATEGORY_LABELS[dto.expenseAccountCode]}: ${dto.description}`,
        lines: [
          { accountId: expenseAccount.id, debitAmount: dto.amountUgx },
          { accountId: dto.paidFromAccountId, creditAmount: dto.amountUgx },
        ],
      },
      actor,
      context,
    );
  }
}
