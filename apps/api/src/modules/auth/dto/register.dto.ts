import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  // Required (not optional) — the registration OTP hard gate (see
  // AuthService.register()/login()) needs a phone number to send a code to.
  // Uganda format per docs/SRS.md's localization note.
  @IsString()
  @Matches(/^\+256\d{9}$/, { message: 'Phone must be in the format +256XXXXXXXXX' })
  phone: string;

  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
