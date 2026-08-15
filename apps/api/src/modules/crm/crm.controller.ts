import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CrmService } from './crm.service';

// Read-only for FULFILLMENT (method-level @Roles overrides the class-level
// one — see the comment in admin-products.controller.ts for why).
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
}
