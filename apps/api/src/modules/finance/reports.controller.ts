import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FinancialReportsService } from './reports.service';

// FIN-FR-2/3 (docs/SRS.md §20): portfolio-wide (and single-entity) balance
// sheet / income statement / cash flow reporting, generated on read.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
@Controller('admin/finance/reports')
export class ReportsController {
  constructor(private readonly reports: FinancialReportsService) {}

  @Get('balance-sheet')
  balanceSheet(@Query('entityId') entityId?: string, @Query('consolidatedRootId') consolidatedRootId?: string, @Query('asOf') asOf?: string) {
    return this.reports.getBalanceSheet({ entityId, consolidatedRootId }, asOf ? new Date(asOf) : new Date());
  }

  @Get('income-statement')
  incomeStatement(
    @Query('entityId') entityId?: string,
    @Query('consolidatedRootId') consolidatedRootId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getIncomeStatement(
      { entityId, consolidatedRootId },
      from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1),
      to ? new Date(to) : new Date(),
    );
  }

  @Get('cash-flow')
  cashFlow(
    @Query('entityId') entityId?: string,
    @Query('consolidatedRootId') consolidatedRootId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getCashFlowStatement(
      { entityId, consolidatedRootId },
      from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1),
      to ? new Date(to) : new Date(),
    );
  }
}
