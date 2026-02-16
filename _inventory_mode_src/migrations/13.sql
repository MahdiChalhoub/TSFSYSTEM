
ALTER TABLE inventory_lines ADD COLUMN adjustment_status TEXT DEFAULT 'PENDING';
ALTER TABLE inventory_lines ADD COLUMN unlocked_for_recount_person1 BOOLEAN DEFAULT 0;
ALTER TABLE inventory_lines ADD COLUMN unlocked_for_recount_person2 BOOLEAN DEFAULT 0;
