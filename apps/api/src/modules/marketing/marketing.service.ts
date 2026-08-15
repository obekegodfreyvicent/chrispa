import { Injectable } from '@nestjs/common';
import { NotificationType, UserRole } from '@prisma/client';
import { ActivityLogService, ActorInfo, deriveActorType } from '../../common/activity-log/activity-log.service';
import { MailService } from '../../common/notifications/mail.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountNotificationsService } from '../account-notifications/account-notifications.service';
import { CmsService } from '../cms/cms.service';
import { SendNewsletterDto } from './dto/send-newsletter.dto';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// FR-26: Marketing & Promotions read side. Coupon/bundle creation, abandoned-cart
// campaigns, and A/B testing are follow-up work.
@Injectable()
export class MarketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: AccountNotificationsService,
    private readonly activityLog: ActivityLogService,
    private readonly cms: CmsService,
  ) {}

  listCoupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  listBundles() {
    return this.prisma.bundle.findMany({ where: { isActive: true } });
  }

  // FR-1.6/FR-26.4: public footer signup — idempotent both ways. A brand new
  // email creates a row; an email that unsubscribed before just flips
  // isActive back on rather than erroring on the unique constraint. Always
  // reports success either way so the response can't be used to enumerate
  // which emails are already subscribed.
  async subscribeNewsletter(email: string) {
    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (!existing) {
      await this.prisma.newsletterSubscriber.create({ data: { email } });
    } else if (!existing.isActive) {
      await this.prisma.newsletterSubscriber.update({
        where: { email },
        data: { isActive: true, unsubscribedAt: null },
      });
    }
    return { subscribed: true };
  }

  async unsubscribeNewsletter(email: string) {
    await this.prisma.newsletterSubscriber.updateMany({
      where: { email, isActive: true },
      data: { isActive: false, unsubscribedAt: new Date() },
    });
    return { subscribed: false };
  }

  listNewsletterSubscribers() {
    return this.prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      orderBy: { subscribedAt: 'desc' },
    });
  }

  // FR-26.4: admin "Compose Newsletter" — sends immediately, no draft/
  // scheduling step. Every active subscriber gets emailed (best-effort: one
  // bad address doesn't block the rest, via allSettled) regardless of
  // whether they have a ChrisPa account; any subscriber whose email also
  // matches a User additionally gets an in-app Notification (see
  // AccountNotificationsService.notifyByEmails()) — that's the only signal
  // this method needs to fan out both channels from the same subscriber
  // list, no separate "which subscribers have accounts" query required.
  //
  // Every send includes a "Follow ChrisPa" block sourced from the same
  // active SocialMediaAccount rows the storefront footer/Connected & Social
  // page read (CmsService.listActiveSocialLinks()) — the customer reviewing
  // the newsletter also gets a direct way to follow/connect on social,
  // rather than that being a separate, disconnected surface.
  async sendNewsletter(dto: SendNewsletterDto, actor: ActorInfo) {
    const [subscribers, socialLinks] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({
        where: { isActive: true },
        select: { email: true },
      }),
      this.cms.listActiveSocialLinks(),
    ]);
    const emails = subscribers.map((s) => s.email);

    const followText = socialLinks.length
      ? `\n\nFollow ChrisPa Scents and Soaps:\n${socialLinks.map((s) => `${s.platform}: ${s.url}`).join('\n')}`
      : '';
    const followHtml = socialLinks.length
      ? `<p style="margin-top:24px;padding-top:16px;border-top:1px solid #E3EDDB;font-size:13px;color:#5b6b52;">
           Follow ChrisPa Scents and Soaps:
           ${socialLinks
             .map((s) => `<a href="${escapeHtml(s.url)}" style="color:#8a6d3b;margin-right:12px;">${escapeHtml(s.platform)}</a>`)
             .join('')}
         </p>`
      : '';
    const html = `<div style="font-family:sans-serif;">
        <p style="white-space:pre-wrap;">${escapeHtml(dto.body)}</p>
        ${followHtml}
      </div>`;

    await Promise.allSettled(
      emails.map((email) =>
        this.mail.sendMail({ to: email, subject: dto.subject, text: `${dto.body}${followText}`, html }),
      ),
    );

    const notifiedUserCount = await this.notifications.notifyByEmails(emails, {
      type: NotificationType.NEWSLETTER,
      title: dto.subject,
      body: dto.body,
      linkUrl: '/account/notifications',
    });

    const campaign = await this.prisma.newsletterCampaign.create({
      data: {
        subject: dto.subject,
        body: dto.body,
        recipientCount: emails.length,
        notifiedUserCount,
      },
    });

    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'NEWSLETTER_SENT',
      entityType: 'NewsletterCampaign',
      entityId: campaign.id,
      description: `Sent newsletter "${dto.subject}" to ${emails.length} subscriber(s), ${notifiedUserCount} with a linked account`,
    });

    return campaign;
  }

  listNewsletterCampaigns() {
    return this.prisma.newsletterCampaign.findMany({ orderBy: { sentAt: 'desc' } });
  }
}
