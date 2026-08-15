import { Module } from '@nestjs/common';
import { VendorPayoutsService } from './vendor-payouts.service';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';

// MKT-FR-1/2 (docs/SRS.md §21): the marketplace/vendor side of Financial &
// Accounting Management. VendorsService is exported so FinanceModule's
// RevenueRecognitionService can look up a vendor's commission rate at
// order-delivery time without a circular module import back the other way.
@Module({
  controllers: [VendorsController],
  providers: [VendorsService, VendorPayoutsService],
  exports: [VendorsService],
})
export class MarketplaceModule {}
