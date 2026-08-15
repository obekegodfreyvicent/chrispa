import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import { ActivityLogService, ActorInfo, deriveActorType, RequestInfo } from '../../common/activity-log/activity-log.service';
import { RevenueRecognitionService } from '../finance/revenue-recognition.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// FR-6/FR-14: order history + tracking (read side).
// FR-23: admin order management (list/detail/status transitions).
// Order creation lives in ../checkout/checkout.service.ts (FR-5).
// Still follow-up work: editing items/address/pricing, internal notes, split
// shipment, packing slips/shipping labels, bulk actions.
const ORDER_LIST_INCLUDE = {
  items: true,
  user: { select: { id: true, name: true, email: true } },
  warehouse: true,
} satisfies Prisma.OrderInclude;

// Which transitions are allowed out of each status. Entering CANCELLED/
// REFUNDED restocks inventory and reverses any loyalty points that order
// earned (see reverseStockAndLoyalty()) — both are terminal states with no
// further transitions, which also protects against double-reversal.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [OrderStatus.REFUND_REQUESTED],
  REFUND_REQUESTED: [OrderStatus.REFUNDED, OrderStatus.DELIVERED], // DELIVERED = refund request rejected
  REFUNDED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly revenueRecognition: RevenueRecognitionService,
    private readonly payments: PaymentsService,
  ) {}

  listForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForUser(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: { include: { product: true, variant: true } }, warehouse: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // PAY-FR-5 (docs/SRS.md §21): the customer's half of "mutual consent" that
  // an order is truly done — staff already set status: DELIVERED on their
  // side; this is the customer independently confirming the goods actually
  // arrived in good condition. Deliberately a separate field from `status`
  // rather than a new OrderStatus value, since it's a customer-owned signal
  // layered on top of the staff-owned fulfillment pipeline, not another
  // fulfillment stage — a customer can still request a refund after
  // confirming (ALLOWED_TRANSITIONS is untouched by this). The printable
  // receipt only renders in full once this is set.
  async confirmReceipt(userId: string, orderId: string, context: RequestInfo = {}) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be confirmed as received.');
    }
    if (order.deliveryConfirmedAt) {
      throw new BadRequestException('This order was already confirmed as received.');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { deliveryConfirmedAt: new Date() },
      include: { items: { include: { product: true, variant: true } }, warehouse: true },
    });

    await this.activityLog.record({
      actorUserId: userId,
      actorRole: UserRole.CUSTOMER,
      actorType: deriveActorType(UserRole.CUSTOMER),
      action: 'ORDER_RECEIPT_CONFIRMED',
      entityType: 'Order',
      entityId: orderId,
      description: `Customer confirmed order #${order.orderNumber} received in good condition`,
      ...context,
    });

    return updated;
  }

  // ---------- Admin (FR-23) ----------

  // `confirmedOnly` (PAY-FR-5, docs/SRS.md §21.5): lets staff pull up exactly
  // the orders whose customers have confirmed receipt in good condition —
  // the ones whose receipt is now the finalized, stamped record worth
  // keeping a copy of, rather than hunting order-by-order to find out.
  listForAdmin(params: { status?: OrderStatus; search?: string; confirmedOnly?: boolean; skip?: number; take?: number }) {
    const { status, search, confirmedOnly, skip = 0, take = 50 } = params;
    return this.prisma.order.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(confirmedOnly ? { deliveryConfirmedAt: { not: null } } : {}),
        ...(search
          ? {
              OR: [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { user: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: ORDER_LIST_INCLUDE,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async countsByStatus() {
    const [rows, confirmedCount] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], _count: true }),
      this.prisma.order.count({ where: { deliveryConfirmedAt: { not: null } } }),
    ]);
    const counts: Record<string, number> = { ALL: 0, CONFIRMED: confirmedCount };
    for (const status of Object.values(OrderStatus)) counts[status] = 0;
    for (const row of rows) {
      counts[row.status] = row._count;
      counts.ALL += row._count;
    }
    return counts;
  }

  async getForAdmin(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, variant: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
        warehouse: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: string, nextStatus: OrderStatus, actor: ActorInfo, context: RequestInfo = {}) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');

      const allowed = ALLOWED_TRANSITIONS[order.status];
      if (!allowed.includes(nextStatus)) {
        throw new BadRequestException(
          `Can't move an order from ${order.status} to ${nextStatus}. Valid next steps: ${allowed.join(', ') || 'none (terminal state)'}.`,
        );
      }

      const previousStatus = order.status;
      const updated = await tx.order.update({ where: { id }, data: { status: nextStatus }, include: ORDER_LIST_INCLUDE });

      if (nextStatus === OrderStatus.CANCELLED || nextStatus === OrderStatus.REFUNDED) {
        await this.reverseStockAndLoyalty(tx, order);
      }

      await this.activityLog.record(
        {
          actorUserId: actor.userId,
          actorRole: actor.role as UserRole,
          actorType: deriveActorType(actor.role),
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'Order',
          entityId: order.id,
          description: `Order #${order.orderNumber} moved from ${previousStatus} to ${nextStatus}`,
          metadata: { from: previousStatus, to: nextStatus },
          ...context,
        },
        tx,
      );

      return updated;
    });

    // FIN-FR-8/PAY-FR-4 (docs/SRS.md §21): deliberately outside the
    // transaction above and best-effort — the order's own status change
    // must never fail or roll back because of a ledger posting or gateway
    // call. recognizeRevenue()/reverseForOrder() already catch and log
    // internally; the refund call here is the one piece that can throw
    // (a real gateway failure), caught locally so it surfaces in logs for
    // staff to follow up on manually rather than blocking the transition.
    if (nextStatus === OrderStatus.DELIVERED) {
      await this.revenueRecognition.recognizeRevenue(id);
    } else if (nextStatus === OrderStatus.CANCELLED || nextStatus === OrderStatus.REFUNDED) {
      await this.revenueRecognition.reverseForOrder(id);
      const successfulPayment = await this.prisma.paymentTransaction.findFirst({ where: { orderId: id, status: 'SUCCESSFUL' } });
      if (successfulPayment) {
        try {
          await this.payments.refundForOrder(id);
        } catch (error) {
          this.logger.error(`Gateway refund failed for order ${id} — status transition still applied; needs manual follow-up.`, error as Error);
        }
      }
    }

    return updated;
  }

  // Restocks inventory at the order's warehouse and reverses any loyalty
  // points that order originally earned, when it's cancelled or refunded.
  // If those points were already redeemed elsewhere, the balance can go
  // negative here — there's no separate "points on hold" concept yet, which
  // would be needed to prevent that; flagging as a real limitation, not an
  // oversight.
  private async reverseStockAndLoyalty(
    tx: Prisma.TransactionClient,
    order: Prisma.OrderGetPayload<{ include: { items: true } }>,
  ) {
    if (order.warehouseId) {
      for (const item of order.items) {
        const record = await tx.inventoryRecord.findFirst({
          where: { productId: item.productId, warehouseId: order.warehouseId },
          orderBy: { createdAt: 'asc' },
        });
        if (record) {
          await tx.inventoryRecord.update({ where: { id: record.id }, data: { qtyOnHand: { increment: item.qty } } });
        }
        await tx.product.update({ where: { id: item.productId }, data: { stockQty: { increment: item.qty } } });
        if (item.variantId) {
          await tx.variant.update({ where: { id: item.variantId }, data: { stockQty: { increment: item.qty } } });
        }
      }
    }

    if (order.userId) {
      const priorEarning = await tx.loyaltyLedgerEntry.findFirst({ where: { orderId: order.id, delta: { gt: 0 } } });
      if (priorEarning) {
        const loyaltyAccount = await tx.loyaltyAccount.findUnique({ where: { userId: order.userId } });
        if (loyaltyAccount) {
          await tx.loyaltyAccount.update({
            where: { id: loyaltyAccount.id },
            data: { pointsBalance: { decrement: priorEarning.delta } },
          });
          await tx.loyaltyLedgerEntry.create({
            data: {
              loyaltyAccountId: loyaltyAccount.id,
              delta: -priorEarning.delta,
              reason: `Reversal — Order #${order.orderNumber} cancelled/refunded`,
              orderId: order.id,
            },
          });
        }
      }
    }
  }
}
