import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ComputeVendorPayoutDto, CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';
import { VendorPayoutsService } from './vendor-payouts.service';
import { VendorsService } from './vendors.service';

// MKT-FR-1/2 (docs/SRS.md §21): marketplace vendor management. OWNER/
// STORE_MANAGER, same access tier as Product Manager (FR-21/22) — assigning
// a vendor to a product is part of the same catalog-management workflow.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'STORE_MANAGER')
@Controller('admin/vendors')
export class VendorsController {
  constructor(
    private readonly vendors: VendorsService,
    private readonly payouts: VendorPayoutsService,
  ) {}

  @Get()
  list() {
    return this.vendors.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.vendors.getById(id);
  }

  @Post()
  create(@Body() dto: CreateVendorDto) {
    return this.vendors.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.vendors.update(id, dto);
  }

  @Get(':id/payouts')
  listPayouts(@Param('id') id: string) {
    return this.payouts.list(id);
  }

  @Post(':id/payouts')
  computePayout(@Param('id') id: string, @Body() dto: ComputeVendorPayoutDto) {
    return this.payouts.computePayout(id, dto);
  }

  @Post('payouts/:payoutId/mark-paid')
  markPaid(@Param('payoutId') payoutId: string) {
    return this.payouts.markPaid(payoutId);
  }

  @Get('payouts/all')
  @Roles('OWNER')
  listAllPayouts(@Query('vendorId') vendorId?: string) {
    return this.payouts.list(vendorId);
  }
}
