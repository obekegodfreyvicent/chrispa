import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { AddressType } from '@prisma/client';

export class CreateAddressDto {
  @IsString()
  label: string;

  @IsString()
  recipient: string;

  @IsString()
  line1: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
