import { BadGatewayException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

export interface InitiatePaymentParams {
  txRef: string;
  amountUgx: number;
  customerEmail: string;
  customerPhone?: string;
  customerName: string;
  redirectUrl: string;
}

export interface VerifiedTransaction {
  id: number;
  txRef: string;
  status: string;
  amount: number;
  currency: string;
}

// PAY-FR-1 (docs/SRS.md §21): real calls against Flutterwave's documented
// v3 REST API (https://developer.flutterwave.com/docs) — plain `fetch`
// rather than their SDK, matching this codebase's preference for not
// pulling in a dependency for what a few REST calls cover. No live
// credentials are configured in this environment (see .env.example) — the
// code path is real and would work once real sandbox keys are added to
// apps/api/.env; it has not been exercised against Flutterwave's live
// sandbox in this session.
@Injectable()
export class FlutterwaveService {
  constructor(private readonly config: ConfigService) {}

  private secretKey(): string {
    const key = this.config.get<string>('flutterwave.secretKey');
    if (!key || key.includes('change-me')) {
      throw new InternalServerErrorException(
        'Flutterwave is not configured — set FLUTTERWAVE_SECRET_KEY in apps/api/.env to a real sandbox/live key.',
      );
    }
    return key;
  }

  // Standard/hosted-checkout flow: returns a URL to redirect the customer
  // to. Flutterwave handles the actual card/Mobile Money entry UI — this
  // app never touches a raw card number or Mobile Money PIN, the same
  // PCI-avoidance stance already documented for saved payment methods
  // (see docs/SRS.md FR-16.3).
  async initiatePayment(params: InitiatePaymentParams): Promise<{ checkoutUrl: string }> {
    // Resolved outside the try block below — secretKey()'s "not configured"
    // error is a distinct failure mode from a network/fetch failure, and
    // must not be recategorized as "could not reach Flutterwave" by the
    // catch that's only meant to handle the latter.
    const authHeader = `Bearer ${this.secretKey()}`;
    let res: Response;
    try {
      res = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx_ref: params.txRef,
          amount: params.amountUgx,
          currency: 'UGX',
          redirect_url: params.redirectUrl,
          customer: { email: params.customerEmail, phonenumber: params.customerPhone, name: params.customerName },
          customizations: { title: 'ChrisPa Scents and Soaps LTD', description: 'Order payment' },
        }),
      });
    } catch {
      throw new BadGatewayException('Could not reach Flutterwave — try again shortly.');
    }

    const body = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: { link?: string } } | null;
    if (!res.ok || body?.status !== 'success' || !body.data?.link) {
      throw new BadGatewayException(body?.message ?? 'Flutterwave could not initiate this payment.');
    }
    return { checkoutUrl: body.data.link };
  }

  // Never trust a webhook payload's stated status alone (a classic gateway-
  // integration mistake) — this re-asks Flutterwave server-to-server for
  // the authoritative transaction state, per their documented best
  // practice, before PaymentsService acts on it.
  async verifyTransaction(transactionId: string): Promise<VerifiedTransaction> {
    const authHeader = `Bearer ${this.secretKey()}`;
    let res: Response;
    try {
      res = await fetch(`${FLUTTERWAVE_BASE_URL}/transactions/${transactionId}/verify`, {
        headers: { Authorization: authHeader },
      });
    } catch {
      throw new BadGatewayException('Could not reach Flutterwave to verify this transaction.');
    }

    const body = (await res.json().catch(() => null)) as {
      status?: string;
      message?: string;
      data?: { id?: number; tx_ref?: string; status?: string; amount?: number; currency?: string };
    } | null;
    if (!res.ok || body?.status !== 'success' || !body.data) {
      throw new BadGatewayException(body?.message ?? 'Could not verify this transaction with Flutterwave.');
    }
    return {
      id: body.data.id!,
      txRef: body.data.tx_ref!,
      status: body.data.status!,
      amount: body.data.amount!,
      currency: body.data.currency!,
    };
  }

  // PAY-FR-4: real refund call. Flutterwave processes refunds against the
  // original transaction id (not the tx_ref), asynchronously — a successful
  // response here means the refund was *accepted*, not necessarily that
  // funds have moved yet; this codebase doesn't currently listen for a
  // separate refund-completed webhook, a documented gap.
  async refundTransaction(transactionId: string, amountUgx?: number): Promise<void> {
    const authHeader = `Bearer ${this.secretKey()}`;
    let res: Response;
    try {
      res = await fetch(`${FLUTTERWAVE_BASE_URL}/transactions/${transactionId}/refund`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(amountUgx ? { amount: amountUgx } : {}),
      });
    } catch {
      throw new BadGatewayException('Could not reach Flutterwave to process this refund.');
    }
    const body = (await res.json().catch(() => null)) as { status?: string; message?: string } | null;
    if (!res.ok || body?.status !== 'success') {
      throw new BadGatewayException(body?.message ?? 'Flutterwave could not process this refund.');
    }
  }

  // Constant-time-ish comparison isn't critical here (unlike a crypto MAC)
  // since this is a simple shared-secret string equality check, the same
  // mechanism Flutterwave itself documents (compare the `verif-hash` header
  // against the value you configured in their dashboard).
  verifyWebhookSignature(headerHash: string | undefined): boolean {
    const expected = this.config.get<string>('flutterwave.secretHash');
    return !!expected && !expected.includes('change-me') && headerHash === expected;
  }
}
