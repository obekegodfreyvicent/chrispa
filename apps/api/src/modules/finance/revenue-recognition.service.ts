import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SYSTEM_ACTOR } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JournalService } from './journal.service';

interface OrderForRecognition {
  id: string;
  orderNumber: string;
  totalUgx: number;
  vatUgx: number;
  shippingFeeUgx: number;
  discountUgx: number;
  paymentMethod: string | null;
  items: {
    id: string;
    qty: number;
    unitPriceUgx: number;
    vendorId: string | null;
    costUgxSnapshot: number | null;
    vendor: { commissionRatePercent: Prisma.Decimal } | null;
  }[];
}

// FIN-FR-8 (docs/SRS.md §21): "records income when earned, not just when
// paid." For Cash on Delivery, payment and delivery are the same real-world
// moment, so nothing is deferred. For a prepaid order (Mobile Money/Card via
// Flutterwave), payment happens at checkout but the sale isn't *earned*
// until the goods are actually delivered — recordDeferredRevenue() parks
// the cash as a liability at payment success, and recognizeRevenue() (order
// DELIVERED) is what actually credits Sales Revenue. Every posting here is
// best-effort and never blocks the commerce flow it's attached to: if the
// Finance module hasn't been set up yet (no group root LegalEntity), or
// posting fails for any reason, this logs and returns rather than throwing
// — a missing/broken ledger must never stop an order from shipping.
@Injectable()
export class RevenueRecognitionService {
  private readonly logger = new Logger(RevenueRecognitionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  // ChrisPa's own ledger — the group's root LegalEntity (parentEntityId:
  // null). Vendor commission/payable postings live here too, on the
  // reasoning that the marketplace platform itself is what ChrisPa (the
  // parent) operates — a vendor is a counterparty to the platform, not a
  // LegalEntity of its own.
  private async homeEntity() {
    return this.prisma.legalEntity.findFirst({ where: { parentEntityId: null } });
  }

  private async accountId(entityId: string, code: string): Promise<string | null> {
    const account = await this.prisma.account.findFirst({ where: { entityId, code } });
    if (!account) {
      this.logger.warn(`Chart-of-accounts code ${code} not found for entity ${entityId} — skipping that posting line.`);
    }
    return account?.id ?? null;
  }

  async recordDeferredRevenue(orderId: string) {
    try {
      const entity = await this.homeEntity();
      if (!entity) {
        this.logger.warn(`No group root LegalEntity configured — skipping deferred-revenue posting for order ${orderId}.`);
        return;
      }
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) return;

      const [cashAccountId, deferredRevenueAccountId] = await Promise.all([
        this.accountId(entity.id, '1000'),
        this.accountId(entity.id, '2400'),
      ]);
      if (!cashAccountId || !deferredRevenueAccountId) return;

      await this.journal.postEntry(
        {
          entityId: entity.id,
          date: new Date().toISOString(),
          description: `Payment received for order #${order.orderNumber} — deferred until delivery`,
          lines: [
            { accountId: cashAccountId, debitAmount: order.totalUgx },
            { accountId: deferredRevenueAccountId, creditAmount: order.totalUgx },
          ],
        },
        SYSTEM_ACTOR,
      );
    } catch (error) {
      this.logger.error(`recordDeferredRevenue failed for order ${orderId} — order flow continues regardless.`, error as Error);
    }
  }

