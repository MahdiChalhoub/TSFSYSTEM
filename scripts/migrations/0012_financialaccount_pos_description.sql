-- Finance Accounts Schema Update: v1.12.5-b001
-- Adds: description (TEXT), is_pos_enabled (BOOLEAN) to financialaccount table

ALTER TABLE financialaccount ADD COLUMN IF NOT EXISTS description TEXT NULL;
ALTER TABLE financialaccount ADD COLUMN IF NOT EXISTS is_pos_enabled BOOLEAN DEFAULT FALSE;
