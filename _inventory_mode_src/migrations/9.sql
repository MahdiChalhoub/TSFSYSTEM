
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  picture_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_external_id ON users(external_user_id);
CREATE INDEX idx_users_email ON users(email);
