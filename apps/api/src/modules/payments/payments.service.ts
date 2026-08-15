import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RevenueRecognitionService } from '../finance/revenue-recognition.service';
import { FlutterwaveService } from './flutterwave.service';

interface WebhookPayload {
  event?: string;
  data?: { tx_ref?: string; id?: number | string; status?: string; amount?: number; currency?: string };
}

// PAY-FR-1..4 (docs/SRS.md §21): orchestrates a Flutterwave charge against
// an order and its eventual webhook confirmation. Checkout still creates
// the Order synchronously (as it always did for Cash on Delivery) — for a
// prepaid method, CheckoutService additionally calls initiateForOrder() and
// returns the resulting checkoutUrl for the frontend to redirect the
// customer to. The order exists (and stock is already decremented) before
// payment succeeds; there's no reservation/cleanup job for an order whose
// payment is never completed — a real gap, tracked as follow-up work, not
// silently glossed over.
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flutterwave: FlutterwaveService,
    private readonly revenueRecognition: RevenueRecognitionService,
  ) {}

  async initiateForOrder(
    order: { id: string; orderNumber: string; totalUgx: number },
    customer: { email: string; phone?: string; name: string },
    redirectUrl: string,
  ): Promise<{ checkoutUrl: string }> {
    const txRef = `CP-PAY-${randomUUID()}`;
    await this.prisma.paymentTransaction.create({
      data: { orderId: order.id, provider: 'FLUTTERWAVE', providerReference: txRef, amountUgx: order.totalUgx, status: 'PENDING' },
    });
    return this.flutterwave.initiatePayment({
      txRef,
      amountUgx: order.totalUgx,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerName: customer.name,
      redirectUrl,
    });
  }

  // Never trusts the webhook body's stated status alone — re-verifies
  // server-to-server via FlutterwaveService.verifyTransaction() before
  // marking anything SUCCESSFUL, per Flutterwave's documented best practice
  // and standard payment-integration hygiene (a webhook endpoint is public
  // by necessity; the signature check proves the *sender*, verification
  // proves the *content*).
  async handleWebhook(headerHash: string | undefined, payload: WebhookPayload) {
    if (!this.flutterwave.verifyWebhookSignature(headerHash)) {
      throw new UnauthorizedException('Invalid or missing webhook signature.');
    }
    const txRef = payload?.data?.tx_ref;
    const transactionId = payload?.data?.id;
    if (!txRef || transactionId === undefined) {
      throw new BadRequestException('Malformed webhook payload — missing tx_ref or transaction id.');
    }

    const transaction = await this.prisma.paymentTransaction.findUnique({ where: { providerReference: txRef } });
    if (!transaction) {
      this.logger.warn(`Webhook for unknown tx_ref ${txRef} — ignoring.`);
      return;
    }
    if (transaction.status !== 'PENDING') {
      return; // already processed — webhooks can legitimately be retried/duplicated
    }

    const verified = await this.flutterwave.verifyTransaction(String(transactionId));
    const isSuccessful =
      verified.txRef === txRef &&
      verified.status === 'successful' &&
      verified.currency === 'UGX' &&
      verified.amount >= transaction.amountUgx;

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: isSuccessful ? 'SUCCESSFUL' : 'FAILED',
        providerTransactionId: String(transactionId),
        failureReason: isSuccessful ? null : `Flutterwave reported status "${verified.status}" (or amount/currency mismatch).`,
      },
    });

    if (isSuccessful && transaction.orderId) {
      await this.revenueRecognition.recordDeferredRevenue(transaction.orderId);
    }
  }

  // PAY-FR-4 (Refund and Chargeback Management, docs/SRS.md §21): called
  // from OrdersService when an order with a successful prepaid transaction
  // moves to CANCELLED/REFUNDED — see the note there. `feeUgx` is whatever
  // processing/chargeback fee applies; Flutterwave doesn't return one
  // synchronously from the refund call itself, so this accepts it as a
  // parameter rather than inventing a figure.
  async refundForOrder(orderId: string, feeUgx?: number) {
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { orderId, status: 'SUCCESSFUL' },
      orderBy: { createdAt: 'desc' },
    });
    if (!transaction) {
      throw new NotFoundException('No successful payment transaction found for this order — nothing to refund via the gateway.');
    }
    if (!transaction.providerTransactionId) {
      throw new BadRequestException('This transaction has no provider transaction id on record — cannot refund via the gateway.');
    }

    await this.flutterwave.refundTransaction(transaction.providerTransactionId, transaction.amountUgx);
    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: 'REFUNDED', feeUgx },
    });
    await this.revenueRecognition.reverseForOrder(orderId, feeUgx);
  }
}
