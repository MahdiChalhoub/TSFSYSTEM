# Combo & Bundle Products — Documentation

## Goal
Allow businesses to group multiple individual products into a single combo/bundle product. When a combo is sold at the POS, stock is deducted for each child component independently.

## Data Sources

### READ
- `GET /api/products/` — lists all products; combos have `product_type = 'COMBO'`
- `GET /api/products/{id}/combo-components/` — returns all child components of a combo

### WRITE
- `POST /api/products/{id}/add-component/` — add a product as a component of a combo
- `DELETE /api/products/{id}/remove-component/{componentId}/` — remove a component

## Database Tables

### product (modified)
| Column | Type | Description |
|--------|------|-------------|
| product_type | VARCHAR(20) | STANDARD, COMBO, or SERVICE |

### combo_component (new)
| Column | Type | Description |
|--------|------|-------------|
| combo_product_id | FK → Product | Parent combo product |
| component_product_id | FK → Product | Child product in the bundle |
| quantity | DECIMAL | How many units of the child are in one combo |
| price_override | DECIMAL (nullable) | Optional override price for this component |
| sort_order | INT | Display order of components |

Unique constraint: (combo_product, component_product, organization)

## User Workflow
1. Mark a product as type `COMBO` via product master
2. Navigate to **Inventory → Combo & Bundles**
3. Select the combo product from the left panel
4. Click "Add Component" → search for products → set quantity → click to add
5. View component value vs. combo price (savings shown in green)
6. Remove components with the trash icon

## Files
- **Backend Model**: `erp_backend/apps/inventory/models.py` → `ComboComponent`
- **Backend Views**: `erp_backend/apps/inventory/views.py` → `combo_components`, `add_combo_component`, `remove_combo_component`
- **Serializer**: `erp_backend/apps/inventory/serializers.py` → `ComboComponentSerializer`
- **Server Actions**: `src/app/actions/combo.ts`
- **Frontend Page**: `src/app/(privileged)/inventory/combo/page.tsx`
- **Manager Component**: `src/app/(privileged)/inventory/combo/manager.tsx`
- **Sidebar**: Added under Inventory → Products → "Combo & Bundles"
