import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateShiftDto {
  @IsUUID()
  employeeId: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSwapRequestDto {
  @IsUUID()
  coverEmployeeId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReviewSwapRequestDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';
}
