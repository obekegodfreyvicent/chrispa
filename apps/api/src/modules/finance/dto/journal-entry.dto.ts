import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class JournalEntryLineDto {
  @IsUUID()
  accountId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  debitAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditAmount?: number;

  @IsOptional()
  @IsString()
  memo?: string;
}

export class PostJournalEntryDto {
  @IsUUID()
  entityId: string;

  @IsDateString()
  date: string;

  @IsString()
  description: string;

  // At least two lines — a single-line entry can't balance by definition.
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  lines: JournalEntryLineDto[];
}
