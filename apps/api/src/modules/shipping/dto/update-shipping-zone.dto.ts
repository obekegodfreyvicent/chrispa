import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateShippingZoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  towns?: string[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

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
