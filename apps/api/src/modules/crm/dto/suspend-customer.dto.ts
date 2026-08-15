import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuspendCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
