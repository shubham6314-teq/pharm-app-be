import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | undefined;

  constructor(private readonly configService: ConfigService) {}

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'Pharma App <noreply@localhost>';

    const info = await this.getTransporter().sendMail({
      from,
      to: email,
      subject: 'Reset your password',
      text: `Use this link to reset your password: ${resetUrl}`,
      html: `<p>Use this link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    if (!this.hasSmtpHost()) {
      this.logger.log(
        `SMTP is not configured; password reset email was not delivered to ${email}.`,
      );
      this.logger.debug(`Nodemailer json transport payload: ${info.message}`);
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    if (!this.hasSmtpHost()) {
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      return this.transporter;
    }

    const host = this.configService.getOrThrow<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass: pass ?? '' } : undefined,
    });

    return this.transporter;
  }

  private hasSmtpHost(): boolean {
    const host = this.configService.get<string>('SMTP_HOST');
    return Boolean(host && host.trim());
  }
}
