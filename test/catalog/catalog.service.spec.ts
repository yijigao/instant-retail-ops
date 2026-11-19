import { CatalogService } from '../../src/catalog/catalog.service';
import { ConflictError, NotFoundError } from '../../src/common/errors';
import { SkuMaster } from '../../src/catalog/entities/sku-master.entity';

/**
 * Unit tests for the golden module's service layer.
 * Repository is faked in-memory; integration tests against a real Postgres
 * (migrations up/down + repository round-trips) live in catalog.int-spec.ts
 * and run in CI with a throwaway database.
 */
function fakeRepo() {
  const rows = new Map<number, SkuMaster>();
  let seq = 0;
  return {
    rows,
    create: jest.fn(async (merchantId: number, dto: any) => {
      const sku: SkuMaster = {
        id: ++seq,
        merchantId,
        name: dto.name,
        barcode: dto.barcode ?? null,
        category: dto.category ?? null,
        baseUnit: dto.baseUnit,
        costCents: dto.costCents ?? 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rows.set(sku.id, sku);
      return sku;
    }),
    findById: jest.fn(async (merchantId: number, id: number) => {
      const sku = rows.get(id);
      return sku && sku.merchantId === merchantId ? sku : null;
    }),
    findByBarcode: jest.fn(async (merchantId: number, barcode: string) => {
      for (const sku of rows.values()) {
        if (sku.merchantId === merchantId && sku.barcode === barcode) return sku;
      }
      return null;
    }),
    update: jest.fn(async (merchantId: number, id: number, dto: any) => {
      const sku = rows.get(id);
      if (!sku || sku.merchantId !== merchantId) return null;
      Object.assign(sku, {
        name: dto.name ?? sku.name,
        category: dto.category ?? sku.category,
        costCents: dto.costCents ?? sku.costCents,
      });
      return sku;
    }),
    archive: jest.fn(async (merchantId: number, id: number) => {
      const sku = rows.get(id);
      if (!sku || sku.merchantId !== merchantId || sku.status === 'archived') return false;
      sku.status = 'archived';
      return true;
    }),
  };
}

describe('CatalogService (golden module)', () => {
  it('creates a sku', async () => {
    const svc = new CatalogService(fakeRepo() as any);
    const sku = await svc.createSku(1, { name: 'Coke 330ml', baseUnit: 'piece', barcode: '6901234' });
    expect(sku.id).toBeGreaterThan(0);
    expect(sku.status).toBe('active');
  });

  it('rejects a duplicate barcode for the same merchant', async () => {
    const svc = new CatalogService(fakeRepo() as any);
    await svc.createSku(1, { name: 'A', baseUnit: 'piece', barcode: '111' });
    await expect(svc.createSku(1, { name: 'B', baseUnit: 'piece', barcode: '111' }))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it('allows the same barcode for a different merchant', async () => {
    const svc = new CatalogService(fakeRepo() as any);
    await svc.createSku(1, { name: 'A', baseUnit: 'piece', barcode: '111' });
    await expect(svc.createSku(2, { name: 'B', baseUnit: 'piece', barcode: '111' }))
      .resolves.toMatchObject({ merchantId: 2 });
  });

  it('throws NotFoundError for a missing sku', async () => {
    const svc = new CatalogService(fakeRepo() as any);
    await expect(svc.getSku(1, 999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('never leaks another merchant\'s sku', async () => {
    const svc = new CatalogService(fakeRepo() as any);
    const sku = await svc.createSku(1, { name: 'A', baseUnit: 'piece' });
    await expect(svc.getSku(2, sku.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
