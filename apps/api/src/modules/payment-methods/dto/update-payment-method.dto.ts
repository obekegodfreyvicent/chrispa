import { IsBoolean, IsOptional } from 'class-validator';

// Only isDefault is mutable after creation — changing the underlying
// identifier means removing and re-adding the payment method.
export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
