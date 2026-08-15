import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddItemDto, UpdateItemDto } from './dto/add-item.dto';
import { CartService } from './cart.service';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser() user: { userId: string }) {
    return this.cart.getCart(user.userId);
  }

  @Post('items')
  addItem(@CurrentUser() user: { userId: string }, @Body() dto: AddItemDto) {
    return this.cart.addItem(user.userId, dto.productId, dto.variantId, dto.qty ?? 1);
  }

  @Patch('items/:itemId')
  updateItem(
    @CurrentUser() user: { userId: string },
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.cart.updateItem(user.userId, itemId, dto);
  }

  @Delete('items/:itemId')
  removeItem(@CurrentUser() user: { userId: string }, @Param('itemId') itemId: string) {
    return this.cart.removeItem(user.userId, itemId);
  }
}
