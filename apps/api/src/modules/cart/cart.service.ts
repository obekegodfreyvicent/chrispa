import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// FR-4: Cart persists to the customer's account and syncs across devices
@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateCart(userId: string) {
    const existing = await this.prisma.cart.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { userId } });
  }

  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    return this.prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      // product.variants (the full list, not just the selected one) lets the
      // cart UI offer a size/variant switcher per line item.
      include: { items: { include: { product: { include: { variants: true } }, variant: true } } },
    });
  }

  async addItem(userId: string, productId: string, variantId: string | undefined, qty = 1) {
    const cart = await this.getOrCreateCart(userId);
    // Postgres treats each NULL as distinct, so a compound-unique upsert on
    // (cartId, productId, variantId) can't be relied on when variantId is null —
    // look the row up explicitly instead.
    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId, variantId: variantId ?? null },
    });
    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { qty: { increment: qty } },
      });
    } else {
      await this.prisma.cartItem.create({ data: { cartId: cart.id, productId, variantId, qty } });
    }
    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, data: { qty?: number; variantId?: string }) {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');

    if (data.variantId !== undefined && data.variantId !== item.variantId) {
      const variant = await this.prisma.variant.findUnique({ where: { id: data.variantId } });
      if (!variant || variant.productId !== item.productId) {
        throw new BadRequestException('Variant does not belong to this product');
      }
      // Switching to a variant another line already holds must merge into
      // that line rather than create a second row for the same product+variant
      // pair — the same dedupe rule addItem() enforces on insert.
      const dupe = await this.prisma.cartItem.findFirst({
        where: { cartId: cart.id, productId: item.productId, variantId: data.variantId, id: { not: item.id } },
      });
      if (dupe) {
        await this.prisma.cartItem.update({
          where: { id: dupe.id },
          data: { qty: { increment: data.qty ?? item.qty } },
        });
        await this.prisma.cartItem.delete({ where: { id: item.id } });
        return this.getCart(userId);
      }
    }

    await this.prisma.cartItem.update({
      where: { id: itemId, cartId: cart.id },
      data: {
        ...(data.qty !== undefined ? { qty: data.qty } : {}),
        ...(data.variantId !== undefined ? { variantId: data.variantId } : {}),
      },
    });
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.delete({ where: { id: itemId, cartId: cart.id } });
    return this.getCart(userId);
  }
}
