import { Body, Controller, Post } from '@nestjs/common';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { MarketingService } from './marketing.service';

// FR-1.6: storefront footer newsletter signup — public, unauthenticated,
// same "top-level public resource" shape as /cms's public GET endpoints
// (see cms.controller.ts). Guarded only by the app-wide default throttle
// (ThrottlerModule.forRoot in app.module.ts), same as every other public
// write endpoint in this codebase.
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly marketing: MarketingService) {}

  @Post('subscribe')
  subscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.marketing.subscribeNewsletter(dto.email);
  }

  @Post('unsubscribe')
  unsubscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.marketing.unsubscribeNewsletter(dto.email);
  }
}
