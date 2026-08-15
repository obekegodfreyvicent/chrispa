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

export class CreateProductDto {
  @IsString()
  sku: string;

  @IsString()
  name: string;

  // Auto-derived from `name` if omitted — see CatalogService.slugify().
  @IsOptional()
  @IsString()
  slug?: string;

  @IsUUID()
  productLineId: string;

  @IsInt()
  @Min(0)
  priceUgx: number;

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

  // Full-replace semantics: the set of wellness-tag labels this product
  // should have after this call (existing tags are found-or-created by label).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  wellnessTags?: string[];

  // Full-replace semantics. URLs come from POST /admin/products/media/upload
  // (or, still, a pasted external URL — either works, the field doesn't care).
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
