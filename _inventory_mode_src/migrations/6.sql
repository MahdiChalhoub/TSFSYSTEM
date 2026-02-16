
-- Add sku and total_qty to products table
ALTER TABLE products ADD COLUMN sku TEXT;
ALTER TABLE products ADD COLUMN total_qty INTEGER DEFAULT 0;

-- Create suppliers table
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_supplier_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create product_suppliers junction table
CREATE TABLE product_suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  supplier_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_suppliers_product ON product_suppliers(product_id);
CREATE INDEX idx_product_suppliers_supplier ON product_suppliers(supplier_id);

-- Create sync_state table to track sync progress
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_type TEXT NOT NULL UNIQUE,
  last_id INTEGER DEFAULT 0,
  last_sync_at DATETIME,
  is_syncing BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize product sync state
INSERT INTO sync_state (sync_type, last_id) VALUES ('products', 0);
