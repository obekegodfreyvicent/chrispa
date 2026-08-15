import { IsEnum, IsString } from 'class-validator';
import { OtpChannel } from '@prisma/client';

export class VerifyOtpDto {
  @IsString()
  userId: string;

  @IsEnum(OtpChannel)
  channel: OtpChannel;

  @IsString()
  code: string;
}
