import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AdminDeliveriesController } from './admin-deliveries.controller';
import { DeliveryService } from './delivery.service';
import { MyDeliveriesController } from './my-deliveries.controller';

@Module({
  imports: [OrdersModule],
  controllers: [AdminDeliveriesController, MyDeliveriesController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
