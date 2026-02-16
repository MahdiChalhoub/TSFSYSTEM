# Universal Dynamic List Engine (UDLE)

## Goal
To provide users with a "Zero Lock-in" experience where they can customize columns, filters, and views for any data list in the application.

## 🛠️ Backend Implementation
The kernel provides a mixin (`UDLEViewSetMixin`) that introspects the model to expose its schema.

- **File**: `erp/mixins.py`
- **Action**: `/schema-meta/`
- **Data Provided**: Field names, labels, types (number, select, boolean, date), and choices.

## 🎨 Frontend Implementation
The UI uses a generic `UniversalDataTable` component.

- **File**: `src/components/ui/universal-data-table.tsx`
- **Features**:
  - **Dynamic Columns**: Toggle visibility via the "Columns" dropdown.
  - **Universal Filter Bar**: Auto-generated from the metadata.
  - **Sorting**: Multi-column sorting support.

## 🔄 Workflow
1. **Metadata Fetch**: Frontend calls `schema-meta` to understand the model.
2. **Data Fetch**: Frontend calls the standard `list` endpoint with query params generated from the UI (search, filters, ordering).
3. **Rendering**: Component renders specific cell formats (Badges for booleans, localized Currency for numbers).

## 📊 Affected Tables / Models
- **InventoryMovement** (Migrated)
- **Product** (Ready)
- **FinancialAccount** (Ready)
- **JournalEntry** (Ready)
