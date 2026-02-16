
CREATE TABLE adjustment_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  created_by_user_id INTEGER,
  created_by_user_name TEXT,
  status TEXT DEFAULT 'PENDING',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE inventory_lines ADD COLUMN adjustment_order_id INTEGER;
