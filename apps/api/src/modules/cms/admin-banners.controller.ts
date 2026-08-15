import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CmsService } from './cms.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

// AL-FR-2 (docs/SRS.md §19) — same pattern as every other admin controller's requestContext().
function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// FR-27: CMS / Site Builder — Active Banners. The public storefront reads
// whatever's isActive here via GET /cms/banners. Image upload reuses the
// existing generic upload endpoint, POST /admin/products/media/upload
// (same allowed types/5MB cap) — no separate banner-upload endpoint needed.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'STORE_MANAGER')
@Controller('admin/banners')
export class AdminBannersController {
  constructor(private readonly cms: CmsService) {}

  @Get()
  list() {
    return this.cms.listBannersForAdmin();
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string; role: string },
    @Body() dto: CreateBannerDto,
    @Req() req: FastifyRequest,
  ) {
    return this.cms.createBanner(dto, user, requestContext(req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
    @Req() req: FastifyRequest,
  ) {
    return this.cms.updateBanner(id, dto, user, requestContext(req));
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return this.cms.deleteBanner(id, user, requestContext(req));
  }
}
