import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  linkUrl?: string;
}

// A generic in-app notification center (see the Notification model's
// comment in schema.prisma) — first consumer is MarketingService's
// "Compose Newsletter" flow, via notifyByEmails() below.
@Injectable()
export class AccountNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { count };
  }

  // Ownership-checked via the userId in the where clause, same
  // findFirst-before-touching-a-row convention as wishlist/addresses — an
  // updateMany that matches nothing (wrong owner, already read, doesn't
  // exist) is a silent no-op rather than a 404, which is fine here since
  // "mark read" is idempotent by nature.
  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  // Bulk-creates one Notification per User whose email matches one of the
  // given addresses — emails with no matching account are silently skipped
  // (there's no account to attach an in-app notification to; they still get
  // the email side of whatever triggered this). Returns how many accounts
  // were actually notified, for the caller to record (e.g.
  // NewsletterCampaign.notifiedUserCount).
  async notifyByEmails(emails: string[], data: CreateNotificationInput): Promise<number> {
    if (emails.length === 0) return 0;
    const users = await this.prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    if (users.length === 0) return 0;
    await this.prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, ...data })),
    });
    return users.length;
  }
}
