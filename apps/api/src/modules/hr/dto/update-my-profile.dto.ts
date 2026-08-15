import { IsDateString, IsOptional, IsString } from 'class-validator';

// Self-service profile edit — deliberately a small subset of Employee's
// fields. Job title, department, employment status/type, salary, and
// national ID stay HR-controlled via EmployeesService.update() — an
// employee editing their own compensation or title would defeat the point
// of HR oversight.
export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  personalEmail?: string;

  @IsOptional()
  @IsString()
  personalPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
