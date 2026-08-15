import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethodType } from '@prisma/client';

export class CreatePaymentMethodDto {
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  // For MOBILE_MONEY, the phone number — masked server-side before storage.
  // CARD is rejected at the service layer (see payment-methods.service.ts):
  // there's no payment gateway integrated yet to tokenize a card through, and
  // this API deliberately never accepts a raw card number/CVV.
  @IsString()
  identifier: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
