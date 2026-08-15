import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { WishlistService } from './wishlist.service';

@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.wishlist.list(user.userId);
  }

  @Post()
  add(@CurrentUser() user: { userId: string }, @Body() dto: AddWishlistItemDto) {
    return this.wishlist.add(user.userId, dto.productId);
  }

  @Delete(':productId')
  remove(@CurrentUser() user: { userId: string }, @Param('productId') productId: string) {
    return this.wishlist.remove(user.userId, productId);
  }
}