  async recognizeRevenue(orderId: string) {
    try {
      const entity = await this.homeEntity();
      if (!entity) {
        this.logger.warn(`No group root LegalEntity configured — skipping revenue recognition for order ${orderId}.`);
        return;
      }
      const order = (await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { vendor: { select: { commissionRatePercent: true } } } } },
      })) as OrderForRecognition | null;
      if (!order) return;

      const wasPrepaid = await this.prisma.paymentTransaction.findFirst({
        where: { orderId, status: 'SUCCESSFUL' },
      });

      const lines: { accountId: string; debitAmount?: number; creditAmount?: number; memo?: string }[] = [];
      let platformRevenueUgx = 0;
      let commissionIncomeUgx = 0;
      let vendorPayoutTotalUgx = 0;
      let cogsUgx = 0;

      const codes = await Promise.all(
        ['1000', '2400', '4000', '4800', '2250', '2300', '5000', '1200'].map((c) => this.accountId(entity.id, c)),
      );
      const [cashAcct, deferredRevenueAcct, salesRevenueAcct, commissionIncomeAcct, vendorPayablesAcct, vatPayableAcct, cogsAcct, inventoryAcct] = codes;

      const payoutUpdates: { id: string; platformCommissionUgx: number; vendorPayoutUgx: number }[] = [];

      for (const item of order.items) {
        const lineTotal = item.unitPriceUgx * item.qty;
        if (item.vendorId && item.vendor) {
          const rate = Number(item.vendor.commissionRatePercent);
          const commission = Math.round((lineTotal * rate) / 100);
          const vendorPayout = lineTotal - commission;
          commissionIncomeUgx += commission;
          vendorPayoutTotalUgx += vendorPayout;
          payoutUpdates.push({ id: item.id, platformCommissionUgx: commission, vendorPayoutUgx: vendorPayout });
        } else {
          platformRevenueUgx += lineTotal;
          if (item.costUgxSnapshot != null) cogsUgx += item.costUgxSnapshot * item.qty;
        }
      }

      // Discount and shipping are rolled into Sales Revenue rather than
      // allocated per line or given their own contra-revenue account — a
      // documented simplification (see docs/SRS.md §21 FIN-FR-8) — so the
      // entry balances to exactly order.totalUgx without inventing a
      // pro-rata allocation rule this minimum core doesn't need yet. Can go
      // negative for an all-vendor-items order with a discount larger than
      // its shipping fee — posted as-is (a negative revenue line is
      // mechanically valid and still balances) rather than silently
      // clamped to zero, which would lose track of the discount; a real
      // system would allocate the discount across vendor items too — not
      // implemented, a known gap for that specific combination.
      const salesRevenueUgx = platformRevenueUgx - order.discountUgx + order.shippingFeeUgx;

      const sourceAccountId = wasPrepaid ? deferredRevenueAcct : cashAcct;
      const sourceLabel = wasPrepaid ? 'Deferred Revenue' : 'Cash';
      if (sourceAccountId) lines.push({ accountId: sourceAccountId, debitAmount: order.totalUgx, memo: `Clear ${sourceLabel}` });
      // Zero is a real, valid outcome (an all-vendor-items order with no
      // discount/shipping) — JournalService rejects zero-amount lines, so
      // this must be omitted rather than posted as a no-op credit.
      if (salesRevenueUgx > 0 && salesRevenueAcct) {
        lines.push({ accountId: salesRevenueAcct, creditAmount: salesRevenueUgx, memo: 'Sales revenue (platform items, net of discount, incl. shipping)' });
      } else if (salesRevenueUgx < 0 && salesRevenueAcct) {
        lines.push({ accountId: salesRevenueAcct, debitAmount: -salesRevenueUgx, memo: 'Sales revenue (net negative — discount exceeded platform-item revenue)' });
      }
      if (commissionIncomeUgx > 0 && commissionIncomeAcct) lines.push({ accountId: commissionIncomeAcct, creditAmount: commissionIncomeUgx, memo: 'Commission on vendor items' });
      if (vendorPayoutTotalUgx > 0 && vendorPayablesAcct) lines.push({ accountId: vendorPayablesAcct, creditAmount: vendorPayoutTotalUgx, memo: 'Owed to vendors' });
      if (order.vatUgx > 0 && vatPayableAcct) lines.push({ accountId: vatPayableAcct, creditAmount: order.vatUgx, memo: 'VAT collected' });
      if (cogsUgx > 0 && cogsAcct && inventoryAcct) {
        lines.push({ accountId: cogsAcct, debitAmount: cogsUgx, memo: 'Cost of goods sold' });
        lines.push({ accountId: inventoryAcct, creditAmount: cogsUgx, memo: 'Inventory consumed' });
      }

      if (lines.length >= 2) {
        await this.journal.postEntry(
          {
            entityId: entity.id,
            date: new Date().toISOString(),
            description: `Revenue recognized — order #${order.orderNumber} delivered`,
            lines,
          },
          SYSTEM_ACTOR,
        );
      }

      if (payoutUpdates.length > 0) {
        await this.prisma.$transaction(
          payoutUpdates.map((u) =>
            this.prisma.orderItem.update({
              where: { id: u.id },
              data: { platformCommissionUgx: u.platformCommissionUgx, vendorPayoutUgx: u.vendorPayoutUgx },
            }),
          ),
        );
      }
    } catch (error) {
      this.logger.error(`recognizeRevenue failed for order ${orderId} — order flow continues regardless.`, error as Error);
    }
  }

  // PAY-FR-4 (Refund and Chargeback Management, docs/SRS.md §21): reverses
  // the cash/revenue side of a refunded or charged-back order — a single
  // Debit [wherever the money was sitting] / Credit Cash line for the full
  // amount, rather than unwinding every individual revenue/commission/VAT
  // line. Deliberately does NOT reverse the COGS/Inventory value entries —
  // OrdersService.reverseStockAndLoyalty() already restocks the *physical*
  // inventory quantity on cancel/refund; re-crediting COGS's dollar value
  // in the ledger to match is real, correct double-entry practice but not
  // implemented here, a documented gap rather than a silent omission. Also
  // best-effort/non-blocking, same as the rest of this service.
  async reverseForOrder(orderId: string, feeUgx?: number) {
    try {
      const entity = await this.homeEntity();
      if (!entity) return;
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) return;

      const wasPrepaid = await this.prisma.paymentTransaction.findFirst({ where: { orderId, status: { in: ['SUCCESSFUL', 'REFUNDED', 'CHARGEBACK'] } } });
      if (!wasPrepaid) return; // Cash on Delivery orders never collected payment in the first place if cancelled before delivery

      const wasDelivered = await this.prisma.journalEntry.findFirst({ where: { entityId: entity.id, description: { contains: `order #${order.orderNumber} delivered` } } });
      const sourceCode = wasDelivered ? '4000' : '2400'; // Sales Revenue (rough reversal) vs Deferred Revenue
      const [cashAcct, sourceAcct, feeAcct] = await Promise.all([
        this.accountId(entity.id, '1000'),
        this.accountId(entity.id, sourceCode),
        feeUgx ? this.accountId(entity.id, '5400') : Promise.resolve(null),
      ]);
      if (!cashAcct || !sourceAcct) return;

      const lines: { accountId: string; debitAmount?: number; creditAmount?: number; memo?: string }[] = [
        { accountId: sourceAcct, debitAmount: order.totalUgx, memo: 'Reverse revenue/deferred revenue' },
        { accountId: cashAcct, creditAmount: order.totalUgx - (feeUgx ?? 0), memo: 'Refund paid out' },
      ];
      if (feeUgx && feeAcct) lines.push({ accountId: feeAcct, debitAmount: feeUgx, memo: 'Chargeback/refund fee' });

      await this.journal.postEntry(
        { entityId: entity.id, date: new Date().toISOString(), description: `Refund/chargeback reversal — order #${order.orderNumber}`, lines },
        SYSTEM_ACTOR,
      );
    } catch (error) {
      this.logger.error(`reverseForOrder failed for order ${orderId} — order flow continues regardless.`, error as Error);
    }
  }
}
