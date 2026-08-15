import { IsEnum, IsLatitude, IsLongitude, IsOptional } from 'class-validator';
import { DeliveryStatus } from '@prisma/client';

export class UpdateDeliveryStatusDto {
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;

  // Required by DeliveryService for PICKED_UP/DELIVERED specifically (not
  // enforced here at the DTO level since it's conditional on `status`) —
  // optional for the other transitions, which don't snapshot a position.
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;
}
