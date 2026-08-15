import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ActivityLogService, ActorInfo, deriveActorType, RequestInfo } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountSettingsService } from '../account-settings/account-settings.service';

// FR-25: Customers (CRM) read side, plus admin-triggered suspend/reactivate/
// delete (net-new scope, not in the original SRS — see docs/07-authentication-and-authorization.md
// for the completeLogin()/refresh() enforcement this relies on). RFM
// segmentation, tags/notes, and campaign-list export are still follow-up work.
@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly accountSettings: AccountSettingsService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      // Deleted accounts (FR-17.4) are scrubbed, not removed — their order
      // history stays for the business's own records, but they shouldn't
      // show up in the admin customer list as if still active. Suspended
      // accounts DO still show, deliberately — an admin needs to see and
      // reactivate them.
      where: { role: UserRole.CUSTOMER, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        tier: true,
        createdAt: true,
        suspendedAt: true,
        suspensionReason: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getActiveCustomer(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, role: UserRole.CUSTOMER } });
    if (!user || user.deletedAt) throw new NotFoundException('Customer not found');
    return user;
  }

  // Reversible — see the comment on User.suspendedAt in schema.prisma.
  // Revokes every active refresh token so the hold takes effect immediately
  // rather than waiting out the current access token's 15-minute TTL (see
  // AuthService.completeLogin()/refresh(), the two enforcement points).
  async suspend(id: string, reason: string | undefined, actor: ActorInfo, context: RequestInfo = {}) {
    const user = await this.getActiveCustomer(id);
    if (user.suspendedAt) {
      throw new BadRequestException('This customer is already suspended');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { suspendedAt: new Date(), suspensionReason: reason ?? null },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'CUSTOMER_SUSPENDED',
      entityType: 'User',
      entityId: id,
      description: reason ? `Suspended customer account: ${reason}` : 'Suspended customer account',
      metadata: reason ? { reason } : undefined,
      ...context,
    });

    return { suspended: true };
  }

  async reactivate(id: string, actor: ActorInfo, context: RequestInfo = {}) {
    const user = await this.getActiveCustomer(id);
    if (!user.suspendedAt) {
      throw new BadRequestException('This customer is not suspended');
    }

    await this.prisma.user.update({
      where: { id },
      data: { suspendedAt: null, suspensionReason: null },
    });

    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'CUSTOMER_REACTIVATED',
      entityType: 'User',
      entityId: id,
      description: 'Reactivated customer account',
      ...context,
    });

    return { suspended: false };
  }

  // Terminal — see AccountSettingsService.anonymizeUser() for exactly what
  // this scrubs and retains (orders/reviews/support/loyalty stay, linked to
  // the now-anonymized row). No password confirmation here, unlike the
  // customer's own self-service delete — admin auth + RBAC is the proof of
  // authority instead.
  async remove(id: string, actor: ActorInfo, context: RequestInfo = {}) {
    await this.getActiveCustomer(id);

    await this.accountSettings.anonymizeUser(id);

    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'CUSTOMER_DELETED',
      entityType: 'User',
      entityId: id,
      description: 'Deleted customer account',
      ...context,
    });

    return { deleted: true };
  }
}
