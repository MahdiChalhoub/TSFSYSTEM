# Deploy Notes — 2026-05-05

This release bundles the perf + audit + attribute-scoping work done over the
last few sessions. Schema-touching steps are listed first because they're the
ones that can fail destructively; everything else is safe to deploy in any
order.

## 1. Prerequisites on the deploy host

Run **before** `deploy.sh`:

```bash
# Pull the new branch — picks up package.json with @tanstack/react-virtual
git pull

# Reinstall JS deps (frontend container picks this up on rebuild, but
# anything not using the dev compose needs an explicit install)
npm install

# Rebuild the frontend image so the new dep gets baked in
docker compose -f docker-compose.prod.yml --env-file .env.prod build frontend
```

If your deploy pipeline already runs `npm install` between pulls, no extra
step. Otherwise the new `@tanstack/react-virtual` import in
`DajingoListView.tsx` will throw at runtime.

## 2. Database migrations

This session's dev DB had pending migrations whose SQL conflicted with
schema patches we'd applied surgically (template_id column, ExternalDriver
table, etc). On dev we resolved them via direct `INSERT INTO django_migrations`
to mark them as applied.

**Production likely has a different state.** Two paths:

### A. Production has all the schema already

If prod was kept current via prior deploys, `manage.py migrate` will be a
no-op or fail with the same "column already exists" / "relation does not
exist" pattern we hit on dev. In that case, mirror what we did:

```bash
docker exec tsf_prod_backend python manage.py showmigrations 2>&1 | grep '\[ \]'
# For each pending migration whose schema is already in target state:
docker exec tsf_prod_postgres psql -U postgres -d tsfdb -c \
    "INSERT INTO django_migrations (app, name, applied) VALUES ('<app>', '<name>', NOW());"
# For migrations whose schema is genuinely missing, leave the row alone and
# let `manage.py migrate <app>` apply them properly.
```

The pending list on dev was:
- `inventory.0008_rename_inv_ai_cr_org_cat_hash_idx_inventory_a_tenant__fc55bd_idx_and_more`
- `finance.0004_rename_bank_statem_tenant__6a76fc_idx_bank_statem_organiz_5b3b8b_idx_and_more`

Both are mostly index rename + db_column re-spec where the DB is already in
target state. Inspect each on prod with `\d <table>` before deciding.

### B. Production schema is genuinely behind

If prod doesn't have `product_packaging.template_id` or `pos_external_driver`
yet, `manage.py migrate` will create them properly. Just run the deploy
script — it already invokes `migrate --noinput`.

### Heads-up: deploy.sh swallows migration failures

