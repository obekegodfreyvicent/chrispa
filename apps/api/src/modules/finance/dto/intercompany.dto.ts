import { IsDateString, IsNumber, IsPositive, IsString, IsUUID } from 'class-validator';

export class AllocateManagementFeeDto {
  @IsUUID()
  parentEntityId: string;

  @IsUUID()
  subsidiaryEntityId: string;

  // In the GROUP reporting currency (see GroupSettings), not either entity's
  // own functional currency — each side's books record it translated at
  // their own currentGroupFxRate. See IntercompanyService.localAmount().
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsDateString()
  date: string;

  @IsString()
  description: string;
}

export class RecordIntercompanyTransferDto {
  // The entity that is owed money after this transaction (its Intercompany
  // Receivable account increases).
  @IsUUID()
  creditorEntityId: string;

  // What the creditor gave up to fund this — e.g. its Cash account, if it
  // paid a debtor's expense directly.
  @IsUUID()
  creditorSourceAccountId: string;

  // The entity that now owes money (its Intercompany Payable account
  // increases).
  @IsUUID()
  debtorEntityId: string;

  // What the debtor received the benefit of — e.g. an Expense or Asset
  // account on the debtor's own books.
  @IsUUID()
  debtorDestinationAccountId: string;

  // In the GROUP reporting currency — see AllocateManagementFeeDto.amount.
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsDateString()
  date: string;

  @IsString()
  description: string;
}
