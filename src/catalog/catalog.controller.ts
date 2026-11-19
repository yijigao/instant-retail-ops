import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateSkuDto, UpdateSkuDto } from './dto/sku.dto';

/**
 * Thin HTTP layer. `merchantId` comes from the auth guard in production;
 * it is a path-scoped stand-in here so the golden module stays self-contained.
 */
@Controller('merchants/:merchantId/skus')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post()
  create(
    @Param('merchantId', ParseIntPipe) merchantId: number,
    @Body() dto: CreateSkuDto,
  ) {
    return this.catalog.createSku(merchantId, dto);
  }

  @Get(':id')
  get(
    @Param('merchantId', ParseIntPipe) merchantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.catalog.getSku(merchantId, id);
  }

  @Patch(':id')
  update(
    @Param('merchantId', ParseIntPipe) merchantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSkuDto,
  ) {
    return this.catalog.updateSku(merchantId, id, dto);
  }

  @Delete(':id')
  archive(
    @Param('merchantId', ParseIntPipe) merchantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.catalog.archiveSku(merchantId, id);
  }
}