[`deploy.sh:111`](./deploy.sh#L111) pipes `migrate` output through `tail -5`,
which clobbers `set -e`'s exit-on-error behaviour. **A failed migration on
prod won't fail the deploy.** Worth fixing as a one-line follow-up:

```bash
# Replace
docker exec tsf_prod_backend python manage.py migrate --noinput 2>&1 | tail -5
# With
docker exec tsf_prod_backend python manage.py migrate --noinput
```

## 3. New environment variables

| Var | Default | What it does |
|---|---|---|
| `PROCSTAT_WORKERS` | `3` | Procurement-status thread pool size. Each worker holds 1 DB connection during a phase query. Raise for high concurrency tenants; lower (or set to `1`) if Postgres `max_connections` pressure is observed. |
| `CACHE_REDIS_URL` | `redis://redis:6379/2` | Already configured. Procurement status now caches here for 30 s with per-org version-bump invalidation. |

`PROCSTAT_WORKERS=3` is sized for the steady state (one worker per phase of
the procurement batch). If your gunicorn worker count × `PROCSTAT_WORKERS`
approaches `max_connections`, dial it down — the cache hit path doesn't use
the pool, so most requests don't pay the connection cost anyway.

## 4. What ships in this release

### Backend perf + correctness
- AuditLogMixin: read FK columns via `field.attname` so list iteration of any
  AuditLogMixin-bearing model no longer triggers N+1 related-object fetches.
  **App-wide speedup**: every list view of every model with the mixin.
- ProductSerializer: `prefetch_related('packaging_levels__unit')` to
  collapse per-row packaging cascade. 81 → 16 queries on a 100-row page.
- `ProductLiteSerializer`: new lite payload for pickers; exposes
  `cost_price*`, `selling_price*`, `status`, `tva_rate`, `pipeline_status`.
- Procurement status batch: 3 phase queries now run in parallel on a
  module-level `ThreadPoolExecutor` (worker count via `PROCSTAT_WORKERS`).
- Procurement status batch: cached in Redis with per-org version-bump
  invalidation. Signals on `ProcurementRequest`, `PurchaseOrder`,
  `PurchaseOrderLine`, `OperationalRequestLine` save/delete bump the
  org version → next read misses → 30 s TTL bound on staleness.
- `_resolve_warehouse` cached per-request to remove a 4× per-row hidden N+1
  when a warehouse filter is set.

### Backend feature
- `BrandViewSet.audit` — new endpoint, mirrors the Category pattern.
- `BrandViewSet.attribute_value_scope` (GET + POST) — per-child scoping
  of leaf attribute values to a brand via the existing `scope_brands` M2M.
- `CategoryViewSet.audit` rewritten to read from kernel `erp_auditlog`
  instead of the legacy `auditlog` table (which missed every recent
  change written by `AuditLogMixin`).
- `CategoryViewSet.attribute_value_scope` — same surface for categories
  via `scope_categories`.
- Helper `kernel.audit.audit_logger.get_resource_audit_history()` for any
  future viewset that wants a side-panel Audit tab.

### Frontend perf
- `/inventory/products`: SSR fetches reduced from 9 → 2 (lookups now load
  client-side). Heavy panels (`FiltersPanel`, `CustomizePanel`,
  `ProductDetailCards`, `ProductCardGrid`, `ExpiryAlertDialog`) are
  `next/dynamic` with `ssr: false`.
- `DajingoListView`: row windowing via `@tanstack/react-virtual` once
  `data.length > 30`. Per-row `content-visibility: auto` skips paint for
  off-screen rows below the threshold.
- Manager-side: `useDeferredValue` on search/filters; row-prop callbacks
  memoized with `useCallback`; cell-level lazy compute (margin / status
  badges / qty tier only fire when the matching cell key is rendered).
- pageSize bumped 50 → 200 (now safe with virtualization).
- AuditLogMixin attname fix benefits *every* list view, not just products.

### Frontend feature
- Brand + Category side-panel `AttributesTab` now expands each linked
  root attribute into a child-checkbox picker. Default view shows only
  the values currently scoped; "+ Add value (N available)" reveals the
  rest. ⚠ icon flags values already restricted to other brands/categories.
- Catalogue picker (`new purchase order`): supplier + pipeline filters,
  customizable column layout via shared `CustomizePanel`, virtualized rows.
- Cross-feature imports lifted to `@/components/products/FiltersPanel`
  and `@/lib/products/filter-shape` so consumers don't reach into
  `inventory/products/_lib/`.

## 5. Known issues / tech debt

- **`@ts-nocheck` on `DajingoListView.tsx`** — inherited; new
  `VirtualRowList` code in that file is therefore type-unchecked. Not a
  ship blocker (runtime works) but worth removing when someone has a
  half-day to triage the underlying generics.
- **Two AuditLog tables coexist** (`erp_auditlog` modern, `auditlog`
  legacy). Modern path wins for new entries; legacy table still has
  ~70 historical rows readable only by `views_system.py` / `erp/views.py`.
  No functional impact — just clean-up debt.
- **`scope_brands` / `scope_categories` semantics**: M2M is an
  exclusivity gate. Picking a value scopes it to this brand only —
  other brands lose universal access. UI shows the ⚠ icon when a value
  is already scoped to other brands. If your business logic expects
  "scoping = additive without removing", we'd need a model change to
  a positive per-brand allowlist with default-all.

## 6. Smoke tests after deploy

1. `/inventory/products` — list loads fast, scrolls smoothly, filters
   tighten in real time, supplier + pipeline dropdowns populate.
2. `/inventory/brands` → click a brand → Attributes tab → expand a
   linked group → toggle a child checkbox → close + reopen → state
   persisted.
3. `/inventory/brands` → Audit tab → recent edits appear.
4. `/inventory/categories` → same Attributes + Audit checks.
5. `/purchases/purchase-orders/new` → Catalogue modal opens cleanly,
   supplier + pipeline filters work, scrolling 200 rows is smooth.
6. Backend logs — no `ProgrammingError: column "..." does not exist`
   patterns. (We fixed all the known ones; a new instance suggests a
   migration was missed somewhere.)
