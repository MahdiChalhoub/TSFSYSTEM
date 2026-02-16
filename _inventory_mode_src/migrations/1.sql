
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_product_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  image_url TEXT,
  unit TEXT NOT NULL,
  unit_cost REAL,
  selling_price REAL,
  margin REAL,
  supplier TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_external_id ON products(external_product_id);
CREATE INDEX idx_products_category ON products(category);
