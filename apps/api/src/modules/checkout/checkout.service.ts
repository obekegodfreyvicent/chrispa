import { BadRequestException, Injectable } from '@nestjs/common';
import { Coupon, CouponType, Prisma, UserRole } from '@prisma/client';
import { ActivityLogService, ActorInfo, deriveActorType, RequestInfo } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { ShippingZonesService } from '../shipping/shipping-zones.service';
import { CheckoutDto, PaymentMethod } from './dto/checkout.dto';

// FR-5: Checkout / order creation.
//
// Shipping fee (per user decision, not in the original SRS) is priced by
// BOTH destination and delivery method via ShippingZonesService — replaces
// the old flat DELIVERY_FEES_UGX table that ignored the shipping address
// entirely. See that service for the zone-matching/fallback logic.
//
// Simplifications, tracked as follow-up work in docs/SRS.md:
// - Single fulfillment warehouse ("Kampala Central") — real multi-warehouse
//   routing is an open SRS question.
// - orderNumber is derived from the last order's number inside the same
//   transaction; a unique-constraint collision under concurrent checkouts
//   fails the request rather than corrupting data, but isn't race-free. Same
//   caveat applies to the stock-availability check below (Prisma's default
//   READ COMMITTED isolation doesn't prevent two concurrent checkouts from
//   both reading "enough stock" before either commits) — the per-row decrement
//   guards against going negative and aborts the transaction if it would, so
//   a race fails loudly instead of corrupting inventory. A Postgres sequence
//   (for order numbers) and SELECT ... FOR UPDATE / SERIALIZABLE isolation
//   (for stock) should replace these before this needs to handle real load.
// - Cash on Delivery completes immediately. Mobile Money/Card create the
//   order the same way, then hand back a Flutterwave-hosted checkoutUrl
//   (PAY-FR-1, docs/SRS.md §21) — the order exists (and stock is already
//   decremented) before payment succeeds or fails; see PaymentsService for
//   why there's no reservation/cleanup job for an abandoned payment.
const POINTS_PER_UGX_SPENT = 10 / 1000; // 10 pts per UGX 1,000 spent — SRS FR-18.3
const FULFILLMENT_WAREHOUSE_NAME = 'Kampala Central';
// TAX-FR-1 (docs/SRS.md §21): Uganda's standard VAT rate. Applied to the
// subtotal only (not shipping) — a deliberate, documented simplification;
// some real-world VAT treatments also tax delivery fees, which this doesn't.
const UGANDA_VAT_RATE = 0.18;

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly payments: PaymentsService,
    private readonly shipping: ShippingZonesService,
  ) {}

  async checkout(actor: ActorInfo, dto: CheckoutDto, context: RequestInfo = {}) {
    const userId = actor.userId;
    if (dto.paymentMethod !== PaymentMethod.CASH_ON_DELIVERY && !dto.returnUrl) {
      throw new BadRequestException('returnUrl is required for Mobile Money/Card checkout.');
    }

    // Priced by destination + delivery method (admin-managed shipping
    // zones, per user decision) — computed outside the transaction below
    // since it's independent of the cart/warehouse state read there, same
    // reasoning as why coupon validation doesn't need tx's isolation either.
    // Throws (BadRequestException) if the matched zone doesn't offer
    // dto.deliveryMethod at all, before any cart/stock work happens.
    const { zoneName, feeUgx: shippingFeeUgx } = await this.shipping.priceFor(dto.shippingAddress.city, dto.deliveryMethod);

    const { order, customer } = await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true, variant: true } } },
      });
      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Your cart is empty.');
      }

      const warehouse = await tx.warehouse.findFirstOrThrow({ where: { name: FULFILLMENT_WAREHOUSE_NAME } });

      const shortages: string[] = [];
      for (const item of cart.items) {
        const record = await tx.inventoryRecord.aggregate({
          where: { productId: item.productId, warehouseId: warehouse.id },
          _sum: { qtyOnHand: true },
        });
        const available = record._sum.qtyOnHand ?? 0;
        if (available < item.qty) {
          shortages.push(`${item.product.name} (have ${available}, need ${item.qty})`);
        }
      }
      if (shortages.length > 0) {
        throw new BadRequestException(`Not enough stock for: ${shortages.join(', ')}`);
      }

      const subtotalUgx = cart.items.reduce((sum, item) => {
        const unitPrice = item.product.priceUgx + (item.variant?.priceDelta ?? 0);
        return sum + unitPrice * item.qty;
      }, 0);

      let discountUgx = 0;
      let coupon: Coupon | null = null;
      if (dto.couponCode) {
        const found = await tx.coupon.findUnique({ where: { code: dto.couponCode } });
        const isValid = found && found.isActive && (!found.expiresAt || found.expiresAt > new Date());
        if (!found || !isValid) {
          throw new BadRequestException('That promo code is invalid or has expired.');
        }
        coupon = found;
        if (coupon.type === CouponType.PERCENT_OFF) discountUgx = Math.round((subtotalUgx * coupon.value) / 100);
        else if (coupon.type === CouponType.FIXED_OFF) discountUgx = coupon.value;
        else if (coupon.type === CouponType.FREE_SHIPPING) discountUgx = shippingFeeUgx;
      }
      // TAX-FR-1: VAT on the discounted subtotal — charging 18% on an
      // amount the customer never actually pays (pre-discount) would
      // overcharge tax, so this applies after the coupon, not before.
      const vatUgx = Math.round(Math.max(0, subtotalUgx - discountUgx) * UGANDA_VAT_RATE);
      const totalUgx = Math.max(0, subtotalUgx + shippingFeeUgx - discountUgx + vatUgx);

      const lastOrder = await tx.order.findFirst({ orderBy: { createdAt: 'desc' }, select: { orderNumber: true } });
      const lastSeq = lastOrder ? parseInt(lastOrder.orderNumber.replace('CP-', ''), 10) || 1000 : 1000;
      const orderNumber = `CP-${lastSeq + 1}`;

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          warehouseId: warehouse.id,
          subtotalUgx,
          shippingFeeUgx,
          discountUgx,
          vatUgx,
          totalUgx,
          deliveryMethod: dto.deliveryMethod,
          shippingZoneName: zoneName,
          timeSlot: dto.timeSlot,
          paymentMethod: dto.paymentMethod,
          shippingAddress: dto.shippingAddress as unknown as Prisma.InputJsonValue,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              qty: item.qty,
              unitPriceUgx: item.product.priceUgx + (item.variant?.priceDelta ?? 0),
              // MKT-FR-2/FIN-FR-7: snapshotted at sale time — see the schema
              // comment on OrderItem.vendorId for why this must never be a
              // live read of Product at revenue-recognition time instead.
              vendorId: item.product.vendorId,
              costUgxSnapshot: item.product.costUgx,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of cart.items) {
        let remaining = item.qty;
        const records = await tx.inventoryRecord.findMany({
          where: { productId: item.productId, warehouseId: warehouse.id, qtyOnHand: { gt: 0 } },
          orderBy: { createdAt: 'asc' }, // FIFO across batches
        });
        for (const record of records) {
          if (remaining <= 0) break;
          const take = Math.min(record.qtyOnHand, remaining);
          const updated = await tx.inventoryRecord.update({
            where: { id: record.id },
            data: { qtyOnHand: { decrement: take } },
          });
          if (updated.qtyOnHand < 0) {
            // Lost a race with a concurrent checkout — abort and roll back cleanly.
            throw new BadRequestException(`Ran out of stock for ${item.product.name} while placing your order — please try again.`);
          }
          remaining -= take;
        }
        if (remaining > 0) {
          throw new BadRequestException(`Ran out of stock for ${item.product.name} while placing your order — please try again.`);
        }

        await tx.product.update({ where: { id: item.productId }, data: { stockQty: { decrement: item.qty } } });
        if (item.variantId) {
          await tx.variant.update({ where: { id: item.variantId }, data: { stockQty: { decrement: item.qty } } });
        }
      }

      if (coupon) {
        await tx.coupon.update({ where: { id: coupon.id }, data: { usageCount: { increment: 1 } } });
      }

      const loyaltyAccount = await tx.loyaltyAccount.findUnique({ where: { userId } });
      if (loyaltyAccount) {
        const pointsEarned = Math.floor(totalUgx * POINTS_PER_UGX_SPENT);
        await tx.loyaltyAccount.update({
          where: { id: loyaltyAccount.id },
          data: { pointsBalance: { increment: pointsEarned } },
        });
        await tx.loyaltyLedgerEntry.create({
          data: { loyaltyAccountId: loyaltyAccount.id, delta: pointsEarned, reason: `Order #${orderNumber}`, orderId: order.id },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      await this.activityLog.record(
        {
          actorUserId: actor.userId,
          actorRole: actor.role as UserRole,
          actorType: deriveActorType(actor.role),
          action: 'ORDER_PLACED',
          entityType: 'Order',
          entityId: order.id,
          description: `Placed order #${orderNumber} — ${dto.paymentMethod}, total UGX ${totalUgx.toLocaleString()}`,
          ...context,
        },
        tx,
      );

      const customer = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, phone: true, name: true } });
      return { order, customer };
    });

    if (dto.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
      return { order, checkoutUrl: null };
    }

    // Outside the $transaction deliberately — an external HTTP call to
    // Flutterwave must never hold a database transaction open around it.
    // The order and its stock decrement are already committed at this
    // point regardless of whether payment initiation below succeeds.
    const { checkoutUrl } = await this.payments.initiateForOrder(
      order,
      { email: customer.email ?? '', phone: customer.phone ?? undefined, name: customer.name },
      dto.returnUrl!,
    );
    return { order, checkoutUrl };
  }
}
