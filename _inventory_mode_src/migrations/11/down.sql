ALTER TABLE inventory_lines DROP COLUMN micro_section_id;
DROP INDEX idx_micro_section_assignments_section;
DROP INDEX idx_micro_sections_session;
DROP TABLE micro_section_assignments;
DROP TABLE micro_sections;