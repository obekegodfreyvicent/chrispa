import { randomUUID } from 'crypto';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProductStatus, UserRole } from '@prisma/client';
import type { MultipartFile } from '@fastify/multipart';
import { ActivityLogService, ActorInfo, deriveActorType, RequestInfo } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// Local disk, same convention as ProfileService's avatar upload — no
// object-storage/CDN integration exists yet (see main.ts). A product's
// media list has no owning row at upload time (this is what makes "Add
// Product" work before the product exists yet), so uploads happen through
// this standalone endpoint first; the returned URL then rides in
// CreateProductDto/UpdateProductDto.mediaUrls like a pasted URL always did
// — full-replace semantics on save are unchanged.
const PRODUCTS_UPLOADS_DIR = join(process.cwd(), 'uploads', 'products');
const ALLOWED_MEDIA_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// FR-1 (Shop by Line / Wellness Need), FR-2 (PDP), FR-3 (PLP), FR-21/22 (admin PIM)
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly config: ConfigService,
  ) {}

  // FR-21/22: product media upload (Product Manager add/edit). Mirrors
  // ProfileService.setAvatarFromUpload()'s validation — same allowed types
  // and the same 5MB limit registered globally in main.ts.
  async uploadMedia(file: MultipartFile | undefined): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = ALLOWED_MEDIA_TYPES[file.mimetype];
    if (!ext) throw new BadRequestException('Unsupported image type — use JPEG, PNG, WEBP, or GIF');

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      // @fastify/multipart rejects once the stream exceeds the registered
      // fileSize limit — surface that as a normal 400, not an unhandled 500.
      throw new BadRequestException('Image is too large (max 5MB)');
    }

    const filename = `product-${randomUUID()}${ext}`;
    await writeFile(join(PRODUCTS_UPLOADS_DIR, filename), buffer);
    return { url: `${this.config.get<string>('publicUrl')}/uploads/products/${filename}` };
  }

  listProductLines() {
    return this.prisma.productLine.findMany({ orderBy: { name: 'asc' } });
  }

  listWellnessTags() {
    return this.prisma.wellnessTag.findMany({ orderBy: { label: 'asc' } });
  }

  // `search` powers the storefront header's site-wide search box — matches
  // name, scent/flavor notes, and health benefits so a query like "lavender"
  // or "eczema" surfaces relevant products, not just exact name matches.
  //
  // `minRating` (FR-3.2): there's no denormalized average-rating column on
  // Product — nothing writes one, since there's no review-submission
  // endpoint anywhere in this codebase yet (Review rows can only be seeded
  // directly today). Computed here instead via a Review.groupBy + HAVING,
  // then folded into the main query as an `id IN (...)` filter, since
  // Prisma's relation-aggregate `where` filters support `_count` but not
  // `_avg` on a to-many relation. Real and correct — it'll just return no
  // matches until reviews actually exist, which is the honest answer.
  async listProducts(params: {
    lineSlug?: string;
    wellnessTag?: string;
    search?: string;
    minPriceUgx?: number;
    maxPriceUgx?: number;
    minRating?: number;
    skip?: number;
    take?: number;
  }) {
    const { lineSlug, wellnessTag, search, minPriceUgx, maxPriceUgx, minRating, skip = 0, take = 24 } = params;

    let ratingFilteredIds: string[] | undefined;
    if (minRating !== undefined) {
      const grouped = await this.prisma.review.groupBy({
        by: ['productId'],
        _avg: { rating: true },
        having: { rating: { _avg: { gte: minRating } } },
      });
      ratingFilteredIds = grouped.map((g) => g.productId);
    }

    return this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        ...(lineSlug ? { productLine: { slug: lineSlug } } : {}),
        ...(wellnessTag ? { wellnessTags: { some: { wellnessTag: { label: wellnessTag } } } } : {}),
        ...(minPriceUgx !== undefined || maxPriceUgx !== undefined
          ? {
              priceUgx: {
                ...(minPriceUgx !== undefined ? { gte: minPriceUgx } : {}),
                ...(maxPriceUgx !== undefined ? { lte: maxPriceUgx } : {}),
              },
            }
          : {}),
        ...(ratingFilteredIds ? { id: { in: ratingFilteredIds } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { scentOrFlavorNotes: { contains: search, mode: 'insensitive' } },
                { healthBenefits: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { productLine: true, media: true, variants: true },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        productLine: true,
        media: true,
        variants: true,
        wellnessTags: { include: { wellnessTag: true } },
        reviews: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  // ---------- Admin PIM (FR-21 / FR-22) ----------

  listForAdmin(params: { search?: string; lineSlug?: string; skip?: number; take?: number }) {
    const { search, lineSlug, skip = 0, take = 50 } = params;
    return this.prisma.product.findMany({
      where: {
        ...(lineSlug ? { productLine: { slug: lineSlug } } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { productLine: true },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Accepts an optional transaction client so create/update can read back
  // their own uncommitted writes — the outer `this.prisma` client can't see
  // rows written by an in-flight $transaction until it commits.
  async getByIdForAdmin(id: string, client: PrismaService | Prisma.TransactionClient = this.prisma) {
    const product = await client.product.findUnique({
      where: { id },
      include: {
        productLine: true,
        media: { orderBy: { sortOrder: 'asc' } },
        variants: true,
        wellnessTags: { include: { wellnessTag: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async createProduct(dto: CreateProductDto, actor: ActorInfo, context: RequestInfo = {}) {
    const slug = await this.uniqueSlug(dto.slug ?? dto.name);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            sku: dto.sku,
            name: dto.name,
            slug,
            productLineId: dto.productLineId,
            priceUgx: dto.priceUgx,
            stockQty: dto.stockQty ?? 0,
            status: dto.status ?? ProductStatus.DRAFT,
            scentOrFlavorNotes: dto.scentOrFlavorNotes,
            directions: dto.directions,
            healthBenefits: dto.healthBenefits,
            seoTitle: dto.seoTitle,
            seoMeta: dto.seoMeta,
            vendorId: dto.vendorId,
            costUgx: dto.costUgx,
          },
        });
        if (dto.wellnessTags) await this.replaceWellnessTags(tx, product.id, dto.wellnessTags);
        if (dto.mediaUrls) await this.replaceMedia(tx, product.id, dto.mediaUrls);
        await this.activityLog.record(
          {
            actorUserId: actor.userId,
            actorRole: actor.role as UserRole,
            actorType: deriveActorType(actor.role),
            action: 'PRODUCT_CREATED',
            entityType: 'Product',
            entityId: product.id,
            description: `Created product "${product.name}" (${product.sku})`,
            ...context,
          },
          tx,
        );
        return this.getByIdForAdmin(product.id, tx);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A product with this SKU already exists.');
      }
      throw e;
    }
  }

  async updateProduct(id: string, dto: UpdateProductDto, actor: ActorInfo, context: RequestInfo = {}) {
    const before = await this.getByIdForAdmin(id); // 404s if missing

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id },
          data: {
            sku: dto.sku,
            name: dto.name,
            slug: dto.slug,
            productLineId: dto.productLineId,
            priceUgx: dto.priceUgx,
            stockQty: dto.stockQty,
            status: dto.status,
            scentOrFlavorNotes: dto.scentOrFlavorNotes,
            directions: dto.directions,
            healthBenefits: dto.healthBenefits,
            seoTitle: dto.seoTitle,
            seoMeta: dto.seoMeta,
            vendorId: dto.vendorId,
            costUgx: dto.costUgx,
          },
        });
        if (dto.wellnessTags) await this.replaceWellnessTags(tx, id, dto.wellnessTags);
        if (dto.mediaUrls) await this.replaceMedia(tx, id, dto.mediaUrls);
        await this.activityLog.record(
          {
            actorUserId: actor.userId,
            actorRole: actor.role as UserRole,
            actorType: deriveActorType(actor.role),
            action: 'PRODUCT_UPDATED',
            entityType: 'Product',
            entityId: id,
            description: `Updated product "${before.name}" (${before.sku})`,
            ...context,
          },
          tx,
        );
        return this.getByIdForAdmin(id, tx);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Another product already uses that SKU or slug.');
      }
      throw e;
    }
  }

  // A product with real order history can't be hard-deleted (OrderItem
  // references it, by design — deleting would corrupt past orders), so it's
  // archived instead. Cart items referencing it are dropped either way —
  // carts are ephemeral, unlike order history.
  async deleteOrArchiveProduct(id: string, actor: ActorInfo, context: RequestInfo = {}) {
    const product = await this.getByIdForAdmin(id); // 404s if missing

    const hasOrderHistory = await this.prisma.orderItem.findFirst({ where: { productId: id } });
    const logBase = {
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      entityType: 'Product',
      entityId: id,
      ...context,
    };
    if (hasOrderHistory) {
      await this.prisma.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED } });
      await this.activityLog.record({
        ...logBase,
        action: 'PRODUCT_ARCHIVED',
        description: `Archived product "${product.name}" (${product.sku}) — has order history`,
      });
      return { archived: true, deleted: false };
    }

    await this.prisma.cartItem.deleteMany({ where: { productId: id } });
    await this.prisma.product.delete({ where: { id } });
    await this.activityLog.record({
      ...logBase,
      action: 'PRODUCT_DELETED',
      description: `Deleted product "${product.name}" (${product.sku}) — no order history`,
    });
    return { archived: false, deleted: true };
  }

  private async replaceWellnessTags(tx: Prisma.TransactionClient, productId: string, labels: string[]) {
    await tx.productWellnessTag.deleteMany({ where: { productId } });
    for (const label of labels) {
      const tag = await tx.wellnessTag.upsert({ where: { label }, update: {}, create: { label } });
      await tx.productWellnessTag.create({ data: { productId, wellnessTagId: tag.id } });
    }
  }

  private async replaceMedia(tx: Prisma.TransactionClient, productId: string, urls: string[]) {
    await tx.productMedia.deleteMany({ where: { productId } });
    if (urls.length > 0) {
      await tx.productMedia.createMany({
        data: urls.map((url, sortOrder) => ({ productId, url, sortOrder })),
      });
    }
  }

  private async uniqueSlug(source: string) {
    const base = source
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    let candidate = base;
    let suffix = 2;
    while (await this.prisma.product.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${suffix++}`;
    }
    return candidate;
  }
}
