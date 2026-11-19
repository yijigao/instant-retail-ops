/**
 * GOLDEN reference module — catalog.
 *
 * Every other module in this repo must match this layout and style:
 *   entities/      plain row types, one per table, no behaviour
 *   dto/           validated request shapes (class-validator decorators)
 *   repositories/  the ONLY place SQL lives; parameterised queries only
 *   *.service.ts   business logic; throws typed errors from ../common/errors
 *   *.controller.ts thin HTTP layer; no logic beyond auth + delegation
 *   *.module.ts    Nest wiring
 *
 * Conventions:
 * - Money is integer cents. Quantities are numeric strings at the DB edge,
 *   converted with `Number(...)` exactly once, in the repository.
 * - Errors are typed (NotFoundError, ConflictError, ValidationError) and
 *   mapped to HTTP status in one global filter — never ad-hoc `throw new Error`.
 * - Multi-row writes happen inside `withTransaction(...)`; services never
 *   touch the pool directly.
 */

export type SkuStatus = 'active' | 'archived';

export interface SkuMaster {
  id: number;
  merchantId: number;
  name: string;
  barcode: string | null;
  category: string | null;
  baseUnit: string;
  costCents: number;
  status: SkuStatus;
  createdAt: Date;
  updatedAt: Date;
}
