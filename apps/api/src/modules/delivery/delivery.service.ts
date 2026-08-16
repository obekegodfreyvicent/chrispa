import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DeliveryPriority, DeliveryStatus, DriverStatus, OrderStatus, Prisma, UserRole } from '@prisma/client';
import { ActivityLogService, ActorInfo, deriveActorType, RequestInfo } from '../../common/activity-log/activity-log.service';
import { MailService } from '../../common/notifications/mail.service';
import { SmsService } from '../../common/notifications/sms.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

const DELIVERY_INCLUDE = {
  driver: { select: { id: true, name: true, phone: true } },
  order: {
    include: {
      items: { include: { product: true, variant: true } },
      warehouse: true,
      user: { select: { id: true, name: true, phone: true } },
    },
  },
} satisfies Prisma.DeliveryInclude;

// Which DeliveryStatus a driver can move to from each current one — FAILED
// is reachable from any in-progress state (a real-world delivery attempt
// can fail at any point), DELIVERED/FAILED are terminal.
const ALLOWED_DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  ASSIGNED: [DeliveryStatus.EN_ROUTE_TO_PICKUP, DeliveryStatus.FAILED],
  EN_ROUTE_TO_PICKUP: [DeliveryStatus.PICKED_UP, DeliveryStatus.FAILED],
  PICKED_UP: [DeliveryStatus.EN_ROUTE_TO_CUSTOMER, DeliveryStatus.FAILED],
  EN_ROUTE_TO_CUSTOMER: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
  DELIVERED: [],
  FAILED: [],
};

// Order.status steps a Delivery's PICKED_UP/DELIVERED transitions must mirror.
const ORDER_PROGRESSION: OrderStatus[] = [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED];

// Customer-facing copy per delivery status — sent by notifyCustomer() below.
// Deliberately terse plain text, same style as OtpService's messages; no
// HTML template system exists in this codebase yet.
const STATUS_MESSAGE: Partial<Record<DeliveryStatus, (orderNumber: string, driverName: string) => string>> = {
  ASSIGNED: (o, d) => `${d} has been assigned to deliver your ChrisPa order #${o}.`,
  PICKED_UP: (o, d) => `${d} has picked up your ChrisPa order #${o} and is on the way.`,
  DELIVERED: (o) => `Your ChrisPa order #${o} has been delivered. Enjoy!`,
  FAILED: (o) => `We couldn't complete delivery of your ChrisPa order #${o} — our team will be in touch shortly.`,
};

