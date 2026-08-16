import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateShippingZoneDto {
  @IsString()
  name: string;

  @IsArray()
  @IsString({ each: true })
  towns: string[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  // Null/omitted means this delivery method isn't offered to this zone —
  // see the schema comment on ShippingZone.
  @IsOptional()
  @IsInt()
  @Min(0)
  standardFeeUgx?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  expressFeeUgx?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sameDayFeeUgx?: number | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
