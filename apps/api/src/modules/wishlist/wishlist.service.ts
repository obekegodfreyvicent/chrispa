import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// FR-15: Wishlist / Favorites.
@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: { include: { productLine: true, media: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Idempotent — adding a product already on the wishlist is a no-op, not an error.
  async add(userId: string, productId: string) {
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
    return this.list(userId);
  }

  async remove(userId: string, productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return this.list(userId);
  }
}
