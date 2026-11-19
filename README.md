# Instant Retail Ops

Merchant operations system for instant-retail (30-minute delivery) sellers in
China who sell on **Meituan Instashopping, Ele.me and JD Daojia at the same
time** — one canonical catalog and one stock position, projected onto every
platform without overselling.

## The problem

Each platform keeps its own product ids, its own stock counter and its own
order webhooks. A seller with 3 platform storefronts and one physical shelf
gets race conditions for free: the same last unit can be sold three times in
the same dinner rush. This system is the single source of truth in the middle:

- **Canonical catalog** — `sku_master` is the merchant's product; platform
  listings map onto it with explicit unit-conversion factors.
- **Reservation-based inventory** — stock is reserved on order, deducted on
  payment, released on cancel/timeout. No payment-time locking, no oversell.
- **Append-only ledger** — every stock movement is an idempotent ledger entry;
  the live inventory table is a rebuildable projection.
- **Rate-limit-safe sync** — outbound stock pushes are coalesced per SKU and
  sent through per-platform token buckets with circuit breakers, webhook-first.

## Data model

Frozen in [docs/SCHEMA.md](docs/SCHEMA.md): `sku_master`, `platform_listing`,
`sku_mapping`, `inventory`, `inventory_ledger`, `platform_order`.

## Layout

```
docs/SCHEMA.md          frozen data model (v1) — read this first
migrations/             SQL migrations, up/down verified in CI
src/catalog/            GOLDEN reference module — the house pattern
src/mapping/            (step one, session 2)
src/inventory/          (step one, session 3)
src/orders/             (step two)
test/                   unit + integration tests mirroring src/
```

## How this gets built (agent harness rules)

This repo is built with AI coding agents under a strict harness:

1. **Frozen spec first.** `docs/SCHEMA.md` is committed before any code and
   only changes through a human-approved schema PR.
2. **Golden module.** `src/catalog/` is a hand-written reference module. Every
   other module must match its folder layout, repository style, DTO
   validation and error handling.
3. **One module per session, path-scoped.** Each agent session is told exactly
   which directories it may write (`src/<module>/**`, `test/<module>/**`) and
   nothing else.
4. **Tests first, CI green.** Migrations must run up *and* down against a
   throwaway Postgres in CI. No green CI, no merge.
5. **Small PRs, human review.** PRs are capped at a size one person can review
   line by line. If an agent fails the same issue twice, the scope is shrunk
   and re-prompted — it never gets to flail across the codebase.

## Stack

Node.js · NestJS · PostgreSQL 15 · Redis (rate-limit buckets, dirty-set
coalescing) · Kafka (order event fan-out, step two)

## Status

Step one in progress: schema frozen, golden module landed. Next sessions:
mapping CRUD, inventory reservation engine, reconciliation loop.
