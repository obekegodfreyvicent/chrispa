import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Africa's Talking has no published TypeScript types — it's a plain CJS
// factory (`require('africastalking')(credentials)`); noImplicitAny is off
// project-wide (see apps/api/tsconfig.json) so this stays untyped `any`
// rather than hand-rolling a declaration file for a single call site.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AfricasTalking = require('africastalking');

export interface SendSmsInput {
  to: string;
  message: string;
}

// SMS delivery for registration OTP (docs/SRS.md FR-8.1/FR-9), via Africa's
// Talking — the Uganda/East-Africa-native gateway chosen over Twilio for
// this project. See .env.example for the AT_* variables; AT_USERNAME
// "sandbox" + a sandbox API key exercises the flow without sending a real
// SMS or spending airtime credit.
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly sms: { send: (opts: { to: string[]; message: string; from?: string }) => Promise<unknown> } | null;
  private readonly senderId: string | undefined;

  constructor(private readonly config: ConfigService) {
    const username = this.config.get<string>('africasTalking.username');
    const apiKey = this.config.get<string>('africasTalking.apiKey');
    this.senderId = this.config.get<string>('africasTalking.senderId');

    if (!username || !apiKey) {
      this.logger.warn(
        'Africa\'s Talking is not configured (AT_USERNAME/AT_API_KEY) — registration SMS will be logged, not sent.',
      );
      this.sms = null;
      return;
    }

    this.sms = AfricasTalking({ username, apiKey }).SMS;
  }

  async sendSms({ to, message }: SendSmsInput) {
    if (!this.sms) {
      this.logger.warn(`Africa's Talking not configured — would have sent SMS to ${to}: ${message}`);
      return;
    }
    await this.sms.send({ to: [to], message, ...(this.senderId ? { from: this.senderId } : {}) });
  }
}
