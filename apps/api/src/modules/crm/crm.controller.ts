import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CrmService } from './crm.service';
import { SuspendCustomerDto } from './dto/suspend-customer.dto';

// AL-FR-2 (docs/SRS.md §19) — same pattern as AuthController's loginContext().
function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// Read-only for FULFILLMENT (method-level @Roles overrides the class-level
// one — see the comment in admin-products.controller.ts for why). Suspend/
// reactivate/delete are OWNER/STORE_MANAGER only — not exposed to
// FULFILLMENT, same write-access boundary as the class-level default.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'STORE_MANAGER')
@Controller('admin/customers')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Roles('OWNER', 'STORE_MANAGER', 'FULFILLMENT')
  @Get()
  list() {
    return this.crm.list();
  }

  @Patch(':id/suspend')
  suspend(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: SuspendCustomerDto,
    @Req() req: FastifyRequest,
  ) {
    return this.crm.suspend(id, dto.reason, user, requestContext(req));
  }

  @Patch(':id/reactivate')
  reactivate(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return this.crm.reactivate(id, user, requestContext(req));
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return this.crm.remove(id, user, requestContext(req));
  }
}
