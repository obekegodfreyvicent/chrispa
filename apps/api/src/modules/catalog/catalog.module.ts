import { Module } from '@nestjs/common';
import { AdminProductsController } from './admin-products.controller';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController, AdminProductsController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
