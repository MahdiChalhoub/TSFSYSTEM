
CREATE TABLE locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_location_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  landmark TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  zip_code TEXT,
  mobile TEXT,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sync_state (sync_type, last_id, created_at, updated_at) 
VALUES ('locations', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
