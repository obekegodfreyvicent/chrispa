import { IsString, Length } from 'class-validator';

export class ConfirmTwoFactorDto {
  @IsString()
  @Length(6, 6)
  code: string;
}

export class DisableTwoFactorDto {
  @IsString()
  currentPassword: string;
}

export class VerifyTwoFactorLoginDto {
  @IsString()
  challengeToken: string;

  @IsString()
  @Length(6, 6)
  code: string;
}
