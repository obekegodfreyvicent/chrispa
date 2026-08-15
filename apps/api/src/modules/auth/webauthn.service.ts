import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { PrismaService } from '../../common/prisma/prisma.service';

const CHALLENGE_TTL = '5m';

interface ChallengePayload {
  purpose: string;
  challenge: string;
  userId?: string;
}

// FR-17.1: Biometric Login via WebAuthn/passkeys. Registration happens
// authenticated (from Settings); login happens unauthenticated (from the
// login page, identifier-first so we know which credentials to allow).
// Reuses jwt.mfaChallengeSecret for its challenge tokens (see AuthService) —
// same "short-lived, purpose-scoped, never accessSecret" pattern, just a
// different purpose claim, since this is conceptually the same kind of
// bridge token as the 2FA login challenge.
@Injectable()
export class WebauthnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  private rpConfig() {
    return this.config.get<{ rpId: string; rpName: string; expectedOrigins: string[] }>('webauthn')!;
  }

  private signChallenge(payload: ChallengePayload) {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.mfaChallengeSecret'),
      expiresIn: CHALLENGE_TTL,
    });
  }

  private verifyChallengeToken(token: string, expectedPurpose: string): ChallengePayload {
    let payload: ChallengePayload;
    try {
      payload = this.jwt.verify(token, { secret: this.config.get<string>('jwt.mfaChallengeSecret') });
    } catch {
      throw new UnauthorizedException('Invalid or expired challenge — please try again');
    }
    if (payload.purpose !== expectedPurpose) {
      throw new UnauthorizedException('Invalid challenge');
    }
    return payload;
  }

  async generateRegistrationOptionsFor(userId: string) {
    const { rpId, rpName } = this.rpConfig();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const existing = await this.prisma.webAuthnCredential.findMany({ where: { userId } });

    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userName: user.email ?? user.phone ?? userId,
      userDisplayName: user.preferredName ?? user.name,
      excludeCredentials: existing.map((c) => ({ id: c.credentialId })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });

    const challengeToken = this.signChallenge({ purpose: 'webauthn_register', userId, challenge: options.challenge });
    return { options, challengeToken };
  }

  async verifyRegistration(
    userId: string,
    challengeToken: string,
    response: RegistrationResponseJSON,
    deviceLabel?: string,
  ) {
    const { challenge, userId: challengeUserId } = this.verifyChallengeToken(challengeToken, 'webauthn_register');
    if (challengeUserId !== userId) throw new UnauthorizedException('Challenge does not match this account');

    const { rpId, expectedOrigins } = this.rpConfig();
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpId,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('Could not verify this device');
    }

    const { credential } = verification.registrationInfo;
    await this.prisma.$transaction([
      this.prisma.webAuthnCredential.create({
        data: {
          userId,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          deviceLabel: deviceLabel || null,
        },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { biometricEnabled: true } }),
    ]);

    return { biometricEnabled: true };
  }

  async generateAuthenticationOptionsFor(identifier: string) {
    const { rpId } = this.rpConfig();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
      include: { webauthnCredentials: true },
    });

    // Anti-enumeration: always return a real options/challenge shape, even
    // for an unknown identifier or one with no registered credentials — the
    // browser just won't find a matching local credential, rather than the
    // server revealing account existence via a different response shape.
    const allowCredentials = user?.webauthnCredentials.map((c) => ({ id: c.credentialId })) ?? [];
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials,
      userVerification: 'preferred',
    });

    const challengeToken = this.signChallenge({ purpose: 'webauthn_login', challenge: options.challenge });
    return { options, challengeToken };
  }

  // Returns the authenticated User row — AuthController completes the login
  // (token issuance + LoginEvent logging) the same way it does for password/2FA.
  async verifyAuthentication(challengeToken: string, response: AuthenticationResponseJSON) {
    const { challenge } = this.verifyChallengeToken(challengeToken, 'webauthn_login');

    const stored = await this.prisma.webAuthnCredential.findUnique({ where: { credentialId: response.id } });
    if (!stored) throw new UnauthorizedException('Biometric credential not recognized');

    const { rpId, expectedOrigins } = this.rpConfig();
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpId,
      credential: {
        id: stored.credentialId,
        publicKey: new Uint8Array(stored.publicKey),
        counter: Number(stored.counter),
      },
    });
    if (!verification.verified) throw new UnauthorizedException('Could not verify this device');

    await this.prisma.webAuthnCredential.update({
      where: { id: stored.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter), lastUsedAt: new Date() },
    });

    return this.prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });
  }

  // Same proof-of-identity requirement as TwoFactorService.disable() — a
  // security downgrade needs the account password, not just an unlocked session.
  async disable(userId: string, currentPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.prisma.$transaction([
      this.prisma.webAuthnCredential.deleteMany({ where: { userId } }),
      this.prisma.user.update({ where: { id: userId }, data: { biometricEnabled: false } }),
    ]);
    return { biometricEnabled: false };
  }
}
