CREATE TABLE micro_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE micro_section_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  micro_section_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_micro_sections_session ON micro_sections(session_id);
CREATE INDEX idx_micro_section_assignments_section ON micro_section_assignments(micro_section_id);

ALTER TABLE inventory_lines ADD COLUMN micro_section_id INTEGER;