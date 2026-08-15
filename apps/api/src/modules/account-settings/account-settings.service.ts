import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SETTINGS_SELECT = {
  // Read-only here — see the comment on User.twoFactorEnabled/biometricEnabled
  // in schema.prisma for why these aren't part of UpdateSettingsDto.
  twoFactorEnabled: true,
  biometricEnabled: true,
  notifyOrderUpdatesSms: true,
  notifyOrderUpdatesEmail: true,
  notifyPromotions: true,
  notifyPush: true,
  notifyLoginAlerts: true,
} as const;

// FR-17: Settings & Notifications self-service.
@Injectable()
export class AccountSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: SETTINGS_SELECT });
    if (!user) throw new NotFoundException('User not found');

    // Login Alerts is delivered in-app (no SMS/email provider connected) —
    // this is what "alert" actually means here: the most recent new-device
    // login the customer hasn't dismissed yet, surfaced as a banner, only
    // when they've opted in.
    const unacknowledgedLoginAlert = user.notifyLoginAlerts
      ? await this.prisma.loginEvent.findFirst({
          where: { userId, isNewDevice: true, acknowledgedAt: null },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    return { ...user, unacknowledgedLoginAlert };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    await this.prisma.user.update({ where: { id: userId }, data: dto });
    return this.getSettings(userId);
  }

  listLoginEvents(userId: string) {
    return this.prisma.loginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async acknowledgeLoginEvent(userId: string, eventId: string) {
    const existing = await this.prisma.loginEvent.findFirst({ where: { id: eventId, userId } });
    if (!existing) throw new NotFoundException('Login event not found');
    await this.prisma.loginEvent.update({ where: { id: eventId }, data: { acknowledgedAt: new Date() } });
    return { acknowledged: true };
  }

  // FR-17.4 "Download My Data" — a full, self-service, read-only export of
  // everything tied to this account. Deliberately excludes anything not
  // owned by the requesting user (e.g. other customers' reviews of the same
  // product) and never includes raw payment credentials — PaymentMethod only
  // ever stores a masked identifier + opaque gateway token, never a PAN.
  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        preferredName: true,
        avatarUrl: true,
        dateOfBirth: true,
        gender: true,
        wellnessPreferences: true,
        tier: true,
        createdAt: true,
        notifyOrderUpdatesSms: true,
        notifyOrderUpdatesEmail: true,
        notifyPromotions: true,
        notifyPush: true,
        notifyLoginAlerts: true,
        addresses: true,
        paymentMethods: {
          select: { id: true, type: true, maskedIdentifier: true, isDefault: true, createdAt: true },
        },
        orders: { include: { items: true } },
        wishlistItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
        reviews: true,
        supportTickets: true,
        loyaltyAccount: { include: { ledgerEntries: true } },
        loginEvents: { orderBy: { createdAt: 'desc' } },
        webauthnCredentials: {
          select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return { exportedAt: new Date().toISOString(), account: user };
  }

  // FR-17.4 "Delete Account" — never a hard delete, same convention as Order
  // and Employee (legal/financial retention: orders, reviews, and support
  // history stay in place, still linked to this user's row, so the business
  // keeps its own records and other customers' product-review context isn't
  // silently gutted). What actually happens: every piece of active
  // personal/session data with no retention need is deleted outright
  // (addresses, saved payment methods, cart, wishlist, WebAuthn credentials,
  // refresh tokens, login history), and the User row itself is scrubbed of
  // every identifying field rather than removed — clearing passwordHash
  // alone already makes login impossible, deletedAt is what marks it done.
  async deleteAccount(userId: string, currentPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    return this.anonymizeUser(userId);
  }

  // Shared with CrmService.remove() (admin-triggered delete) — the scrub is
  // identical either way, only the proof-of-authority differs (the
  // customer's own password above vs. admin auth + RBAC on the CRM side).
  async anonymizeUser(userId: string) {
    await this.prisma.$transaction([
      this.prisma.address.deleteMany({ where: { userId } }),
      this.prisma.paymentMethod.deleteMany({ where: { userId } }),
      this.prisma.wishlistItem.deleteMany({ where: { userId } }),
      this.prisma.webAuthnCredential.deleteMany({ where: { userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.loginEvent.deleteMany({ where: { userId } }),
      this.prisma.cart.deleteMany({ where: { userId } }), // cascades to CartItems
      this.prisma.user.update({
        where: { id: userId },
        data: {
          name: 'Deleted User',
          preferredName: null,
          avatarUrl: null,
          email: null,
          phone: null,
          passwordHash: null,
          dateOfBirth: null,
          gender: null,
          wellnessPreferences: [],
          twoFactorEnabled: false,
          twoFactorSecret: null,
          biometricEnabled: false,
          notifyOrderUpdatesSms: false,
          notifyOrderUpdatesEmail: false,
          notifyPromotions: false,
          notifyPush: false,
          notifyLoginAlerts: false,
          deletedAt: new Date(),
        },
      }),
    ]);

    return { deleted: true };
  }
}
