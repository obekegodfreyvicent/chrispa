import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AccountType, CashFlowCategory } from '@prisma/client';

export class CreateAccountDto {
  @IsUUID()
  entityId: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsOptional()
  @IsUUID()
  parentAccountId?: string;

  @IsOptional()
  @IsEnum(CashFlowCategory)
  cashFlowCategory?: CashFlowCategory;

  // Marks this as a due-to/due-from account IntercompanyService posts
  // against; counterpartyEntityId is required when this is true.
  @IsOptional()
  @IsBoolean()
  isIntercompany?: boolean;

  @IsOptional()
  @IsUUID()
  counterpartyEntityId?: string;
}
