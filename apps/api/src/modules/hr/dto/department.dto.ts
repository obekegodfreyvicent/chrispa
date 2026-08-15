import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PermissionResource } from '@prisma/client';

export class DepartmentPermissionDto {
  @IsEnum(PermissionResource)
  resource: PermissionResource;

  @IsBoolean()
  canView: boolean;

  @IsBoolean()
  canCreate: boolean;

  @IsBoolean()
  canUpdate: boolean;

  @IsBoolean()
  canDelete: boolean;

  @IsBoolean()
  canExecute: boolean;
}

export class CreateDepartmentDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Optional initial policy — any resource not listed here is created
  // deny-all (see DepartmentsService.create()). Lets the caller set up the
  // full matrix in one request instead of create-then-PATCH-permissions.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentPermissionDto)
  permissions?: DepartmentPermissionDto[];
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateDepartmentPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentPermissionDto)
  permissions: DepartmentPermissionDto[];
}
