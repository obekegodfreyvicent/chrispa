import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

// Email delivery for registration OTP (docs/SRS.md FR-8.1/FR-9) — via
// Brevo's transactional HTTP API, not SMTP. Render's free web services
// block all outbound SMTP traffic (ports 25/465/587) as of Sep 2025
// (https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)
// — confirmed live as consistent ~45s "Connection timeout" failures
// against both a Gmail App Password and Brevo's own SMTP relay, same
// credentials work fine over Brevo's REST API (HTTPS/443, unaffected by
// the block). This does lock delivery to Brevo specifically, trading away
// the earlier "any SMTP account works" generality — a deliberate choice to
// stay on Render's free plan rather than pay just to unblock SMTP ports.
// See .env.example for BREVO_API_KEY/EMAIL_FROM_*.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey?: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('brevo.apiKey');
    this.fromEmail = this.config.get<string>('brevo.fromEmail')!;
    this.fromName = this.config.get<string>('brevo.fromName')!;

    if (!this.apiKey) {
      this.logger.warn('Brevo is not configured (BREVO_API_KEY) — registration emails will be logged, not sent.');
    }
  }

  async sendMail({ to, subject, text, html }: SendMailInput) {
    if (!this.apiKey) {
      this.logger.warn(`Brevo not configured — would have sent "${subject}" to ${to}: ${text}`);
      return;
    }

    const response = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: this.fromName, email: this.fromEmail },
        to: [{ email: to }],
        subject,
        textContent: text,
        ...(html ? { htmlContent: html } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Brevo API error ${response.status}: ${body}`);
    }
  }
}
