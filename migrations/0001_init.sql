-- 0001_init.sql — instant-retail-ops frozen schema v1 (see docs/SCHEMA.md)
-- up

CREATE TABLE sku_master (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  merchant_id bigint NOT NULL,
  name        text NOT NULL,
  barcode     text,
  category    text,
  base_unit   text NOT NULL,
  cost_cents  int NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sku_master_merchant_barcode
  ON sku_master (merchant_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX sku_master_merchant ON sku_master (merchant_id);

CREATE TABLE platform_listing (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  merchant_id      bigint NOT NULL,
  platform         text NOT NULL,
  platform_item_id text NOT NULL,
  platform_sku_id  text,
  title            text NOT NULL,
  price_cents      int NOT NULL,
  status           text NOT NULL DEFAULT 'on_sale',
  last_synced_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, platform, platform_item_id, platform_sku_id)
);
CREATE INDEX platform_listing_merchant ON platform_listing (merchant_id);

CREATE TABLE sku_mapping (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  merchant_id       bigint NOT NULL,
  listing_id        bigint NOT NULL REFERENCES platform_listing (id),
  sku_id            bigint NOT NULL REFERENCES sku_master (id),
  conversion_factor numeric(12,4) NOT NULL DEFAULT 1,
  is_primary        boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, sku_id)
);
CREATE INDEX sku_mapping_merchant ON sku_mapping (merchant_id);

CREATE TABLE inventory (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  merchant_id bigint NOT NULL,
  store_id    bigint NOT NULL,
  sku_id      bigint NOT NULL REFERENCES sku_master (id),
  on_hand     numeric(14,3) NOT NULL DEFAULT 0,
  reserved    numeric(14,3) NOT NULL DEFAULT 0,
  version     bigint NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, store_id, sku_id)
);
CREATE INDEX inventory_merchant ON inventory (merchant_id);

CREATE TABLE inventory_ledger (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  merchant_id     bigint NOT NULL,
  store_id        bigint NOT NULL,
  sku_id          bigint NOT NULL REFERENCES sku_master (id),
  event_type      text NOT NULL,
  qty_delta       numeric(14,3) NOT NULL,
  order_ref       text,
  idempotency_key text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, idempotency_key)
);
CREATE INDEX inventory_ledger_merchant_sku ON inventory_ledger (merchant_id, sku_id);

CREATE TABLE platform_order (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  merchant_id       bigint NOT NULL,
  platform          text NOT NULL,
  platform_order_id text NOT NULL,
  store_id          bigint NOT NULL,
  status            text NOT NULL DEFAULT 'received',
  total_cents       int NOT NULL DEFAULT 0,
  payload           jsonb NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, platform, platform_order_id)
);
CREATE INDEX platform_order_merchant ON platform_order (merchant_id);
