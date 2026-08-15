import { Module } from '@nestjs/common';
import { AccountNotificationsController } from './account-notifications.controller';
import { AccountNotificationsService } from './account-notifications.service';

@Module({
  controllers: [AccountNotificationsController],
  providers: [AccountNotificationsService],
  exports: [AccountNotificationsService],
})
export class AccountNotificationsModule {}
