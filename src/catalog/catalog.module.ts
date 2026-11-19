import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PG_POOL, SkuRepository } from './repositories/sku.repository';
import { Pool } from 'pg';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    SkuRepository,
    {
      provide: PG_POOL,
      useFactory: () =>
        new Pool({ connectionString: process.env.DATABASE_URL }),
    },
  ],
  exports: [CatalogService, SkuRepository],
})
export class CatalogModule {}
