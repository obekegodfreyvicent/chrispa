import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  notifyOrderUpdatesSms?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOrderUpdatesEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyPromotions?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyPush?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyLoginAlerts?: boolean;
}
