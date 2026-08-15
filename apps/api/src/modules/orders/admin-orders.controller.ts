import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

// AL-FR-2 (docs/SRS.md §19) — same pattern as AuthController's loginContext().
function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// FR-23: Order Management (list/detail/status transitions).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'STORE_MANAGER', 'FULFILLMENT')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @Query('status') status?: OrderStatus,
    @Query('search') search?: string,
    @Query('confirmed') confirmed?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.orders.listForAdmin({
      status,
      search,
      confirmedOnly: confirmed === 'true',
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('counts')
  counts() {
    return this.orders.countsByStatus();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.getForAdmin(id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: FastifyRequest,
  ) {
    return this.orders.updateStatus(id, dto.status, user, requestContext(req));
  }
}
