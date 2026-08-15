import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// AL-FR-2 (docs/SRS.md §19): best-effort client info attached to every
// logged write below — same pattern as AuthController's loginContext().
function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// FR-21/FR-22: Product Manager + Add/Edit Product (write side). Writes stay
// OWNER/STORE_MANAGER only; the two GET routes below carry their own
// broader @Roles so FULFILLMENT gets read-only visibility (they need to
// know what they're shipping) without gaining write access — RolesGuard
// uses method-level @Roles when present, falling back to this class-level
// one otherwise.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'STORE_MANAGER')
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Roles('OWNER', 'STORE_MANAGER', 'FULFILLMENT')
  @Get()
  list(@Query('search') search?: string, @Query('line') line?: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.catalog.listForAdmin({
      search,
      lineSlug: line,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Roles('OWNER', 'STORE_MANAGER', 'FULFILLMENT')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.catalog.getByIdForAdmin(id);
  }

  // Standalone upload — a product's media has no owning row yet on the "Add
  // Product" form, so the file is uploaded first and the returned URL rides
  // in CreateProductDto.mediaUrls like a pasted URL always did. multipart/
  // form-data — @fastify/multipart (registered in main.ts) decorates the
  // request with .file(); same pattern as ProfileController.uploadAvatar().
  @Post('media/upload')
  async uploadMedia(@Req() req: FastifyRequest) {
    const file = await req.file();
    return this.catalog.uploadMedia(file);
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string; role: string },
    @Body() dto: CreateProductDto,
    @Req() req: FastifyRequest,
  ) {
    return this.catalog.createProduct(dto, user, requestContext(req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: FastifyRequest,
  ) {
    return this.catalog.updateProduct(id, dto, user, requestContext(req));
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string; role: string }, @Param('id') id: string, @Req() req: FastifyRequest) {
    return this.catalog.deleteOrArchiveProduct(id, user, requestContext(req));
  }
}
