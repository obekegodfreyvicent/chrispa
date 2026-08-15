import { IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  identifier: string; // email or phone — FR-8.2

  @IsString()
  password: string;
}
