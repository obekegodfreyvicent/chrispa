import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { DeliveryService } from './delivery.service';

function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// Driver self-service — a driver only ever sees/touches their own assigned
// deliveries (every DeliveryService method here is scoped by driverId, not
// just by role), same ownership-checked pattern as the customer-account
// self-service modules (wishlist/addresses/payment-methods).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DRIVER')
@Controller('driver/deliveries')
export class MyDeliveriesController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.delivery.listMine(user.userId);
  }

  @Get(':id')
  get(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.delivery.getMine(user.userId, id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @Req() req: FastifyRequest,
  ) {
    return this.delivery.updateStatus(user.userId, id, dto.status, dto.lat, dto.lng, user, requestContext(req));
  }

  @Patch(':id/location')
  updateLocation(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.delivery.updateLocation(user.userId, id, dto.lat, dto.lng);
  }
}
