import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verify } from 'otplib';
import * as qrcode from 'qrcode';
import { PrismaService } from '../../common/prisma/prisma.service';
import { decryptTotpSecret, encryptTotpSecret } from './util/totp-crypto.util';

// FR-17.1: TOTP-based Two-Factor Authentication. Fully enforced at login
// (see AuthService.login()/verifyTwoFactorLogin()) — unlike SMS/email OTP,
// TOTP needs no delivery channel, which is why this could be built while
// Login Alerts (needs an SMS/email provider) and Biometric Login (needs a
// WebAuthn implementation) are still just stored flags.
@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private encryptionKey() {
    return this.config.get<string>('totpEncryptionKey')!;
  }

  // Generates and stores a new secret but does NOT enable 2FA yet — confirm()
  // does that, once the user proves they actually scanned it into an app by
  // submitting a real code. Re-enrolling before confirming just overwrites
  // the pending secret, which is fine (nothing was relying on it yet).
  async enroll(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: encryptTotpSecret(secret, this.encryptionKey()), twoFactorEnabled: false },
    });

    const label = user.email ?? user.phone ?? userId;
    const otpauthUrl = generateURI({ issuer: 'ChrisPa', label, secret });
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
    // Returned once, like a temp password — the plaintext secret is never
    // retrievable again after this response; only its encrypted form persists.
    return { qrCodeDataUrl, manualEntryKey: secret };
  }

  async confirm(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret) {
      throw new BadRequestException('No pending 2FA enrollment — call enroll first');
    }
    const secret = decryptTotpSecret(user.twoFactorSecret, this.encryptionKey());
    const result = await verify({ secret, token: code });
    if (!result.valid) {
      throw new UnauthorizedException('Incorrect code');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    return { twoFactorEnabled: true };
  }

  // Requires the account password (not a 2FA code) to turn off — disabling
  // 2FA is a security downgrade, so it needs the same proof-of-identity as
  // changing the password, not just possession of an already-unlocked session.
  async disable(userId: string, currentPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
    return { twoFactorEnabled: false };
  }

  async verifyCode(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) return false;
    const secret = decryptTotpSecret(user.twoFactorSecret, this.encryptionKey());
    const result = await verify({ secret, token: code });
    return result.valid;
  }
}
