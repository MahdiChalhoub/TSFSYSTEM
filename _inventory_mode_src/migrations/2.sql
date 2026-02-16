
CREATE TABLE inventory_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location TEXT NOT NULL,
  section TEXT NOT NULL,
  person1_name TEXT NOT NULL,
  person2_name TEXT NOT NULL,
  session_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_status ON inventory_sessions(status);
CREATE INDEX idx_sessions_date ON inventory_sessions(session_date);
