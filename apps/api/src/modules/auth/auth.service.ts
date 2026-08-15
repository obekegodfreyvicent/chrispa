import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpChannel, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { ActivityLogService, deriveActorType } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';
import { TwoFactorService } from './two-factor.service';

// Short — this token only bridges the gap between "password verified" and
// "TOTP code verified" in one login attempt, not a real session.
const MFA_CHALLENGE_TTL = '5m';

// Best-effort client info for Login Alerts (FR-17.1) — never required, a
// missing/unparseable value just means that login can't be fingerprinted.
export interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
}

// Refresh tokens are hashed with SHA-256, not bcrypt. bcrypt silently
// truncates its input at 72 bytes — fine for passwords (short, human-chosen),
// but these JWTs are much longer and, for a given user, share an identical
// prefix (header + `sub` claim) well past that limit. Hashing them with
// bcrypt made every refresh token issued to the same user collide onto the
// same truncated hash, so ANY of a user's active tokens would "match" ANY
// OTHER — silently breaking rotation and revocation. SHA-256 has no such
// truncation and also allows an exact-match DB lookup instead of an O(n)
// bcrypt.compare loop over every active token.
function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly twoFactor: TwoFactorService,
    private readonly activityLog: ActivityLogService,
    private readonly otp: OtpService,
  ) {}

  // Creates the account but does NOT log it in — registration OTP (email +
  // SMS, docs/SRS.md FR-8.1/FR-9) is a hard gate, per user decision: neither
  // channel is verified yet, so there's nothing to issue tokens against
  // until verifyOtp() clears both. See login()'s matching gate and
  // verifyOtp() below, which is the only path that completes this login.
  async register(dto: RegisterDto, context: LoginContext = {}) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { phone: dto.phone }] },
    });
    if (existing) {
      throw new ConflictException('An account with this email or phone already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        loyaltyAccount: { create: { pointsBalance: 0 } },
        cart: { create: {} },
      },
    });

    await this.activityLog.record({
      actorUserId: user.id,
      actorRole: user.role,
      actorType: deriveActorType(user.role),
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      description: `${user.name} registered a new account`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // allSettled, not all: the account row above is already committed, so a
    // delivery failure on either channel (provider outage, bad credentials,
    // network issue — as opposed to "not configured", which OtpService
    // already handles without throwing) must not crash this request and
    // leave the customer stuck on an orphaned unverified account with a
    // bare 500. The OTP code itself is still persisted either way, so
    // "Resend code" gives them a real second chance once the provider issue
    // is fixed.
    const results = await Promise.allSettled([
      this.otp.issue(user.id, OtpChannel.EMAIL, dto.email),
      this.otp.issue(user.id, OtpChannel.SMS, dto.phone),
    ]);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(`Registration OTP dispatch failed for user ${user.id}: ${result.reason}`);
      }
    }

    return {
      userId: user.id,
      message: 'Enter the codes sent to your email and phone to finish creating your account.',
    };
  }

  async login(dto: LoginDto, context: LoginContext = {}) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { phone: dto.identifier }] },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Registration OTP hard gate — customers only (see class-level note on
    // scope; staff accounts are provisioned by HR/Owner, never go through
    // self-registration, and have no OTP flow to satisfy). A Google-created
    // account always has emailVerifiedAt set and no phone on file, so it
    // never trips this on the password-login path either — see
    // googleLogin(), which bypasses this check entirely.
    if (
      user.role === UserRole.CUSTOMER &&
      (!user.emailVerifiedAt || (user.phone && !user.phoneVerifiedAt))
    ) {
      return { requiresVerification: true, userId: user.id };
    }

    if (user.twoFactorEnabled) {
      // Password alone doesn't complete login — issue a short-lived
      // challenge token (signed with its own secret, never accessSecret, so
      // it can never pass as a real access token through JwtAuthGuard) that
      // the client exchanges for real tokens via verifyTwoFactorLogin() once
      // the TOTP code is also verified.
      const challengeToken = this.jwt.sign(
        { sub: user.id, purpose: 'mfa_challenge' },
        { secret: this.config.get<string>('jwt.mfaChallengeSecret'), expiresIn: MFA_CHALLENGE_TTL },
      );
      return { requiresTwoFactor: true, challengeToken };
    }

    return this.completeLogin(user, context);
  }

  async verifyTwoFactorLogin(challengeToken: string, code: string, context: LoginContext = {}) {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwt.verify(challengeToken, { secret: this.config.get<string>('jwt.mfaChallengeSecret') });
    } catch {
      throw new UnauthorizedException('Invalid or expired login challenge — please log in again');
    }
    if (payload.purpose !== 'mfa_challenge') {
      throw new UnauthorizedException('Invalid login challenge');
    }

    const valid = await this.twoFactor.verifyCode(payload.sub, code);
    if (!valid) throw new UnauthorizedException('Incorrect code');

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    return this.completeLogin(user, context);
  }

  // Confirms one channel's registration OTP (see register()'s hard gate).
  // Once BOTH email and phone are verified (or just email, for an account
  // with no phone on file), this is what actually completes the login that
  // register() deliberately didn't — same "issue tokens right after the
  // gate that was blocking them clears" shape as changePassword().
  async verifyOtp(dto: VerifyOtpDto, context: LoginContext = {}) {
    await this.otp.verify(dto.userId, dto.channel, dto.code);

    const field = dto.channel === OtpChannel.EMAIL ? 'emailVerifiedAt' : 'phoneVerifiedAt';
    const user = await this.prisma.user.update({
      where: { id: dto.userId },
      data: { [field]: new Date() },
    });

    const stillNeedsPhone = !!user.phone && !user.phoneVerifiedAt;
    if (!user.emailVerifiedAt || stillNeedsPhone) {
      return { verified: { email: !!user.emailVerifiedAt, phone: !!user.phoneVerifiedAt } };
    }

    return this.completeLogin(user, context);
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: dto.userId } });
    const destination = dto.channel === OtpChannel.EMAIL ? user.email : user.phone;
    if (!destination) {
      throw new BadRequestException(`No ${dto.channel === OtpChannel.EMAIL ? 'email' : 'phone'} on file for this account`);
    }
    await this.otp.issue(user.id, dto.channel, destination);
    return { success: true };
  }

  // "Sign in with Google" (FR-8.4/FR-9.4) — the idToken comes straight from
  // Google Identity Services on the client; verifyIdToken() checks its
  // signature and audience server-side before any of its claims are
  // trusted. Google having already proven the email is real is why this
  // path never checks (and a new account here always satisfies) the
  // registration-OTP hard gate in login() above — see the class-level note
  // on emailVerifiedAt/phoneVerifiedAt in schema.prisma.
  async googleLogin(idToken: string, context: LoginContext = {}) {
    const clientId = this.config.get<string>('google.clientId');
    if (!clientId) {
      throw new UnauthorizedException('Google sign-in is not configured');
    }

    let payload: { sub: string; email?: string; name?: string } | undefined;
    try {
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }
    if (!payload?.email) {
      throw new UnauthorizedException('This Google account has no verified email');
    }

    let user = await this.prisma.user.findUnique({ where: { googleId: payload.sub } });
    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({ where: { email: payload.email } });
      if (existingByEmail) {
        // Link this Google identity onto the existing account — Google has
        // already verified the email, which is the same authority
        // emailVerifiedAt otherwise records, so backfill it here too if it
        // was somehow still unset.
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: { googleId: payload.sub, emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date() },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            name: payload.name ?? payload.email,
            email: payload.email,
            googleId: payload.sub,
            emailVerifiedAt: new Date(),
            loyaltyAccount: { create: { pointsBalance: 0 } },
            cart: { create: {} },
          },
        });
        await this.activityLog.record({
          actorUserId: user.id,
          actorRole: user.role,
          actorType: deriveActorType(user.role),
          action: 'USER_REGISTERED',
          entityType: 'User',
          entityId: user.id,
          description: `${user.name} registered a new account via Google sign-in`,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });
      }
    }

    return this.completeLogin(user, context);
  }

  // Shared tail end of every path that actually completes a login (password,
  // 2FA-verified, WebAuthn — but deliberately NOT refresh(), which isn't a
  // new login, just silent token renewal for an already-established session).
  async completeLogin(
    user: { id: string; role: string; tier: string; mustChangePassword: boolean },
    context: LoginContext,
  ) {
    await this.recordLoginEvent(user.id, context);
    await this.activityLog.record({
      actorUserId: user.id,
      actorRole: user.role as UserRole,
      actorType: deriveActorType(user.role),
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      description: 'Logged in',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return this.issueTokens(user.id, user.role, user.tier, user.mustChangePassword);
  }

  // FR-17.1 Login Alerts (new device): a lightweight (ip, userAgent) match
  // against this user's own login history — not a rigorous device-identity
  // system, a documented limitation. A brand-new account's first-ever login
  // is never flagged (nothing to compare against yet); delivery is in-app
  // (see AccountSettingsService), not SMS/email — no provider is connected.
  private async recordLoginEvent(userId: string, { ipAddress, userAgent }: LoginContext) {
    const hasPriorHistory = await this.prisma.loginEvent.findFirst({ where: { userId } });
    const isNewDevice = hasPriorHistory
      ? !(await this.prisma.loginEvent.findFirst({ where: { userId, ipAddress: ipAddress ?? null, userAgent: userAgent ?? null } }))
      : false;
    await this.prisma.loginEvent.create({ data: { userId, ipAddress, userAgent, isNewDevice } });
  }

  // Verifies the caller's current password (the one-time temp password, on
  // a first login) and swaps it for a chosen one, clearing
  // mustChangePassword and reissuing tokens so the new access token's JWT
  // claim reflects the change immediately — no need to wait out the old
  // token's 15-minute TTL.
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    return this.issueTokens(user.id, user.role, user.tier, false);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const match = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        tokenHash: hashToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!match) {
      throw new UnauthorizedException('Refresh token not recognized');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    await this.prisma.refreshToken.update({
      where: { id: match.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user.id, user.role, user.tier, user.mustChangePassword);
  }

  // Revokes the refresh token server-side so it can't be used again, even if
  // it leaks after the client clears it. Never throws — an invalid/expired/
  // already-revoked token just means there's nothing left to revoke; logout
  // should always succeed from the client's point of view.
  async logout(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(refreshToken, { secret: this.config.get<string>('jwt.refreshSecret') });
    } catch {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: { userId: payload.sub, tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(userId: string, role: string, tier: string, mustChangePassword: boolean) {
    const payload = { sub: userId, role, tier, mustChangePassword };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: this.config.get<string>('jwt.accessTtl') as any,
    });

    const jti = randomUUID();
    const refreshTtlDays = this.config.get<number>('jwt.refreshTtlDays')!;
    const refreshToken = this.jwt.sign(
      { sub: userId, jti },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: `${refreshTtlDays}d`,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}
