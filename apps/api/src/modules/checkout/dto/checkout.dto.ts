import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';
import { DeliveryMethod } from '@prisma/client';

export enum PaymentMethod {
  CASH_ON_DELIVERY = 'CASH_ON_DELIVERY',
  MOBILE_MONEY = 'MOBILE_MONEY',
  CARD = 'CARD',
}

class ShippingAddressDto {
  @IsString()
  recipient: string;

  @IsString()
  line1: string;

  @IsString()
  city: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckoutDto {
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @IsEnum(DeliveryMethod)
  deliveryMethod: DeliveryMethod;

  @IsOptional()
  @IsString()
  timeSlot?: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  couponCode?: string;

  // PAY-FR-1 (docs/SRS.md §21): required for MOBILE_MONEY/CARD — where
  // Flutterwave sends the customer back after they complete (or abandon)
  // the hosted checkout page. The frontend knows its own base URL best, so
  // this isn't derived server-side. Ignored for CASH_ON_DELIVERY.
  @IsOptional()
  @IsUrl({ require_tld: false }) // require_tld: false so http://localhost:3001/... validates in dev
  returnUrl?: string;
}
