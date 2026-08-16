import { Module } from '@nestjs/common';
import { GeocodingModule } from '../../common/geocoding/geocoding.module';
import { NotificationsModule } from '../../common/notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminDeliveriesController } from './admin-deliveries.controller';
import { DeliveryService } from './delivery.service';
import { MyDeliveriesController } from './my-deliveries.controller';

@Module({
  imports: [OrdersModule, NotificationsModule, GeocodingModule],
  controllers: [AdminDeliveriesController, MyDeliveriesController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
