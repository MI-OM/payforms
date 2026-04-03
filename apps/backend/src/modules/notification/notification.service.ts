import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { Contact } from '../contact/entities/contact.entity';

type EmailProvider = 'sendgrid' | 'mailgun' | 'brevo';

@Injectable()
export class NotificationService {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
  ) {}

  async getContactEmail(organizationId: string, contactId: string) {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: organizationId },
      select: ['email'],
    });
    return contact?.email;
  }

  async getGroupContactEmails(organizationId: string, groupIds: string[]) {
    if (!groupIds.length) {
      return [];
    }

    const contacts = await this.contactRepository
      .createQueryBuilder('contact')
      .innerJoin('contact.groups', 'group')
      .where('contact.organization_id = :organizationId', { organizationId })
      .andWhere('group.id IN (:...groupIds)', { groupIds })
      .andWhere('contact.email IS NOT NULL')
      .andWhere("TRIM(contact.email) <> ''")
      .select(['contact.email'])
      .distinct(true)
      .getMany();

    const normalizedEmails = contacts
      .map(contact => contact.email?.trim().toLowerCase())
      .filter((email): email is string => !!email);

    return Array.from(new Set(normalizedEmails));
  }

  private getEmailProvider(): EmailProvider {
    const configuredProvider = this.configService.get<string>('EMAIL_PROVIDER');
    const provider = (configuredProvider || 'sendgrid').toLowerCase();

    if (provider !== 'sendgrid' && provider !== 'mailgun' && provider !== 'brevo') {
      throw new BadRequestException('Invalid EMAIL_PROVIDER. Supported values: sendgrid, mailgun, brevo');
    }

    return provider;
  }

  private getProviderApiKey(provider: EmailProvider) {
    const envKeyByProvider: Record<EmailProvider, string> = {
      sendgrid: 'SENDGRID_API_KEY',
      mailgun: 'MAILGUN_API_KEY',
      brevo: 'BREVO_API_KEY',
    };

    const envKey = envKeyByProvider[provider];
    const apiKey = this.configService.get<string>(envKey);
    if (!apiKey) {
      throw new BadRequestException(`${envKey} is not configured`);
    }

    return apiKey;
  }

  private getFromAddress() {
    const fromAddress =
      this.configService.get<string>('EMAIL_FROM') ||
      this.configService.get<string>('SENDGRID_FROM_EMAIL');

    if (!fromAddress) {
      throw new BadRequestException('Email from address is not configured (set EMAIL_FROM)');
    }

    return fromAddress;
  }

  private async sendViaSendGrid(apiKey: string, recipients: string[], subject: string, html: string) {
    const fromAddress = this.getFromAddress();

    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [
          {
            to: recipients.map(email => ({ email })),
            subject,
          },
        ],
        from: { email: fromAddress },
        content: [
          {
            type: 'text/html',
            value: html,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  private async sendViaMailgun(apiKey: string, recipients: string[], subject: string, html: string) {
    const domain = this.configService.get<string>('MAILGUN_DOMAIN');
    if (!domain) {
      throw new BadRequestException('MAILGUN_DOMAIN is not configured');
    }

    const fromAddress =
      this.configService.get<string>('MAILGUN_FROM') || this.getFromAddress();
    const baseUrl = (this.configService.get<string>('MAILGUN_BASE_URL') || 'https://api.mailgun.net/v3').replace(/\/$/, '');
    const endpoint = `${baseUrl}/${domain}/messages`;

    const form = new URLSearchParams();
    form.append('from', fromAddress);
    for (const recipient of recipients) {
      form.append('to', recipient);
    }
    form.append('subject', subject);
    form.append('html', html);

    await axios.post(endpoint, form.toString(), {
      auth: {
        username: 'api',
        password: apiKey,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  private async sendViaBrevo(apiKey: string, recipients: string[], subject: string, html: string) {
    const fromAddress =
      this.configService.get<string>('BREVO_FROM') || this.getFromAddress();
    const fromName = this.configService.get<string>('EMAIL_FROM_NAME') || 'Payforms';
    const baseUrl = (this.configService.get<string>('BREVO_API_BASE_URL') || 'https://api.brevo.com/v3').replace(/\/$/, '');
    const endpoint = `${baseUrl}/smtp/email`;

    await axios.post(
      endpoint,
      {
        sender: {
          email: fromAddress,
          name: fromName,
        },
        to: recipients.map(email => ({ email })),
        subject,
        htmlContent: html,
      },
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  async sendEmail(recipients: string[], subject: string, html: string) {
    if (!recipients.length) {
      throw new BadRequestException('At least one email recipient is required');
    }

    const provider = this.getEmailProvider();
    const apiKey = this.getProviderApiKey(provider);

    try {
      if (provider === 'mailgun') {
        await this.sendViaMailgun(apiKey, recipients, subject, html);
        return;
      }

      if (provider === 'brevo') {
        await this.sendViaBrevo(apiKey, recipients, subject, html);
        return;
      }

      await this.sendViaSendGrid(apiKey, recipients, subject, html);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error(`Email send error (${provider}):`, error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  async sendPaymentConfirmation(organization: Organization, recipientEmail: string, amount: number, reference: string) {
    const subject = `${organization.name} Payment Confirmation`;
    const html = `
      <p>Thank you for your payment to ${organization.name}.</p>
      <p><strong>Reference:</strong> ${reference}</p>
      <p><strong>Amount:</strong> ₦${amount.toFixed(2)}</p>
      ${organization.logo_url ? `<img src="${organization.logo_url}" alt="${organization.name}" style="max-width: 200px;"/>` : ''}
    `;
    return this.sendEmail([recipientEmail], subject, html);
  }

  async sendSubmissionConfirmation(organization: Organization, recipientEmail: string, formTitle: string, amount: number, reference: string) {
    const subject = `${organization.name} Submission Received`;
    const html = `
      <p>Your submission for <strong>${formTitle}</strong> has been received.</p>
      <p>Amount due: ₦${amount.toFixed(2)}</p>
      <p>Payment reference: <strong>${reference}</strong></p>
      ${organization.logo_url ? `<img src="${organization.logo_url}" alt="${organization.name}" style="max-width: 200px;"/>` : ''}
    `;
    return this.sendEmail([recipientEmail], subject, html);
  }

  async sendFailedPaymentReminder(organization: Organization, recipientEmail: string, amount: number, reference: string) {
    const subject = `${organization.name} Payment Attempt Failed`;
    const html = `
      <p>Your payment attempt for ${organization.name} was not successful.</p>
      <p>Amount: ₦${amount.toFixed(2)}</p>
      <p>Reference: <strong>${reference}</strong></p>
      <p>Please retry your payment using the original link or contact the form owner for support.</p>
    `;
    return this.sendEmail([recipientEmail], subject, html);
  }

  async sendReminder(recipients: string[], message: string) {
    const subject = 'Payment Reminder';
    const html = `<p>${message}</p>`;
    return this.sendEmail(recipients, subject, html);
  }

  async sendPasswordResetEmail(organization: Organization | null, recipientEmail: string, resetLink: string) {
    const subject = `${organization?.name || 'Payforms'} Password Reset Request`;
    const html = `
      <p>You have requested to reset your password.</p>
      <p>Please use the link below to reset your password:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `;
    return this.sendEmail([recipientEmail], subject, html);
  }

  async sendOrganizationEmailVerificationEmail(organization: Organization, recipientEmail: string, verificationLink: string) {
    const subject = `${organization.name} Email Verification`;
    const html = `
      <p>Please verify your organization email address for ${organization.name}.</p>
      <p>Use the link below to complete verification:</p>
      <p><a href="${verificationLink}">${verificationLink}</a></p>
      <p>If you did not request this, ignore this email.</p>
    `;
    return this.sendEmail([recipientEmail], subject, html);
  }
}
