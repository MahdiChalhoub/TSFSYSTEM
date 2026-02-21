-- SaaS Business Integration: v1.12.9-b001
-- #14: linked_inventory_category on PlanCategory
-- #15: business_types M2M on SubscriptionPlan

-- Add linked_inventory_category column to PlanCategory
ALTER TABLE plancategory ADD COLUMN IF NOT EXISTS linked_inventory_category INTEGER;

-- Create M2M join table for SubscriptionPlan <-> BusinessType
CREATE TABLE IF NOT EXISTS subscriptionplan_business_types (
    id SERIAL PRIMARY KEY,
    subscriptionplan_id INTEGER NOT NULL REFERENCES subscriptionplan(id) ON DELETE CASCADE,
    businesstype_id INTEGER NOT NULL REFERENCES businesstype(id) ON DELETE CASCADE,
    UNIQUE(subscriptionplan_id, businesstype_id)
);
