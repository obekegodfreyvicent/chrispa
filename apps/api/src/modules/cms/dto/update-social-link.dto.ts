import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateSocialLinkDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  platform?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
