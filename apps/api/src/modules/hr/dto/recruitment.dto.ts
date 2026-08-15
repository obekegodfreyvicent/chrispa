import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, IsInt, Min } from 'class-validator';
import { ApplicantStage, EmploymentType, JobPostingStatus } from '@prisma/client';

export class CreateJobPostingDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;
}

export class UpdateJobPostingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsEnum(JobPostingStatus)
  status?: JobPostingStatus;
}

export class CreateApplicantDto {
  @IsUUID()
  jobPostingId: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  coverNote?: string;
}

export class UpdateApplicantDto {
  @IsOptional()
  @IsEnum(ApplicantStage)
  stage?: ApplicantStage;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConvertApplicantDto {
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  baseSalaryUgx?: number;
}
