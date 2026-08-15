import { Controller, Get, Param } from '@nestjs/common';
import { CmsService } from './cms.service';

@Controller('cms')
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Get('pages')
  pages() {
    return this.cms.listPublishedPages();
  }

  @Get('pages/:slug')
  page(@Param('slug') slug: string) {
    return this.cms.getPublishedPageBySlug(slug);
  }

  @Get('banners')
  banners() {
    return this.cms.listActiveBanners();
  }

  @Get('blog')
  blog() {
    return this.cms.listPublishedPosts();
  }

  @Get('social-links')
  socialLinks() {
    return this.cms.listActiveSocialLinks();
  }
}
