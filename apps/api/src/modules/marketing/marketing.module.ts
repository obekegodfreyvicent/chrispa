import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../common/notifications/notifications.module';
import { AccountNotificationsModule } from '../account-notifications/account-notifications.module';
import { CmsModule } from '../cms/cms.module';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { NewsletterController } from './newsletter.controller';

@Module({
  imports: [NotificationsModule, AccountNotificationsModule, CmsModule],
  controllers: [MarketingController, NewsletterController],
  providers: [MarketingService],
})
export class MarketingModule {}
