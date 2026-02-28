-- =============================================================================
-- DATA MIGRATION: Copy Site records into Warehouse as BRANCH type
-- =============================================================================
-- This script runs BEFORE the problematic FK migration.
-- It inserts all Site records into Warehouse (with location_type='BRANCH')
-- using new sequential IDs (starting at 100 to avoid clashes), then updates 
-- all tables that reference site_id to use the new warehouse IDs.
-- =============================================================================

BEGIN;

-- Step 1: Insert all Site records into Warehouse as BRANCH type entries.
-- We use id = site.id + 1000 to avoid clashes with existing warehouse IDs.
INSERT INTO warehouse (id, name, code, address, city, phone, vat_number, is_active, 
                       organization_id, location_type, can_sell, created_at, updated_at)
SELECT 
    s.id + 1000,   -- Offset to avoid clashes
    s.name, 
    s.code, 
    s.address, 
    s.city, 
    s.phone, 
    s.vat_number, 
    s.is_active, 
    s.organization_id, 
    'BRANCH',
    true,
    s.created_at,
    s.updated_at
FROM site s
WHERE NOT EXISTS (
    -- Don't insert if already exists (idempotent)
    SELECT 1 FROM warehouse w WHERE w.id = s.id + 1000
);

-- Step 2: Update all tables that have site_id FKs now pointing to warehouse.
-- Map old site IDs → new warehouse IDs (old_id + 1000)

-- financialaccount
UPDATE financialaccount SET site_id = site_id + 1000 
WHERE site_id IS NOT NULL AND site_id < 1000;

-- invoice
UPDATE invoice SET site_id = site_id + 1000 
WHERE site_id IS NOT NULL AND site_id < 1000;

-- journalentry
UPDATE journalentry SET site_id = site_id + 1000 
WHERE site_id IS NOT NULL AND site_id < 1000;

-- transaction (erp.Transaction)
UPDATE transaction SET site_id = site_id + 1000 
WHERE site_id IS NOT NULL AND site_id < 1000;

-- pos_order
UPDATE pos_order SET site_id = site_id + 1000 
WHERE site_id IS NOT NULL AND site_id < 1000;

-- purchase_order
UPDATE purchase_order SET site_id = site_id + 1000 
WHERE site_id IS NOT NULL AND site_id < 1000;

-- pos_quotation
UPDATE pos_quotation SET site_id = site_id + 1000 
WHERE site_id IS NOT NULL AND site_id < 1000;

-- contact (home_site_id)
UPDATE contact SET home_site_id = home_site_id + 1000 
WHERE home_site_id IS NOT NULL AND home_site_id < 1000;

-- user (home_site_id)
UPDATE "user" SET home_site_id = home_site_id + 1000 
WHERE home_site_id IS NOT NULL AND home_site_id < 1000;

-- employee (home_site_id)
UPDATE employee SET home_site_id = home_site_id + 1000 
WHERE home_site_id IS NOT NULL AND home_site_id < 1000;

-- shift (site_id)
UPDATE shift SET site_id = site_id + 1000 
WHERE site_id IS NOT NULL AND site_id < 1000;

-- Step 3: Link existing warehouses to their parent BRANCH.
-- The old migration service created warehouses per-site. Match them by organization.
-- For the demo tenant (47c1451a...), sites 2-6 map to warehouses 1-5.
-- For the main tenant (58ceebcb...), sites 12-16 map to warehouses 11-15.

-- Set parent_id for existing warehouses where we can match by org
UPDATE warehouse AS w
SET parent_id = (
    SELECT MIN(b.id) FROM warehouse b 
    WHERE b.organization_id = w.organization_id 
    AND b.location_type = 'BRANCH'
    AND b.id != w.id
)
WHERE w.location_type = 'WAREHOUSE' AND w.parent_id IS NULL;

-- Step 4: Update sequence to avoid ID clashes on future inserts
SELECT setval('warehouse_id_seq', (SELECT MAX(id) FROM warehouse));

COMMIT;
