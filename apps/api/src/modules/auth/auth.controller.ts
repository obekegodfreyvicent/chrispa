import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { AllowPendingPasswordChange } from './decorators/allow-pending-password-change.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ConfirmTwoFactorDto, DisableTwoFactorDto, VerifyTwoFactorLoginDto } from './dto/two-factor.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TwoFactorService } from './two-factor.service';

// Tighter throttle than the app-wide default — brute-force protection per SRS §11.
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

// FR-17.1 Login Alerts: best-effort client info attached to every completed
// login (see AuthService.completeLogin()/recordLoginEvent()).
function loginContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  // FR-9: Sign Up. Creates the account but does not log it in — see
  // AuthService.register()'s registration-OTP hard gate; the response has no
  // tokens, just a userId to drive the verify-otp step.
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: FastifyRequest) {
    return this.authService.register(dto, loginContext(req));
  }

  // FR-8: Log In (password mode + TOTP 2FA/WebAuthn as second/alternate
  // steps; the registration-OTP hard gate can also return
  // { requiresVerification: true, userId } here — see AuthService.login()).
  // OTP-as-credential and Facebook/Apple social login modes are still
  // follow-up work — see docs/SRS.md FR-8.1/8.4/8.5.
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: FastifyRequest) {
    return this.authService.login(dto, loginContext(req));
  }

  // Confirms one channel (email or phone) of the registration OTP — see
  // AuthService.verifyOtp(). No guard: the caller isn't authenticated yet,
  // that's the whole point of this endpoint.
  @Throttle(AUTH_THROTTLE)
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: FastifyRequest) {
    return this.authService.verifyOtp(dto, loginContext(req));
  }

  @Throttle(AUTH_THROTTLE)
  @Post('resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  // FR-8.4/FR-9.4: "Sign in with Google" — completes a full login/account
  // creation on its own from a Google Identity Services ID token, same
  // "no password step required" shape as WebAuthn login.
  @Throttle(AUTH_THROTTLE)
  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto, @Req() req: FastifyRequest) {
    return this.authService.googleLogin(dto.idToken, loginContext(req));
  }

  // Second step of login when the account has 2FA enabled — exchanges the
  // challengeToken from login()'s { requiresTwoFactor: true } response plus
  // a TOTP code for real tokens. Same throttle as login/register: a 6-digit
  // code is brute-forceable in isolation, rate limiting is what makes it not.
  @Throttle(AUTH_THROTTLE)
  @Post('login/2fa')
  verifyTwoFactorLogin(@Body() dto: VerifyTwoFactorLoginDto, @Req() req: FastifyRequest) {
    return this.authService.verifyTwoFactorLogin(dto.challengeToken, dto.code, loginContext(req));
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @AllowPendingPasswordChange()
  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return { success: true };
  }

  @AllowPendingPasswordChange()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { userId: string; role: string; tier: string; mustChangePassword: boolean }) {
    return user;
  }

  // Reachable even with a pending mustChangePassword — this is the one
  // action that clears it. See MustChangePasswordGuard / AuthService.changePassword().
  @AllowPendingPasswordChange()
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@CurrentUser() user: { userId: string }, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
  }

  // FR-17.1: TOTP 2FA enrollment. Returns a QR code + manual entry key —
  // twoFactorEnabled only flips on once confirm() proves the code works.
  @UseGuards(JwtAuthGuard)
  @Post('2fa/enroll')
  enrollTwoFactor(@CurrentUser() user: { userId: string }) {
    return this.twoFactor.enroll(user.userId);
  }

  @Throttle(AUTH_THROTTLE)
  @UseGuards(JwtAuthGuard)
  @Post('2fa/confirm')
  confirmTwoFactor(@CurrentUser() user: { userId: string }, @Body() dto: ConfirmTwoFactorDto) {
    return this.twoFactor.confirm(user.userId, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  disableTwoFactor(@CurrentUser() user: { userId: string }, @Body() dto: DisableTwoFactorDto) {
    return this.twoFactor.disable(user.userId, dto.currentPassword);
  }
}
