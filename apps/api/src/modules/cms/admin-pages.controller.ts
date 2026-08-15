import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CmsService } from './cms.service';
import { CreateCmsPageDto } from './dto/create-cms-page.dto';
import { UpdateCmsPageDto } from './dto/update-cms-page.dto';

// AL-FR-2 (docs/SRS.md §19) — same pattern as every other admin controller's requestContext().
function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// FR-27: CMS / Site Builder — Published Pages. The public storefront reads
// whatever's PUBLISHED here via GET /cms/pages.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'STORE_MANAGER')
@Controller('admin/pages')
export class AdminPagesController {
  constructor(private readonly cms: CmsService) {}

  @Get()
  list() {
    return this.cms.listPagesForAdmin();
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string; role: string },
    @Body() dto: CreateCmsPageDto,
    @Req() req: FastifyRequest,
  ) {
    return this.cms.createPage(dto, user, requestContext(req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: UpdateCmsPageDto,
    @Req() req: FastifyRequest,
  ) {
    return this.cms.updatePage(id, dto, user, requestContext(req));
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return this.cms.deletePage(id, user, requestContext(req));
  }
}
