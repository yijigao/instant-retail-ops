# Instant Retail Ops — Schema (FROZEN v1)

Status: **FROZEN**. This file is the single source of truth for the data model.
Agent sessions must implement exactly what is written here. Any change requires
a human-approved schema PR *before* code changes.

Platform: PostgreSQL 15+. All timestamps are `timestamptz` in UTC.
All primary keys are `bigint GENERATED ALWAYS AS IDENTITY` unless noted.
Money is stored as integer cents (`*_cents int`), never floats.

Conventions:

- Every table has `created_at timestamptz NOT NULL DEFAULT now()` and
  `updated_at timestamptz NOT NULL DEFAULT now()` unless noted.
- Soft state changes go through status enums, never row deletion.
- `inventory_ledger` is append-only: no UPDATE, no DELETE, ever.

---

## 1. `sku_master` — the merchant's own canonical product

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | bigint identity | PK | |
| merchant_id | bigint | NOT NULL, index | tenant |
| name | text | NOT NULL | display name |
| barcode | text | NULL, unique per merchant where not null | EAN/UPC if known |
| category | text | NULL | free-form v1 |
| base_unit | text | NOT NULL | e.g. `piece`, `g`, `ml`, `pack` |
| cost_cents | int | NOT NULL DEFAULT 0 | purchase cost |
| status | text | NOT NULL DEFAULT 'active' | `active` \| `archived` |
| created_at / updated_at | timestamptz | | |

Unique: `(merchant_id, barcode)` where `barcode IS NOT NULL`.

## 2. `platform_listing` — one product as it appears on one platform

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | bigint identity | PK | |
| merchant_id | bigint | NOT NULL, index | |
| platform | text | NOT NULL | `meituan` \| `eleme` \| `jd` |
| platform_item_id | text | NOT NULL | platform-side product id |
| platform_sku_id | text | NULL | platform-side sku id when distinct |
| title | text | NOT NULL | title as shown on the platform |
| price_cents | int | NOT NULL | current listed price |
| status | text | NOT NULL DEFAULT 'on_sale' | `on_sale` \| `off_sale` \| `unknown` |
| last_synced_at | timestamptz | NULL | last successful push/pull |
| created_at / updated_at | timestamptz | | |

Unique: `(merchant_id, platform, platform_item_id, platform_sku_id)`.

## 3. `sku_mapping` — platform listing ↔ master SKU, with unit conversion

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | bigint identity | PK | |
| merchant_id | bigint | NOT NULL, index | |
| listing_id | bigint | NOT NULL, FK → platform_listing.id | |
| sku_id | bigint | NOT NULL, FK → sku_master.id | |
| conversion_factor | numeric(12,4) | NOT NULL DEFAULT 1 | 1 platform unit = factor × base units (e.g. a 6-pack sold as one listing unit → 6) |
| is_primary | boolean | NOT NULL DEFAULT true | v1: exactly one primary mapping per listing |
| created_at / updated_at | timestamptz | | |

Unique: `(listing_id, sku_id)`.

## 4. `inventory` — current stock position per master SKU per store

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | bigint identity | PK | |
| merchant_id | bigint | NOT NULL, index | |
| store_id | bigint | NOT NULL | merchant store / dark store |
| sku_id | bigint | NOT NULL, FK → sku_master.id | |
| on_hand | numeric(14,3) | NOT NULL DEFAULT 0 | physical stock in base units |
| reserved | numeric(14,3) | NOT NULL DEFAULT 0 | held by unpaid orders |
| version | bigint | NOT NULL DEFAULT 0 | optimistic-lock counter, +1 on every write |
| updated_at | timestamptz | | |

Unique: `(merchant_id, store_id, sku_id)`.
Available = `on_hand - reserved`. Writes must use
`WHERE version = :expected` and fail on 0 rows updated (conflict → reload → retry).

## 5. `inventory_ledger` — append-only movement journal (source of truth)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | bigint identity | PK | |
| merchant_id | bigint | NOT NULL, index | |
| store_id | bigint | NOT NULL | |
| sku_id | bigint | NOT NULL, FK → sku_master.id | |
| event_type | text | NOT NULL | `reserve` \| `release` \| `deduct` \| `restore` \| `adjust` \| `stock_in` |
| qty_delta | numeric(14,3) | NOT NULL | signed, in base units; negative = stock leaves available pool |
| order_ref | text | NULL | platform order id when order-driven |
| idempotency_key | text | NOT NULL | unique; built as `platform:order_id:event_type` or a caller-supplied UUID |
| created_at | timestamptz | NOT NULL DEFAULT now() | no `updated_at` — append-only |

Unique: `(merchant_id, idempotency_key)`. A duplicate insert is a no-op
(conflict target), which is what makes webhook replays safe.

`inventory` is a *projection* of this ledger and can always be rebuilt by replay.

## 6. `platform_order` — one order as received from one platform

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | bigint identity | PK | |
| merchant_id | bigint | NOT NULL, index | |
| platform | text | NOT NULL | `meituan` \| `eleme` \| `jd` |
| platform_order_id | text | NOT NULL | |
| store_id | bigint | NOT NULL | |
| status | text | NOT NULL | state machine: `received` → `reserved` → `paid` → `fulfilled`; side exits: `cancelled`, `quarantined` (terminal) |
| total_cents | int | NOT NULL DEFAULT 0 | |
| payload | jsonb | NOT NULL | raw webhook payload, verbatim |
| received_at | timestamptz | NOT NULL DEFAULT now() | |
| created_at / updated_at | timestamptz | | |

Unique: `(merchant_id, platform, platform_order_id)` — duplicate webhooks
collapse onto one row.

Order line items live in `payload` for v1; a normalized `platform_order_item`
table is step-two work and is **not** part of this frozen schema.

---

## Reservation flow (normative)

1. Webhook arrives → upsert `platform_order` (status `received`) → parse items.
2. For each item: resolve listing → mapping → master SKU; convert qty by
   `conversion_factor`.
3. In one transaction per order: insert `reserve` ledger rows (idempotency key
   `platform:order_id:reserve`), then update `inventory.reserved` with the
   optimistic-lock check. Insufficient available → order `quarantined`,
   alert merchant, no partial reservation survives (transaction rolls back).
4. Payment confirmed → `deduct` rows: `on_hand` and `reserved` both decrease.
5. Cancel / payment timeout (15 min default) → `release` rows: `reserved`
   decreases. A cancel arriving after `fulfilled` is quarantined for a human —
   the goods are physically gone.
6. Reconciliation job (every 5 min): recompute `inventory` from the ledger,
   compare against platform-reported stock, push corrections through the
   per-platform rate-limited sync queue (dirty-set coalescing: only the final
   state per SKU inside the window is pushed).
