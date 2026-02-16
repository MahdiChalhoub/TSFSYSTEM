
-- Drop sync state
DELETE FROM sync_state WHERE sync_type = 'products';
DROP TABLE sync_state;

-- Drop product suppliers
DROP INDEX idx_product_suppliers_supplier;
DROP INDEX idx_product_suppliers_product;
DROP TABLE product_suppliers;

-- Drop suppliers
DROP TABLE suppliers;

-- Remove new columns from products
ALTER TABLE products DROP COLUMN total_qty;
ALTER TABLE products DROP COLUMN sku;
