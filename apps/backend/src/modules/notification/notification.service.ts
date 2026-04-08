import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { In, Repository } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { Contact } from '../contact/entities/contact.entity';
import { User } from '../auth/entities/user.entity';
import { InternalNotification } from './entities/internal-notification.entity';

type EmailProvider = 'sendgrid' | 'mailgun' | 'brevo';

type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  type?: string;
};

@Injectable()
export class NotificationService {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(InternalNotification)
    private internalNotificationRepository: Repository<InternalNotification>,
  ) {}

  private trimOptionalValue(value?: string | null) {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  private formatAmount(amount: number | string) {
    const value = typeof amount === 'string' ? Number(amount) : amount;
    if (Number.isNaN(value) || typeof value !== 'number') {
      return `₦${amount}`;
    }
    return `₦${value.toFixed(2)}`;
  }

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
    const configuredProvider = this.trimOptionalValue(this.configService.get<string>('EMAIL_PROVIDER'));
    if (configuredProvider) {
      const provider = configuredProvider.toLowerCase();
      if (provider !== 'sendgrid' && provider !== 'mailgun' && provider !== 'brevo') {
        throw new BadRequestException('Invalid EMAIL_PROVIDER. Supported values: sendgrid, mailgun, brevo');
      }

      return provider as EmailProvider;
    }

    // Fallback auto-detection allows deployments to work when EMAIL_PROVIDER is omitted.
    const hasMailgun = !!this.trimOptionalValue(this.configService.get<string>('MAILGUN_API_KEY'))
      && !!this.trimOptionalValue(this.configService.get<string>('MAILGUN_DOMAIN'));
    if (hasMailgun) {
      return 'mailgun';
    }

    const hasBrevo = !!this.trimOptionalValue(this.configService.get<string>('BREVO_API_KEY'));
    if (hasBrevo) {
      return 'brevo';
    }

    return 'sendgrid';
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

  private async sendViaSendGrid(
    apiKey: string,
    recipients: string[],
    subject: string,
    html: string,
    attachments?: EmailAttachment[],
  ) {
    const fromAddress = this.getFromAddress();
    const payload: any = {
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
    };

    if (attachments?.length) {
      payload.attachments = attachments.map(att => ({
        content: typeof att.content === 'string'
          ? Buffer.from(att.content, 'utf-8').toString('base64')
          : att.content.toString('base64'),
        filename: att.filename,
        type: att.type || 'application/pdf',
        disposition: 'attachment',
      }));
    }

    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  private async sendViaMailgun(
    apiKey: string,
    recipients: string[],
    subject: string,
    html: string,
    attachments?: EmailAttachment[],
  ) {
    const domain = this.configService.get<string>('MAILGUN_DOMAIN');
    if (!domain) {
      throw new BadRequestException('MAILGUN_DOMAIN is not configured');
    }

    const fromAddress =
      this.configService.get<string>('MAILGUN_FROM') || this.getFromAddress();
    const baseUrl = (this.configService.get<string>('MAILGUN_BASE_URL') || 'https://api.mailgun.net/v3').replace(/\/$/, '');
    const endpoint = `${baseUrl}/${domain}/messages`;

    if (!attachments?.length) {
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
      return;
    }

    const FormData = require('form-data');
    const form = new FormData();
    form.append('from', fromAddress);
    for (const recipient of recipients) {
      form.append('to', recipient);
    }
    form.append('subject', subject);
    form.append('html', html);

    for (const attachment of attachments) {
      form.append('attachment', attachment.content, {
        filename: attachment.filename,
        contentType: attachment.type || 'application/pdf',
      });
    }

    await axios.post(endpoint, form, {
      auth: {
        username: 'api',
        password: apiKey,
      },
      headers: {
        ...form.getHeaders(),
      },
    });
  }

  private async sendViaBrevo(
    apiKey: string,
    recipients: string[],
    subject: string,
    html: string,
    attachments?: EmailAttachment[],
  ) {
    const fromAddress =
      this.configService.get<string>('BREVO_FROM') || this.getFromAddress();
    const fromName = this.configService.get<string>('EMAIL_FROM_NAME') || 'Payforms';
    const baseUrl = (this.configService.get<string>('BREVO_API_BASE_URL') || 'https://api.brevo.com/v3').replace(/\/$/, '');
    const endpoint = `${baseUrl}/smtp/email`;

    const payload: any = {
      sender: {
        email: fromAddress,
        name: fromName,
      },
      to: recipients.map(email => ({ email })),
      subject,
      htmlContent: html,
    };

    if (attachments?.length) {
      payload.attachment = attachments.map(att => ({
        content: typeof att.content === 'string'
          ? Buffer.from(att.content, 'utf-8').toString('base64')
          : att.content.toString('base64'),
        name: att.filename,
        type: att.type || 'application/pdf',
      }));
    }

    await axios.post(
      endpoint,
      payload,
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  async sendEmail(recipients: string[], subject: string, html: string, attachments?: EmailAttachment[]) {
      const normalizedRecipients = Array.from(new Set(
        recipients
          .map(recipient => this.trimOptionalValue(recipient)?.toLowerCase())
          .filter((recipient): recipient is string => !!recipient),
      ));

      if (!normalizedRecipients.length) {
      throw new BadRequestException('At least one email recipient is required');
    }

    const provider = this.getEmailProvider();
    const apiKey = this.getProviderApiKey(provider);

    try {
        for (const recipient of normalizedRecipients) {
          if (provider === 'mailgun') {
            await this.sendViaMailgun(apiKey, [recipient], subject, html, attachments);
            continue;
          }

          if (provider === 'brevo') {
            await this.sendViaBrevo(apiKey, [recipient], subject, html, attachments);
            continue;
          }

          await this.sendViaSendGrid(apiKey, [recipient], subject, html, attachments);
        }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error(`Email send error (${provider}):`, {
        message: (error as any)?.message,
        status: (error as any)?.response?.status,
        data: (error as any)?.response?.data,
      });
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  async sendPaymentConfirmation(
    organization: Organization,
    recipientEmail: string,
    amount: number | string,
    reference: string,
    attachments?: EmailAttachment[],
  ) {
    const subject = `${organization.name} Payment Receipt`;
    const transactionDate = new Date().toUTCString();
    const gateway = 'Paystack';

    const organizationContact = organization.email ? `<p style="margin: 0; color: #4a5568;">If you need help, please contact <strong>${organization.name}</strong> at <a href="mailto:${organization.email}" style="color: #2b6cb0; text-decoration: none;">${organization.email}</a>.</p>` : '<p style="margin: 0; color: #4a5568;">If you need help, please contact the recipient organization directly or reply to this email.</p>';

    const html = `
      <div style="font-family: Arial, sans-serif; color: #2d3748; background: #f7fafc; padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 8px 24px rgba(45, 55, 72, 0.08);">
          <div style="padding: 24px; background: #1a202c; color: #ffffff; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
            <div>
              <h1 style="margin: 0; font-size: 22px; letter-spacing: 0.4px;">Payment Receipt</h1>
              <p style="margin: 6px 0 0 0; font-size: 14px; color: #cbd5e0;">Reference: ${reference}</p>
            </div>
            ${organization.logo_url ? `<img src="${organization.logo_url}" alt="${organization.name}" style="max-height: 48px; object-fit: contain;"/>` : ''}
          </div>

          <div style="padding: 24px;">
            <p style="margin: 0 0 24px 0; font-size: 16px; color: #4a5568;">Your payment has been successfully processed. Below is a summary of the transaction.</p>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tbody>
                <tr style="background: #f7fafc;">
                  <td style="padding: 14px 16px; color: #718096; width: 45%;"><strong>Transaction Date</strong></td>
                  <td style="padding: 14px 16px; color: #2d3748;">${transactionDate}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; border-top: 1px solid #edf2f7; color: #718096;"><strong>Payment Gateway</strong></td>
                  <td style="padding: 14px 16px; border-top: 1px solid #edf2f7; color: #2d3748;">${gateway}</td>
                </tr>
                <tr style="background: #f7fafc;">
                  <td style="padding: 14px 16px; border-top: 1px solid #edf2f7; color: #718096;"><strong>Organization</strong></td>
                  <td style="padding: 14px 16px; border-top: 1px solid #edf2f7; color: #2d3748;">${organization.name}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; border-top: 1px solid #edf2f7; color: #718096;"><strong>Amount Paid</strong></td>
                  <td style="padding: 14px 16px; border-top: 1px solid #edf2f7; color: #2d3748; font-weight: 600;">${this.formatAmount(amount)}</td>
                </tr>
              </tbody>
            </table>

            ${organizationContact}
          </div>
        </div>
      </div>
    `;

    return this.sendEmail([recipientEmail], subject, html, attachments);
  }

  async sendSubmissionConfirmation(
    organization: Organization,
    recipientEmail: string,
    formTitle: string,
    amount: number | string,
    reference: string,
  ) {
    const subject = `${organization.name} Submission Received`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #2d3748; background: #f7fafc; padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
          <div style="padding: 24px; background: #1a202c; color: #ffffff;">
            <h1 style="margin: 0; font-size: 20px;">Submission Confirmed</h1>
          </div>
          <div style="padding: 24px;">
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #4a5568;">Your submission for <strong>${formTitle}</strong> has been received successfully.</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #edf2f7; color: #718096; width: 45%;"><strong>Amount due</strong></td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #edf2f7; color: #2d3748;">${this.formatAmount(amount)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; color: #718096;"><strong>Reference</strong></td>
                  <td style="padding: 12px 16px; color: #2d3748;">${reference}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    return this.sendEmail([recipientEmail], subject, html);
  }

  async sendFailedPaymentReminder(
    organization: Organization,
    recipientEmail: string,
    amount: number | string,
    reference: string,
  ) {
    const subject = `${organization.name} Payment Attempt Failed`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #2d3748; background: #f7fafc; padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
          <div style="padding: 24px; background: #c53030; color: #ffffff;">
            <h1 style="margin: 0; font-size: 20px;">Payment Failed</h1>
          </div>
          <div style="padding: 24px;">
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #4a5568;">We were unable to process your payment.</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #edf2f7; color: #718096; width: 45%;"><strong>Amount</strong></td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #edf2f7; color: #2d3748;">${this.formatAmount(amount)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; color: #718096;"><strong>Reference</strong></td>
                  <td style="padding: 12px 16px; color: #2d3748;">${reference}</td>
                </tr>
              </tbody>
            </table>
            <p style="margin: 16px 0 0 0; color: #4a5568;">Please retry your payment or contact the form owner for assistance.</p>
          </div>
        </div>
      </div>
    `;
    return this.sendEmail([recipientEmail], subject, html);
  }

  async sendReminder(recipients: string[], message: string) {
    const subject = 'Payment Reminder';
    const html = `<p>${message}</p>`;
    return this.sendEmail(recipients, subject, html);
  }

  async createInternalNotification(
    organizationId: string,
    createdByUserId: string,
    input: { title: string; body: string; user_ids?: string[] },
  ) {
    const title = this.trimOptionalValue(input.title);
    const body = this.trimOptionalValue(input.body);
    const userIds = Array.from(new Set(
      (input.user_ids || [])
        .map(userId => this.trimOptionalValue(userId))
        .filter((userId): userId is string => !!userId),
    ));

    if (!title || !body) {
      throw new BadRequestException('title and body are required');
    }

    if (userIds.length) {
      const users = await this.userRepository.find({
        where: { organization_id: organizationId, id: In(userIds) },
        select: ['id'],
      });
      if (users.length !== userIds.length) {
        throw new BadRequestException('One or more user_ids are invalid for this organization');
      }
    }

    const notification = await this.internalNotificationRepository.save(
      this.internalNotificationRepository.create({
        organization_id: organizationId,
        created_by_user_id: createdByUserId,
        title,
        body,
        audience_type: userIds.length ? 'SELECTED_USERS' : 'ALL_USERS',
        target_user_ids: userIds.length ? userIds : null,
        read_by_user_ids: [createdByUserId],
        metadata: null,
      }),
    );

    return this.mapInternalNotification(notification, createdByUserId);
  }

  async listInternalNotifications(
    organizationId: string,
    userId: string,
    page: number,
    limit: number,
    unreadOnly = false,
  ) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;

    const query = this.internalNotificationRepository
      .createQueryBuilder('notification')
      .where('notification.organization_id = :organizationId', { organizationId })
      .andWhere(`(
        notification.audience_type = 'ALL_USERS'
        OR :userId = ANY(COALESCE(notification.target_user_ids, ARRAY[]::uuid[]))
      )`, { userId });

    if (unreadOnly) {
      query.andWhere('NOT (:userId = ANY(COALESCE(notification.read_by_user_ids, ARRAY[]::uuid[])))', { userId });
    }

    const [notifications, total] = await query
      .orderBy('notification.created_at', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return {
      data: notifications.map(notification => this.mapInternalNotification(notification, userId)),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async markInternalNotificationRead(organizationId: string, userId: string, notificationId: string) {
    const notification = await this.internalNotificationRepository
      .createQueryBuilder('notification')
      .where('notification.id = :notificationId', { notificationId })
      .andWhere('notification.organization_id = :organizationId', { organizationId })
      .andWhere(`(
        notification.audience_type = 'ALL_USERS'
        OR :userId = ANY(COALESCE(notification.target_user_ids, ARRAY[]::uuid[]))
      )`, { userId })
      .getOne();

    if (!notification) {
      throw new BadRequestException('Internal notification not found');
    }

    notification.read_by_user_ids = Array.from(new Set([...(notification.read_by_user_ids || []), userId]));
    const saved = await this.internalNotificationRepository.save(notification);
    return this.mapInternalNotification(saved, userId);
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

  private mapInternalNotification(notification: InternalNotification, userId: string) {
    return {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      audience_type: notification.audience_type,
      target_user_ids: notification.target_user_ids || [],
      is_read: (notification.read_by_user_ids || []).includes(userId),
      created_by_user_id: notification.created_by_user_id,
      created_at: notification.created_at,
      metadata: notification.metadata,
    };
  }
}
