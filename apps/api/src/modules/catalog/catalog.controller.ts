import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('product-lines')
  productLines() {
    return this.catalog.listProductLines();
  }

  @Get('wellness-tags')
  wellnessTags() {
    return this.catalog.listWellnessTags();
  }

  @Get('products')
  products(
    @Query('line') lineSlug?: string,
    @Query('wellness') wellnessTag?: string,
    @Query('search') search?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('rating') rating?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.catalog.listProducts({
      lineSlug,
      wellnessTag,
      search,
      minPriceUgx: minPrice ? parseInt(minPrice, 10) : undefined,
      maxPriceUgx: maxPrice ? parseInt(maxPrice, 10) : undefined,
      minRating: rating ? parseInt(rating, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.catalog.getProductBySlug(slug);
  }
}
