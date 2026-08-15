import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [FinanceModule, PaymentsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
