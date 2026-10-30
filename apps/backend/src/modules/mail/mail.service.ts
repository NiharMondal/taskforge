import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

export type SendMailParams = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter<SMTPTransport.SentMessageInfo>;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.getOrThrow<string>("SMTP_HOST");
    const port = Number(this.config.getOrThrow<string>("SMTP_PORT"));
    const user = this.config.getOrThrow<string>("SMTP_USER");
    const pass = this.config.getOrThrow<string>("SMTP_PASS");

    this.from = this.config.get<string>("MAIL_FROM") ?? user;
    this.transporter = createTransport({
      host,
      port,
      // SMTPS (implicit TLS) is used on port 465; STARTTLS is negotiated otherwise.
      secure: this.config.get<string>("SMTP_SECURE") === "true" || port === 465,
      auth: { user, pass },
    });
  }

  async onModuleInit() {
    try {
      await this.transporter.verify();
      this.logger.log("SMTP transport verified and ready");
    } catch (error) {
      this.logger.error(
        `SMTP transport verification failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async sendMail(params: SendMailParams) {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    this.logger.log(
      `Email sent to ${params.to} (messageId: ${info.messageId})`,
    );
    return info;
  }

  /**
   * Send without waiting for SMTP: the caller's response doesn't depend on
   * the email, and how long sending takes reveals nothing about which email
   * went out. A failure is logged, never thrown.
   */
  sendInBackground(params: SendMailParams) {
    void this.sendMail(params).catch((error: unknown) => {
      this.logger.error(
        `Failed to send "${params.subject}" to ${params.to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }
}
