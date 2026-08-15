import { AllowanceType, PayrollAdjustmentType } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreatePayrollPeriodDto {
  // Any date within the target month — the service normalizes to the 1st.
  @IsDateString()
  month: string;
}

export class CreateAllowanceDto {
  @IsEnum(AllowanceType)
  type: AllowanceType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsInt()
  @IsPositive()
  amountUgx: number;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;
}

export class UpdateAllowanceDto {
  @IsOptional()
  @IsEnum(AllowanceType)
  type?: AllowanceType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  amountUgx?: number;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateAdvanceDto {
  @IsInt()
  @IsPositive()
  principalUgx: number;

  @IsInt()
  @IsPositive()
  monthlyInstallmentUgx: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateAdjustmentDto {
  @IsString()
  employeeId: string;

  @IsEnum(PayrollAdjustmentType)
  type: PayrollAdjustmentType;

  @IsString()
  @MaxLength(120)
  label: string;

  @IsInt()
  @IsPositive()
  amountUgx: number;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;
}

