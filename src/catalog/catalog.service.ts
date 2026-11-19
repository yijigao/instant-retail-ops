import { Injectable } from '@nestjs/common';
import { SkuRepository } from './repositories/sku.repository';
import { CreateSkuDto, UpdateSkuDto } from './dto/sku.dto';
import { SkuMaster } from './entities/sku-master.entity';
import { ConflictError, NotFoundError } from '../common/errors';

@Injectable()
export class CatalogService {
  constructor(private readonly skus: SkuRepository) {}

  async createSku(merchantId: number, dto: CreateSkuDto): Promise<SkuMaster> {
    if (dto.barcode) {
      const existing = await this.skus.findByBarcode(merchantId, dto.barcode);
      if (existing) {
        throw new ConflictError(`barcode ${dto.barcode} already exists for this merchant`);
      }
    }
    return this.skus.create(merchantId, dto);
  }

  async getSku(merchantId: number, id: number): Promise<SkuMaster> {
    const sku = await this.skus.findById(merchantId, id);
    if (!sku) throw new NotFoundError(`sku ${id}`);
    return sku;
  }

  async updateSku(merchantId: number, id: number, dto: UpdateSkuDto): Promise<SkuMaster> {
    const updated = await this.skus.update(merchantId, id, dto);
    if (!updated) throw new NotFoundError(`sku ${id}`);
    return updated;
  }

  async archiveSku(merchantId: number, id: number): Promise<void> {
    const ok = await this.skus.archive(merchantId, id);
    if (!ok) throw new NotFoundError(`sku ${id}`);
  }
}
