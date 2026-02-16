
ALTER TABLE micro_sections ADD COLUMN filter_supplier_id INTEGER;
ALTER TABLE micro_sections ADD COLUMN filter_category TEXT;
ALTER TABLE micro_sections ADD COLUMN filter_brand TEXT;
ALTER TABLE micro_sections ADD COLUMN filter_unit TEXT;
ALTER TABLE micro_sections ADD COLUMN filter_qty_type TEXT;
ALTER TABLE micro_sections ADD COLUMN filter_qty_min INTEGER;
ALTER TABLE micro_sections ADD COLUMN filter_qty_max INTEGER;
ALTER TABLE micro_sections ADD COLUMN filter_uncounted_only BOOLEAN DEFAULT 0;