// Driver App (per user request — see the class comment on the Delivery
// model in schema.prisma for the full design rationale: 1:1 with Order,
// GPS-capture-and-deep-link rather than in-app routing, status transitions
// mirrored onto Order.status via OrdersService rather than duplicating its
// transition/revenue-recognition logic).
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly orders: OrdersService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
  ) {}

  // ---------- Admin ----------

  listDrivers() {
    return this.prisma.user.findMany({
      where: { role: UserRole.DRIVER, deletedAt: null },
      select: { id: true, name: true, phone: true, driverStatus: true },
      orderBy: { name: 'asc' },
    });
  }

  // Counts by DeliveryStatus, for the admin Dashboard's "active deliveries"
  // widget — same "compute on read, no stored metric" approach as every
  // other dashboard figure in this codebase (see DashboardService.summary()
  // in the HR module).
  async adminSummary() {
    const rows = await this.prisma.delivery.groupBy({ by: ['status'], _count: true });
    const counts: Record<string, number> = { ALL: 0 };
    for (const s of Object.values(DeliveryStatus)) counts[s] = 0;
    for (const row of rows) {
      counts[row.status] = row._count;
      counts.ALL += row._count;
    }
    return counts;
  }

  // Upsert, not create-only — reassigning an in-progress delivery to a
  // different driver is a real dispatch need (the original driver called in
  // sick, etc.). Reassignment restarts the delivery's own lifecycle
  // (ASSIGNED, pickup/delivery snapshots cleared) since the new driver
  // hasn't actually done any of that yet; it does NOT touch Order.status,
  // which stays wherever it already was.
  async assign(orderId: string, driverId: string, priority: DeliveryPriority | undefined, actor: ActorInfo, context: RequestInfo = {}) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const driver = await this.prisma.user.findFirst({ where: { id: driverId, role: UserRole.DRIVER, deletedAt: null } });
    if (!driver) throw new BadRequestException('That user is not an active driver');

    const delivery = await this.prisma.delivery.upsert({
      where: { orderId },
      create: { orderId, driverId, status: DeliveryStatus.ASSIGNED, priority },
      update: {
        driverId,
        status: DeliveryStatus.ASSIGNED,
        ...(priority ? { priority } : {}),
        pickupLat: null,
        pickupLng: null,
        pickedUpAt: null,
        deliveryLat: null,
        deliveryLng: null,
        deliveredAt: null,
        currentLat: null,
        currentLng: null,
        lastLocationAt: null,
      },
      include: DELIVERY_INCLUDE,
    });

    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'DELIVERY_ASSIGNED',
      entityType: 'Order',
      entityId: orderId,
      description: `Assigned ${driver.name} to deliver order #${order.orderNumber}`,
      ...context,
    });

    await this.notifyCustomer(orderId, DeliveryStatus.ASSIGNED, driver.name);

    return delivery;
  }

  // ---------- Driver self-service ----------

  getMyStatus(driverId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: driverId }, select: { driverStatus: true } });
  }

  // Self-reported only (see DriverStatus's schema comment) — never derived
  // from a driver's current Delivery rows.
  setMyStatus(driverId: string, status: DriverStatus) {
    return this.prisma.user.update({
      where: { id: driverId },
      data: { driverStatus: status },
      select: { driverStatus: true },
    });
  }

  private async getOwnDelivery(driverId: string, id: string) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id, driverId },
      include: DELIVERY_INCLUDE,
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  // URGENT-first, then oldest-assigned-first within each priority — a
  // simple, transparent dispatch-priority ordering rather than automated
  // assignment (which stays manual, per user decision — see
  // docs/17-infrastructure-platform-roadmap.md).
  listMine(driverId: string) {
    return this.prisma.delivery.findMany({
      where: { driverId },
      include: DELIVERY_INCLUDE,
      orderBy: [{ priority: 'desc' }, { assignedAt: 'asc' }],
    });
  }

  getMine(driverId: string, id: string) {
    return this.getOwnDelivery(driverId, id);
  }

  // Steps Order.status forward through PROCESSING/SHIPPED/DELIVERED as
  // needed to reach `target`, reusing OrdersService.updateStatus() for each
  // real step (never duplicating its transition-validation or
  // revenue-recognition logic) — skips any step the order is already past.
  // A driver being assigned before staff has moved an order out of PENDING
  // is a completely normal real-world sequencing, not an error case.
  private async progressOrderTo(orderId: string, target: OrderStatus, actor: ActorInfo, context: RequestInfo) {
    const targetIndex = ORDER_PROGRESSION.indexOf(target);
    for (let i = 0; i <= targetIndex; i++) {
      const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      const currentIndex = ORDER_PROGRESSION.indexOf(order.status);
      if (currentIndex >= i) continue;
      await this.orders.updateStatus(orderId, ORDER_PROGRESSION[i], actor, context);
    }
  }

  // Best-effort — a notification failure must never fail the delivery
  // status change itself (same reasoning as AuthService.register()'s
  // Promise.allSettled around OTP dispatch). Respects the same
  // notifyOrderUpdatesEmail/notifyOrderUpdatesSms preferences the rest of
  // the app already stores but has had nothing wired to yet — this is that
  // wiring, for delivery events specifically.
  private async notifyCustomer(orderId: string, status: DeliveryStatus, driverName: string) {
    const template = STATUS_MESSAGE[status];
    if (!template) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, phone: true, notifyOrderUpdatesEmail: true, notifyOrderUpdatesSms: true } },
      },
    });
    if (!order?.user) return;

    const message = template(order.orderNumber, driverName);
    const tasks: Promise<void>[] = [];
    if (order.user.email && order.user.notifyOrderUpdatesEmail) {
      tasks.push(
        this.mail.sendMail({ to: order.user.email, subject: 'ChrisPa delivery update', text: message }).catch((err) =>
          this.logger.warn(`Delivery email notification failed for order ${order.orderNumber}: ${err}`),
        ),
      );
    }
    if (order.user.phone && order.user.notifyOrderUpdatesSms) {
      tasks.push(
        this.sms.sendSms({ to: order.user.phone, message }).catch((err) =>
          this.logger.warn(`Delivery SMS notification failed for order ${order.orderNumber}: ${err}`),
        ),
      );
    }
    await Promise.all(tasks);
  }

  async updateStatus(
    driverId: string,
    id: string,
    status: DeliveryStatus,
    lat: number | undefined,
    lng: number | undefined,
    actor: ActorInfo,
    context: RequestInfo = {},
  ) {
    const delivery = await this.getOwnDelivery(driverId, id);

    const allowed = ALLOWED_DELIVERY_TRANSITIONS[delivery.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Can't move a delivery from ${delivery.status} to ${status}. Valid next steps: ${allowed.join(', ') || 'none (terminal state)'}.`,
      );
    }
    if ((status === DeliveryStatus.PICKED_UP || status === DeliveryStatus.DELIVERED) && (lat == null || lng == null)) {
      throw new BadRequestException('GPS coordinates are required to confirm pickup or delivery.');
    }

    const data: Prisma.DeliveryUpdateInput = { status };
    if (status === DeliveryStatus.PICKED_UP) {
      data.pickedUpAt = new Date();
      data.pickupLat = lat;
      data.pickupLng = lng;
    }
    if (status === DeliveryStatus.DELIVERED) {
      data.deliveredAt = new Date();
      data.deliveryLat = lat;
      data.deliveryLng = lng;
    }
    if (lat != null && lng != null) {
      data.currentLat = lat;
      data.currentLng = lng;
      data.lastLocationAt = new Date();
    }

    await this.prisma.delivery.update({ where: { id }, data });

    // Mirror onto Order.status — see progressOrderTo()'s comment. Runs
    // after the Delivery write so a failed order-transition (e.g. someone
    // cancelled the order moments ago) doesn't leave the Delivery row
    // updated with no matching Order change; it does mean a driver could
    // see their own status update succeed and then get an error back if
    // this throws, which is the correct signal that something changed
    // under them and they should refresh rather than keep going.
    if (status === DeliveryStatus.PICKED_UP) {
      await this.progressOrderTo(delivery.orderId, OrderStatus.SHIPPED, actor, context);
    } else if (status === DeliveryStatus.DELIVERED) {
      await this.progressOrderTo(delivery.orderId, OrderStatus.DELIVERED, actor, context);
    }

    // Re-fetch (rather than reusing the pre-progressOrderTo() write above)
    // so the response's nested `order` reflects the just-mirrored status —
    // returning the earlier snapshot would show the order one step behind
    // what actually happened.
    const updated = await this.prisma.delivery.findUniqueOrThrow({ where: { id }, include: DELIVERY_INCLUDE });

    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'DELIVERY_STATUS_CHANGED',
      entityType: 'Order',
      entityId: delivery.orderId,
      description: `Delivery for order #${delivery.order.orderNumber} moved to ${status}`,
      metadata: { from: delivery.status, to: status },
      ...context,
    });

    await this.notifyCustomer(delivery.orderId, status, delivery.driver.name);

    return updated;
  }

  async updateLocation(driverId: string, id: string, lat: number, lng: number) {
    await this.getOwnDelivery(driverId, id);
    return this.prisma.delivery.update({
      where: { id },
      data: { currentLat: lat, currentLng: lng, lastLocationAt: new Date() },
      include: DELIVERY_INCLUDE,
    });
  }
}
