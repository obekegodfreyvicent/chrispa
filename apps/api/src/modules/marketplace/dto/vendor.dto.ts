import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { VendorStatus } from '@prisma/client';

export class CreateVendorDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  payoutMobileMoneyNumber?: string;

  // Platform's cut — e.g. 20 = ChrisPa keeps 20%, vendor gets 80%.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRatePercent?: number;
}

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  payoutMobileMoneyNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRatePercent?: number;

  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;
}

export class ComputeVendorPayoutDto {
  @IsString()
  periodStart: string;

  @IsString()
  periodEnd: string;
}
