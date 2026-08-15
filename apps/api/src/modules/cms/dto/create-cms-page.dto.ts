import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CmsStatus } from '@prisma/client';

export class CreateCmsPageDto {
  @IsString()
  title: string;

  // Auto-derived from `title` if omitted — see CmsService.uniqueSlug(),
  // the same collision-handled slugify used for products.
  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsEnum(CmsStatus)
  status?: CmsStatus;
}
