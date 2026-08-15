import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { EmployeeDocumentType } from '@prisma/client';

export class AddDocumentDto {
  @IsEnum(EmployeeDocumentType)
  type: EmployeeDocumentType;

  @IsString()
  title: string;

  // No upload/object-storage integration yet — same pasted-URL pattern as
  // product media (see CatalogService.replaceMedia).
  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
