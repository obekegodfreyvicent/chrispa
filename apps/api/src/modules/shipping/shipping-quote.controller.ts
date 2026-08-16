import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ShippingZonesService } from './shipping-zones.service';

// Public (no auth) — the storefront checkout page calls this as the
// customer types their city, to show real per-delivery-method fees before
// they submit. CheckoutService independently recomputes the same quote
// server-side at order-creation time (never trusts anything the client
// sends), so this endpoint is display-only, not the security boundary.
@Controller('shipping')
export class ShippingQuoteController {
  constructor(private readonly shippingZones: ShippingZonesService) {}

  @Get('quote')
  quote(@Query('city') city?: string) {
    if (!city?.trim()) throw new BadRequestException('city is required');
    return this.shippingZones.quote(city);
  }
}
