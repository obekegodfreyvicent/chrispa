import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateLegalEntityDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  // ISO 4217, e.g. "UGX", "KES" — the currency this entity's own books are kept in.
  @IsString()
  functionalCurrency: string;

  @IsOptional()
  @IsUUID()
  parentEntityId?: string;

  // 1 unit of functionalCurrency = this many units of the group reporting
  // currency. Defaults to 1 (i.e. "same as group currency") if omitted.
  @IsOptional()
  @IsNumber()
  currentGroupFxRate?: number;
}

export class UpdateLegalEntityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  currentGroupFxRate?: number;
}
