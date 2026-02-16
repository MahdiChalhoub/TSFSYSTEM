
-- Add missing indexes for foreign key relationships
CREATE INDEX idx_inventory_lines_micro_section_id ON inventory_lines(micro_section_id);
CREATE INDEX idx_inventory_lines_adjustment_order_id ON inventory_lines(adjustment_order_id);
CREATE INDEX idx_adjustment_orders_session_id ON adjustment_orders(session_id);

-- Add indexes for commonly filtered columns
CREATE INDEX idx_inventory_lines_status ON inventory_lines(physical_qty_person1, physical_qty_person2, is_verified);
CREATE INDEX idx_inventory_lines_adjustment ON inventory_lines(needs_adjustment, adjustment_status);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_unit ON products(unit);
CREATE INDEX idx_micro_sections_status ON micro_sections(status);
