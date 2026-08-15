import { IsBoolean, IsInt, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateBannerDto {
  // require_tld: false so a local-disk upload URL (http://localhost:3000/...)
  // validates in dev — same reasoning as CheckoutDto.returnUrl.
  @IsUrl({ require_tld: false })
  imageUrl: string;

  // Plain string, not @IsUrl — this can be a relative in-app path
  // (e.g. /shop/candles), not just an absolute external URL.
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
