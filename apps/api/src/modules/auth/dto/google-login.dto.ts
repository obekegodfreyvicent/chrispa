import { IsString } from 'class-validator';

export class GoogleLoginDto {
  // The ID token from Google Identity Services' client-side sign-in flow —
  // never a client secret, and never used to look anything up until
  // AuthService.googleLogin() verifies its signature server-side.
  @IsString()
  idToken: string;
}
