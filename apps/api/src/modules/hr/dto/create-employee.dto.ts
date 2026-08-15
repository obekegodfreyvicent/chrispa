import { IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { EmploymentType } from '@prisma/client';
import { STAFF_ROLES } from './create-login.dto';
import type { StaffRole } from './create-login.dto';

export class CreateEmployeeDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  personalEmail?: string;

  @IsOptional()
  @IsString()
  personalPhone?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  nationalIdNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsString()
  jobTitle: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsDateString()
  hireDate: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  baseSalaryUgx?: number;

  @IsOptional()
  @IsString()
  nssfNumber?: string;

  @IsOptional()
  @IsString()
  tinNumber?: string;

  // Links this employee record to an existing system login (User), if they
  // have one — e.g. an existing admin/staff account. Optional: an employee
  // can exist in HR before or without ever getting system access.
  @IsOptional()
  @IsUUID()
  userId?: string;

  // Provide both to also create a brand-new staff login for this employee
  // in the same request, issued with a one-time temporary password (see
  // EmployeesService.createLoginInternal()). Mutually exclusive with
  // userId — either link an existing account or create a new one, not both.
  @IsOptional()
  @IsEmail()
  loginEmail?: string;

  @IsOptional()
  @IsIn(STAFF_ROLES)
  loginRole?: StaffRole;
}
