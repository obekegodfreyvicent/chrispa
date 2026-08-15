import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';

// AL-FR-2 (docs/SRS.md §19) — same pattern as AdminOrdersController's requestContext().
function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.orders.listForUser(user.userId);
  }

  @Get(':id')
  get(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.orders.getForUser(user.userId, id);
  }

  // PAY-FR-5: the customer's own "goods received in good condition"
  // confirmation — unlocks the printable receipt.
  @Patch(':id/confirm-receipt')
  confirmReceipt(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Req() req: FastifyRequest) {
    return this.orders.confirmReceipt(user.userId, id, requestContext(req));
  }
}
