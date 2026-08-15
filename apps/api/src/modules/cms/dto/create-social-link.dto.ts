import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateSocialLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  platform: string;

  @IsUrl()
  url: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
