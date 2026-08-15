import { Injectable, NotFoundException } from '@nestjs/common';
import { CmsStatus, UserRole } from '@prisma/client';
import { ActivityLogService, ActorInfo, deriveActorType, RequestInfo } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { CreateCmsPageDto } from './dto/create-cms-page.dto';
import { CreateSocialLinkDto } from './dto/create-social-link.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { UpdateCmsPageDto } from './dto/update-cms-page.dto';
import { UpdateSocialLinkDto } from './dto/update-social-link.dto';

// FR-27: CMS / Site Builder. Published Pages and Active Banners now have a
// real admin write side (see "Admin" sections below), same as Social Media
// Accounts — the drag-and-drop section builder and draft/publish *workflow*
// (as opposed to plain per-page draft/published status, which is real) are
// still follow-up work. Blog Posts remains read-only — no admin surface
// requested for it yet.
@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  listPublishedPages() {
    return this.prisma.cmsPage.findMany({ where: { status: CmsStatus.PUBLISHED } });
  }

  async getPublishedPageBySlug(slug: string) {
    const page = await this.prisma.cmsPage.findFirst({ where: { slug, status: CmsStatus.PUBLISHED } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  listActiveBanners() {
    return this.prisma.banner.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  listPublishedPosts() {
    return this.prisma.blogPost.findMany({
      where: { status: CmsStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
    });
  }

  // Public-facing — the storefront footer and Account → Connected & Social
  // both call this (via GET /cms/social-links) so an admin adding/editing/
  // deleting a link, or toggling it inactive, is reflected on both surfaces
  // the moment the page next loads — no separate "publish" step.
  listActiveSocialLinks() {
    return this.prisma.socialMediaAccount.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ---------- Admin (Social Media Accounts) ----------

  listSocialLinksForAdmin() {
    return this.prisma.socialMediaAccount.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createSocialLink(dto: CreateSocialLinkDto, actor: ActorInfo, context: RequestInfo = {}) {
    const link = await this.prisma.socialMediaAccount.create({
      data: { platform: dto.platform, url: dto.url, isActive: dto.isActive, sortOrder: dto.sortOrder },
    });
    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'SOCIAL_LINK_CREATED',
      entityType: 'SocialMediaAccount',
      entityId: link.id,
      description: `Added social link — ${link.platform}`,
      ...context,
    });
    return link;
  }

  async updateSocialLink(id: string, dto: UpdateSocialLinkDto, actor: ActorInfo, context: RequestInfo = {}) {
    await this.getSocialLinkOrThrow(id);
    const updated = await this.prisma.socialMediaAccount.update({
      where: { id },
      data: dto,
    });
    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'SOCIAL_LINK_UPDATED',
      entityType: 'SocialMediaAccount',
      entityId: id,
      description: `Updated social link — ${updated.platform}`,
      ...context,
    });
    return updated;
  }

  async deleteSocialLink(id: string, actor: ActorInfo, context: RequestInfo = {}) {
    const link = await this.getSocialLinkOrThrow(id);
    await this.prisma.socialMediaAccount.delete({ where: { id } });
    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'SOCIAL_LINK_DELETED',
      entityType: 'SocialMediaAccount',
      entityId: id,
      description: `Removed social link — ${link.platform}`,
      ...context,
    });
    return { deleted: true };
  }

  private async getSocialLinkOrThrow(id: string) {
    const link = await this.prisma.socialMediaAccount.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('Social media account not found');
    return link;
  }

  // ---------- Admin (Published Pages) ----------

  listPagesForAdmin() {
    return this.prisma.cmsPage.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async createPage(dto: CreateCmsPageDto, actor: ActorInfo, context: RequestInfo = {}) {
    const slug = await this.uniquePageSlug(dto.slug ?? dto.title);
    const page = await this.prisma.cmsPage.create({
      data: { title: dto.title, slug, body: dto.body, status: dto.status },
    });
    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'CMS_PAGE_CREATED',
      entityType: 'CmsPage',
      entityId: page.id,
      description: `Created page "${page.title}"`,
      ...context,
    });
    return page;
  }

  async updatePage(id: string, dto: UpdateCmsPageDto, actor: ActorInfo, context: RequestInfo = {}) {
    const before = await this.getPageOrThrow(id);
    const updated = await this.prisma.cmsPage.update({
      where: { id },
      data: { title: dto.title, slug: dto.slug, body: dto.body, status: dto.status },
    });
    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'CMS_PAGE_UPDATED',
      entityType: 'CmsPage',
      entityId: id,
      description: `Updated page "${before.title}"`,
      ...context,
    });
    return updated;
  }

  async deletePage(id: string, actor: ActorInfo, context: RequestInfo = {}) {
    const page = await this.getPageOrThrow(id);
    await this.prisma.cmsPage.delete({ where: { id } });
    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'CMS_PAGE_DELETED',
      entityType: 'CmsPage',
      entityId: id,
      description: `Deleted page "${page.title}"`,
      ...context,
    });
    return { deleted: true };
  }

  private async getPageOrThrow(id: string) {
    const page = await this.prisma.cmsPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  // Same collision-handled slugify as CatalogService.uniqueSlug() for products.
  private async uniquePageSlug(source: string) {
    const base = source
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    let candidate = base;
    let suffix = 2;
    while (await this.prisma.cmsPage.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${suffix++}`;
    }
    return candidate;
  }

  // ---------- Admin (Active Banners) ----------

  listBannersForAdmin() {
    return this.prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createBanner(dto: CreateBannerDto, actor: ActorInfo, context: RequestInfo = {}) {
    const banner = await this.prisma.banner.create({
      data: { imageUrl: dto.imageUrl, linkUrl: dto.linkUrl, isActive: dto.isActive, sortOrder: dto.sortOrder },
    });
    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'BANNER_CREATED',
      entityType: 'Banner',
      entityId: banner.id,
      description: 'Added a homepage banner',
      ...context,
    });
    return banner;
  }

  async updateBanner(id: string, dto: UpdateBannerDto, actor: ActorInfo, context: RequestInfo = {}) {
    await this.getBannerOrThrow(id);
    const updated = await this.prisma.banner.update({ where: { id }, data: dto });
    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'BANNER_UPDATED',
      entityType: 'Banner',
      entityId: id,
      description: 'Updated a homepage banner',
      ...context,
    });
    return updated;
  }

  async deleteBanner(id: string, actor: ActorInfo, context: RequestInfo = {}) {
    await this.getBannerOrThrow(id);
    await this.prisma.banner.delete({ where: { id } });
    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'BANNER_DELETED',
      entityType: 'Banner',
      entityId: id,
      description: 'Removed a homepage banner',
      ...context,
    });
    return { deleted: true };
  }

  private async getBannerOrThrow(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }
}
