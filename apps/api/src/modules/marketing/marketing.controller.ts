import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SendNewsletterDto } from './dto/send-newsletter.dto';
import { MarketingService } from './marketing.service';

// Read-only for FULFILLMENT (method-level @Roles overrides the class-level
// one — see the comment in admin-products.controller.ts for why).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'STORE_MANAGER')
@Controller('admin/marketing')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Roles('OWNER', 'STORE_MANAGER', 'FULFILLMENT')
  @Get('coupons')
  coupons() {
    return this.marketing.listCoupons();
  }

  @Roles('OWNER', 'STORE_MANAGER', 'FULFILLMENT')
  @Get('bundles')
  bundles() {
    return this.marketing.listBundles();
  }

  @Roles('OWNER', 'STORE_MANAGER', 'FULFILLMENT')
  @Get('newsletter-subscribers')
  newsletterSubscribers() {
    return this.marketing.listNewsletterSubscribers();
  }

  @Roles('OWNER', 'STORE_MANAGER', 'FULFILLMENT')
  @Get('newsletter/campaigns')
  newsletterCampaigns() {
    return this.marketing.listNewsletterCampaigns();
  }

  // No FULFILLMENT override here, unlike the reads above — composing and
  // sending a newsletter is a write action, same OWNER/STORE_MANAGER-only
  // scope as every other marketing write in this codebase (see the class-
  // level @Roles()).
  @Post('newsletter/send')
  sendNewsletter(
    @CurrentUser() user: { userId: string; role: string },
    @Body() dto: SendNewsletterDto,
  ) {
    return this.marketing.sendNewsletter(dto, user);
  }
}
