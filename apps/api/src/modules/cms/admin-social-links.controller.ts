import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CmsService } from './cms.service';
import { CreateSocialLinkDto } from './dto/create-social-link.dto';
import { UpdateSocialLinkDto } from './dto/update-social-link.dto';

// AL-FR-2 (docs/SRS.md §19) — same pattern as every other admin controller's requestContext().
function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// FR-19.2/FR-1.6: Social Media Accounts — the storefront footer and Account
// → Connected & Social both read whatever's active here (GET /cms/social-links,
// public). Same role set as the rest of CMS/marketing admin writes.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'STORE_MANAGER')
@Controller('admin/social-links')
export class AdminSocialLinksController {
  constructor(private readonly cms: CmsService) {}

  @Get()
  list() {
    return this.cms.listSocialLinksForAdmin();
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string; role: string },
    @Body() dto: CreateSocialLinkDto,
    @Req() req: FastifyRequest,
  ) {
    return this.cms.createSocialLink(dto, user, requestContext(req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: UpdateSocialLinkDto,
    @Req() req: FastifyRequest,
  ) {
    return this.cms.updateSocialLink(id, dto, user, requestContext(req));
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return this.cms.deleteSocialLink(id, user, requestContext(req));
  }
}
