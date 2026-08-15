import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { IntercompanyController } from './intercompany.controller';
import { IntercompanyService } from './intercompany.service';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';
import { ReportsController } from './reports.controller';
import { FinancialReportsService } from './reports.service';
import { RevenueRecognitionService } from './revenue-recognition.service';

// FIN-FR-1..9 (docs/SRS.md §20-21): Financial & Accounting Management —
// multi-entity chart of accounts, double-entry journal/ledger, intercompany
// automation, consolidated/per-entity financial statements, expense
// tracking, and (RevenueRecognitionService, exported) accrual-basis revenue
// recognition consumed by the commerce side (checkout/orders/payments).
// Everything under /admin/finance/* is OWNER-only (see the Access Control
// note on EntitiesController).
@Module({
  controllers: [EntitiesController, AccountsController, JournalController, IntercompanyController, ReportsController, ExpensesController],
  providers: [EntitiesService, AccountsService, JournalService, IntercompanyService, FinancialReportsService, ExpensesService, RevenueRecognitionService],
  exports: [RevenueRecognitionService],
})
export class FinanceModule {}
