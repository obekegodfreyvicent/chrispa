import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { DeliveryService } from './delivery.service';

// AL-FR-2 (docs/SRS.md §19) — same pattern as AuthController's loginContext().
function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// Same RBAC boundary as AdminOrdersController — driver assignment is an
// order-management action, not a separate permission.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'STORE_MANAGER', 'FULFILLMENT')
@Controller()
export class AdminDeliveriesController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get('admin/drivers')
  listDrivers() {
    return this.delivery.listDrivers();
  }

  // Feeds the admin Dashboard's "active deliveries" widget — see
  // DeliveryService.adminSummary()'s comment on why this is computed on
  // read rather than a stored/cached metric.
  @Get('admin/deliveries/summary')
  summary() {
    return this.delivery.adminSummary();
  }

  @Patch('admin/orders/:id/assign-driver')
  assign(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: AssignDriverDto,
    @Req() req: FastifyRequest,
  ) {
    return this.delivery.assign(id, dto.driverId, dto.priority, user, requestContext(req));
  }
}
