import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve4 } from 'dns/promises';
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
  private readonly from: string;
  private readonly host?: string;
  private readonly user?: string;
  private readonly pass?: string;
  private transportPromise: Promise<nodemailer.Transporter> | null = null;

  constructor(private readonly config: ConfigService) {
    this.host = this.config.get<string>('smtp.host');
    this.user = this.config.get<string>('smtp.user');
    this.pass = this.config.get<string>('smtp.pass');
    this.from = this.config.get<string>('smtp.from')!;

    if (!this.host || !this.user || !this.pass) {
      this.logger.warn(
        'SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS) — registration emails will be logged, not sent.',
      );
    }
  }

  // Render's network has no outbound IPv6 route to Gmail's SMTP endpoint —
  // and nodemailer resolves both A/AAAA records and picks one at random
  // per connection (see nodemailer/lib/shared's resolveHostname), so
  // roughly half of all send attempts hung for ~a minute on the
  // unreachable AAAA address before failing with ENETUNREACH (confirmed
  // in production). Resolving to a literal IPv4 address ourselves and
  // passing it as `host` sidesteps nodemailer's resolver entirely — a
  // literal IP short-circuits it (see the `net.isIP` check in
  // resolveHostname). `tls.servername` keeps SNI/cert hostname
  // verification pointed at the real hostname despite connecting by IP.
  private async buildTransport(host: string, user: string, pass: string) {
    let connectHost = host;
    try {
      const addresses = await resolve4(host);
      if (addresses.length > 0) connectHost = addresses[0];
    } catch (err) {
      this.logger.warn(`IPv4 resolution for ${host} failed, falling back to hostname: ${err}`);
    }
    return nodemailer.createTransport({
      host: connectHost,
      port: this.config.get<number>('smtp.port'),
      secure: this.config.get<boolean>('smtp.secure'),
      auth: { user, pass },
      tls: { servername: host },
    });
  }

  async sendMail({ to, subject, text, html }: SendMailInput) {
    if (!this.host || !this.user || !this.pass) {
      this.logger.warn(`SMTP not configured — would have sent "${subject}" to ${to}: ${text}`);
      return;
    }
    this.transportPromise ??= this.buildTransport(this.host, this.user, this.pass);
    const transport = await this.transportPromise;
    await transport.sendMail({ from: this.from, to, subject, text, html });
  }
}
