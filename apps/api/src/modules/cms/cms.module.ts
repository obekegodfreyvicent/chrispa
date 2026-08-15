import { Module } from '@nestjs/common';
import { AdminBannersController } from './admin-banners.controller';
import { AdminPagesController } from './admin-pages.controller';
import { AdminSocialLinksController } from './admin-social-links.controller';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';

@Module({
  controllers: [CmsController, AdminSocialLinksController, AdminPagesController, AdminBannersController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
