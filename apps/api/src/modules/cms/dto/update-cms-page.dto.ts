import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CmsStatus } from '@prisma/client';

export class UpdateCmsPageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsEnum(CmsStatus)
  status?: CmsStatus;
}
