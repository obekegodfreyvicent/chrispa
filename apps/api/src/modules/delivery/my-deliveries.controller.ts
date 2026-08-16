import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { DeliveryService } from './delivery.service';

function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// Driver self-service — a driver only ever sees/touches their own assigned
// deliveries (every DeliveryService method here is scoped by driverId, not
// just by role), same ownership-checked pattern as the customer-account
// self-service modules (wishlist/addresses/payment-methods).
//
// list()/get() are also open to OWNER/STORE_MANAGER/FULFILLMENT (per user
// decision) as a read-only oversight view of every driver's deliveries on
// this same page/UI — they're not drivers themselves, so DeliveryService
// branches on role rather than always scoping by driverId (see
// listMine()/getMine()'s comments). The physical delivery actions
// (status/location updates, own availability toggle) stay DRIVER-only —
// an admin isn't the one holding the package, so nothing here lets them
// act on another driver's delivery, only view it.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class MyDeliveriesController {
  constructor(private readonly delivery: DeliveryService) {}

  // Not under /driver/deliveries — this is the driver's own account-level
  // availability flag, not scoped to any one delivery.
  @Roles('DRIVER')
  @Get('driver/status')
  getStatus(@CurrentUser() user: { userId: string }) {
    return this.delivery.getMyStatus(user.userId);
  }

  @Roles('DRIVER')
  @Patch('driver/status')
  setStatus(@CurrentUser() user: { userId: string }, @Body() dto: UpdateDriverStatusDto) {
    return this.delivery.setMyStatus(user.userId, dto.status);
  }

  @Roles('DRIVER', 'OWNER', 'STORE_MANAGER', 'FULFILLMENT')
  @Get('driver/deliveries')
  list(@CurrentUser() user: { userId: string; role: string }) {
    return this.delivery.listMine(user.userId, user.role as UserRole);
  }

  @Roles('DRIVER', 'OWNER', 'STORE_MANAGER', 'FULFILLMENT')
  @Get('driver/deliveries/:id')
  get(@CurrentUser() user: { userId: string; role: string }, @Param('id') id: string) {
    return this.delivery.getMine(user.userId, user.role as UserRole, id);
  }

  @Roles('DRIVER')
  @Patch('driver/deliveries/:id/status')
  updateStatus(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @Req() req: FastifyRequest,
  ) {
    return this.delivery.updateStatus(user.userId, id, dto.status, dto.lat, dto.lng, user, requestContext(req));
  }

  @Roles('DRIVER')
  @Patch('driver/deliveries/:id/location')
  updateLocation(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.delivery.updateLocation(user.userId, id, dto.lat, dto.lng);
  }
}
