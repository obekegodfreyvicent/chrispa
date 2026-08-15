import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';

// All fields optional — PATCH semantics. Kept as its own class (rather than
// e.g. @nestjs/mapped-types' PartialType) to avoid a dependency for one DTO.
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsUUID()
  productLineId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceUgx?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  scentOrFlavorNotes?: string;

  @IsOptional()
  @IsString()
  directions?: string;

  @IsOptional()
  @IsString()
  healthBenefits?: string;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoMeta?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  wellnessTags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  // MKT-FR-1 (docs/SRS.md §21): assigns this product to a marketplace
  // vendor — omit/leave unset for a ChrisPa-owned product (the default).
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  // FIN-FR-7: cost basis for COGS at revenue-recognition time.
  @IsOptional()
  @IsInt()
  @Min(0)
  costUgx?: number;
}
