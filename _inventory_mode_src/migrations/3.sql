
CREATE TABLE inventory_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  system_qty INTEGER NOT NULL,
  physical_qty_person1 INTEGER,
  physical_qty_person2 INTEGER,
  difference_person1 INTEGER,
  difference_person2 INTEGER,
  is_same_difference BOOLEAN DEFAULT 0,
  needs_adjustment BOOLEAN DEFAULT 0,
  is_verified BOOLEAN DEFAULT 0,
  is_adjusted BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_lines_session ON inventory_lines(session_id);
CREATE INDEX idx_inventory_lines_product ON inventory_lines(product_id);
