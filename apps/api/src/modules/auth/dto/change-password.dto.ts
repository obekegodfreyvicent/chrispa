import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}
