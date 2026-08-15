import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AddItemDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;
}

export class UpdateItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;

  @IsOptional()
  @IsUUID()
  variantId?: string;
}
