
ALTER TABLE inventory_lines ADD COLUMN system_qty_person1 INTEGER;
ALTER TABLE inventory_lines ADD COLUMN system_qty_person2 INTEGER;
ALTER TABLE inventory_lines ADD COLUMN product_category TEXT;
ALTER TABLE inventory_lines ADD COLUMN product_brand TEXT;
ALTER TABLE inventory_lines ADD COLUMN product_unit TEXT;
ALTER TABLE inventory_lines ADD COLUMN product_margin REAL;
ALTER TABLE inventory_lines ADD COLUMN counted_at_person1 DATETIME;
ALTER TABLE inventory_lines ADD COLUMN counted_at_person2 DATETIME;
