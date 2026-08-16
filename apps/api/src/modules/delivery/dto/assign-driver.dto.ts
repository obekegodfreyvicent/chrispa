import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DeliveryPriority } from '@prisma/client';

export class AssignDriverDto {
  @IsUUID()
  driverId: string;

  @IsOptional()
  @IsEnum(DeliveryPriority)
  priority?: DeliveryPriority;
}
