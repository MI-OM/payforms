import { Controller, Post, Req, Headers, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentService } from '../services/payment.service';

@Controller('webhooks')
@SkipThrottle()
export class WebhookController {
  constructor(private paymentService: PaymentService) {}

  @Post('paystack')
  @HttpCode(HttpStatus.OK)
  async handlePaystackWebhook(
    @Req() req: Request,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const rawBody = (req as any).rawBody;
    if (!signature || !rawBody) {
      throw new BadRequestException('Missing webhook signature or raw body');
    }

    const organizationId = await this.paymentService.validatePaystackWebhookSignature(rawBody, signature);
    if (!organizationId) {
      throw new BadRequestException('Invalid webhook signature');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      throw new BadRequestException('Invalid webhook payload');
    }

    const event = payload.event;
    const eventId = payload.id || payload.data?.id || `${event}:${payload.data?.reference}`;
    await this.paymentService.handleWebhookEvent(organizationId, event, payload.data, eventId);

    return { status: 'success' };
  }
}
