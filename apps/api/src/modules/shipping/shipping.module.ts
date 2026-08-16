import { Module } from '@nestjs/common';
import { AdminShippingZonesController } from './admin-shipping-zones.controller';
import { ShippingQuoteController } from './shipping-quote.controller';
import { ShippingZonesService } from './shipping-zones.service';

@Module({
  controllers: [AdminShippingZonesController, ShippingQuoteController],
  providers: [ShippingZonesService],
  exports: [ShippingZonesService],
})
export class ShippingModule {}
