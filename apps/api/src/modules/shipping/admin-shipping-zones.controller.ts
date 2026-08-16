import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateShippingZoneDto } from './dto/create-shipping-zone.dto';
import { UpdateShippingZoneDto } from './dto/update-shipping-zone.dto';
import { ShippingZonesService } from './shipping-zones.service';

function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// Admin-managed shipping pricing (per user decision, not in the original
// SRS) — OWNER/STORE_MANAGER, same authority as pricing-adjacent Marketing/
// CMS CRUD (Coupons, Banners). Not folded into DepartmentPermission's
// resource matrix (see that model's schema comment) — same "role check
// alone is the real boundary" precedent as Financial & Accounting, which
// also has no PermissionResource entry.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'STORE_MANAGER')
@Controller('admin/shipping-zones')
export class AdminShippingZonesController {
  constructor(private readonly shippingZones: ShippingZonesService) {}

  @Get()
  list() {
    return this.shippingZones.list();
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string; role: string },
    @Body() dto: CreateShippingZoneDto,
    @Req() req: FastifyRequest,
  ) {
    return this.shippingZones.create(dto, user, requestContext(req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: UpdateShippingZoneDto,
    @Req() req: FastifyRequest,
  ) {
    return this.shippingZones.update(id, dto, user, requestContext(req));
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return this.shippingZones.remove(id, user, requestContext(req));
  }
}
