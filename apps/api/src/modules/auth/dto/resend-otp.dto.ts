import { IsEnum, IsString } from 'class-validator';
import { OtpChannel } from '@prisma/client';

export class ResendOtpDto {
  @IsString()
  userId: string;

  @IsEnum(OtpChannel)
  channel: OtpChannel;
}
