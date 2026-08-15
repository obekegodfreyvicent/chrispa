import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { FlutterwaveService } from './flutterwave.service';
import { AdminPaymentsController, PaymentsWebhookController } from './payments.controller';
import { PaymentsService } from './payments.service';

// PAY-FR-1..4 (docs/SRS.md §21): the Flutterwave gateway integration.
// Imports FinanceModule for RevenueRecognitionService (deferred-revenue
// posting on payment success, reversal on refund) — exported so
// CheckoutModule/OrdersModule can call PaymentsService directly.
@Module({
  imports: [FinanceModule],
  controllers: [PaymentsWebhookController, AdminPaymentsController],
  providers: [FlutterwaveService, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
