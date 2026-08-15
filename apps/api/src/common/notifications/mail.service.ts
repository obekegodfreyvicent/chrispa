import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// SMTP delivery for registration OTP (docs/SRS.md FR-8.1/FR-9) — the
// "temp password" gap this codebase called out repeatedly ("no email/SMS
// delivery channel exists") for OTP/invites. Deliberately generic SMTP via
// nodemailer rather than a single vendor's API, so any SMTP account (Gmail
// app password, a domain mailbox, Mailtrap for local dev) works — see
// .env.example for the SMTP_* variables.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('smtp.host');
    const user = this.config.get<string>('smtp.user');
    const pass = this.config.get<string>('smtp.pass');
    this.from = this.config.get<string>('smtp.from')!;

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS) — registration emails will be logged, not sent.',
      );
      this.transport = null;
      return;
    }

    this.transport = nodemailer.createTransport({
      host,
      port: this.config.get<number>('smtp.port'),
      secure: this.config.get<boolean>('smtp.secure'),
      auth: { user, pass },
      // Render's network has no outbound IPv6 route to Gmail's SMTP
      // endpoint — connecting over the AAAA record hangs for ~a minute
      // then fails with ENETUNREACH (confirmed in production), leaving an
      // orphaned unverified user row and a failed registration request.
      // Forcing IPv4 avoids that route entirely.
      family: 4,
    });
  }

  async sendMail({ to, subject, text, html }: SendMailInput) {
    if (!this.transport) {
      this.logger.warn(`SMTP not configured — would have sent "${subject}" to ${to}: ${text}`);
      return;
    }
    await this.transport.sendMail({ from: this.from, to, subject, text, html });
  }
}
