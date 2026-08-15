import { IsDateString, IsIn, IsPositive, IsString, IsUUID } from 'class-validator';

// The four category accounts AccountsService.applyStandardTemplate() seeds
// — kept as a closed list (not a free-text account code) so the admin UI
// can offer a simple category picker instead of exposing raw chart-of-
// accounts codes for this one common, repetitive action.
export const EXPENSE_CATEGORY_CODES = ['5101', '5102', '5103', '5100'] as const;

export class RecordExpenseDto {
  @IsUUID()
  entityId: string;

  @IsIn(EXPENSE_CATEGORY_CODES)
  expenseAccountCode: (typeof EXPENSE_CATEGORY_CODES)[number];

  // Which account the money came out of — usually Cash (1000), but could be
  // Accounts Payable (2000) if the expense is on credit/invoiced terms.
  @IsUUID()
  paidFromAccountId: string;

  @IsPositive()
  amountUgx: number;

  @IsDateString()
  date: string;

  @IsString()
  description: string;
}
