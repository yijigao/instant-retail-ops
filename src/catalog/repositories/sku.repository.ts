import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { SkuMaster } from '../entities/sku-master.entity';
import { CreateSkuDto, UpdateSkuDto } from '../dto/sku.dto';

export const PG_POOL = Symbol('PG_POOL');

type Executor = Pool | PoolClient;

interface SkuRow {
  id: string;
  merchant_id: string;
  name: string;
  barcode: string | null;
  category: string | null;
  base_unit: string;
  cost_cents: number;
  status: 'active' | 'archived';
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: SkuRow): SkuMaster {
  return {
    id: Number(row.id),
    merchantId: Number(row.merchant_id),
    name: row.name,
    barcode: row.barcode,
    category: row.category,
    baseUnit: row.base_unit,
    costCents: row.cost_cents,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The only place SQL for `sku_master` exists. All queries are parameterised;
 * all reads are merchant-scoped — there is no code path that can read or
 * write another merchant's rows.
 */
@Injectable()
export class SkuRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(merchantId: number, dto: CreateSkuDto, db: Executor = this.pool): Promise<SkuMaster> {
    const { rows } = await db.query<SkuRow>(
      `INSERT INTO sku_master (merchant_id, name, barcode, category, base_unit, cost_cents)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [merchantId, dto.name, dto.barcode ?? null, dto.category ?? null, dto.baseUnit, dto.costCents ?? 0],
    );
    return toEntity(rows[0]);
  }

  async findById(merchantId: number, id: number, db: Executor = this.pool): Promise<SkuMaster | null> {
    const { rows } = await db.query<SkuRow>(
      `SELECT * FROM sku_master WHERE merchant_id = $1 AND id = $2`,
      [merchantId, id],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByBarcode(merchantId: number, barcode: string, db: Executor = this.pool): Promise<SkuMaster | null> {
    const { rows } = await db.query<SkuRow>(
      `SELECT * FROM sku_master WHERE merchant_id = $1 AND barcode = $2`,
      [merchantId, barcode],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async update(merchantId: number, id: number, dto: UpdateSkuDto, db: Executor = this.pool): Promise<SkuMaster | null> {
    const { rows } = await db.query<SkuRow>(
      `UPDATE sku_master
          SET name = COALESCE($3, name),
              category = COALESCE($4, category),
              cost_cents = COALESCE($5, cost_cents),
              updated_at = now()
        WHERE merchant_id = $1 AND id = $2
        RETURNING *`,
      [merchantId, id, dto.name ?? null, dto.category ?? null, dto.costCents ?? null],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async archive(merchantId: number, id: number, db: Executor = this.pool): Promise<boolean> {
    const { rowCount } = await db.query(
      `UPDATE sku_master SET status = 'archived', updated_at = now()
        WHERE merchant_id = $1 AND id = $2 AND status <> 'archived'`,
      [merchantId, id],
    );
    return (rowCount ?? 0) > 0;
  }
}
