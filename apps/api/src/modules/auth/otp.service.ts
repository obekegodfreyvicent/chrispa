import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { createHash, randomInt } from 'crypto';
import { MailService } from '../../common/notifications/mail.service';
import { SmsService } from '../../common/notifications/sms.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const MAX_ATTEMPTS = 5;
// Minimum gap between two sends on the same channel — on top of the
// controller-level @Throttle, this stops a resend from invalidating a code
// the user is mid-typing.
const MIN_RESEND_INTERVAL_MS = 30_000;

// Same createHash('sha256') convention as AuthService's refresh-token
// hashing (see auth.service.ts's hashToken()) — a 6-digit code has far less
// entropy than a refresh token, but hashing it the same way still keeps a
// DB read from directly leaking a valid code, and this is already a
// rate-limited, short-lived, single-use value so bcrypt would be needless
// overhead.
function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
  ) {}

  async issue(
    userId: string,
    channel: OtpChannel,
    destination: string,
    purpose: OtpPurpose = OtpPurpose.REGISTRATION,
  ) {
    const recent = await this.prisma.otpCode.findFirst({
      where: { userId, channel, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < MIN_RESEND_INTERVAL_MS) {
      throw new HttpException('Please wait a moment before requesting another code', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = generateCode();
    const ttlMinutes = this.config.get<number>('otp.ttlMinutes')!;
    await this.prisma.otpCode.create({
      data: {
        userId,
        channel,
        purpose,
        destination,
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });

    if (channel === OtpChannel.EMAIL) {
      await this.mail.sendMail({
        to: destination,
        subject: 'Your ChrisPa verification code',
        text: `Your ChrisPa verification code is ${code}. It expires in ${ttlMinutes} minutes.`,
      });
    } else {
      await this.sms.sendSms({
        to: destination,
        message: `Your ChrisPa verification code is ${code}. It expires in ${ttlMinutes} minutes.`,
      });
    }
  }

  // Returns true once this channel's most recent (still-live) code matches.
  // Throws on a wrong/expired/already-used code rather than returning false,
  // so the controller can surface a specific message (attempts remaining vs.
  // "request a new code").
  async verify(userId: string, channel: OtpChannel, code: string, purpose: OtpPurpose = OtpPurpose.REGISTRATION) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { userId, channel, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      throw new BadRequestException('No active code for this channel — request a new one');
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts — request a new code');
    }
    if (otp.codeHash !== hashCode(code)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Incorrect code');
    }

    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  }
}
