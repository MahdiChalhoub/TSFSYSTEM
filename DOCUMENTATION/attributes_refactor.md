# Attributes (Parfum) Module Refactoring

## Overview
The Attributes module (internally `Parfum` in data model) deals with product variants like scents or flavors. It has been refactored to use the Django backend, removing direct Prisma dependency.

## Pages
### Attributes Management
**Path:** `/admin/inventory/attributes`
**File:** `src/app/admin/inventory/attributes/page.tsx`

**Goal:** Manage product attributes/parfums and their categorization.

**Data Source (READ):**
- Attributes: `GET /api/parfums/` (Fetched via `getAttributes` action)
- Categories: `GET /api/categories/` (Fetched via inner `getCategories` function)

**Data destination (SAVE):**
- Create/Update/Delete Attribute: `POST/PATCH/DELETE /api/parfums/`

**Workflow:**
1. User views list of attributes (optionally filtered by category).
2. `AttributeManager` displays attributes.
3. User clicks "Add Attribute" -> `AttributeFormModal` opens.
4. User enters Name, Short Code, and selects Categories.
5. On Save, `createAttribute` server action calls `POST /api/parfums/`.
6. On Edit, `updateAttribute` server action calls `PATCH /api/parfums/{id}/`.

## API Endpoints
### Parfum ViewSet
**Path:** `/api/parfums/`

**Methods:**
- `GET /`: List all attributes. Supports standard pagination if enabled.
- `POST /`: Create new attribute. Expects `name` and optional `categories` (list of IDs).
- `GET /{id}/`: Retrieve single attribute.
- `PATCH /{id}/`: Update attribute.
- `DELETE /{id}/`: Delete attribute.

**Custom Actions:**
- `GET /by_category/?categoryId={id}`: Returns attributes linked to a specific category or its parents. Walks up the category tree to find inherited attributes.
- `GET /{id}/hierarchy/`: Returns a hierarchical view of Brands -> Products linked to this attribute (Parfum). Used for the "Expand" view in the UI.

## Data Model
**Model:** `Parfum`
**Table:** `Parfum`

**Columns:**
- `id` (UUID): Primary Key
- `name` (String): Attribute name
- `short_name` (String): Short code (e.g., "VAN")
- `categories` (M2M): Relation to `Category` model.

**Relationships:**
- `products`: Reverse relation from `Product` (One-to-Many).
- `categories`: Many-to-Many with `Category`.

## Integration
- **Frontend Action:** `src/app/actions/attributes.ts` handles all API calls and data mapping (snake_case -> camelCase).
- **Serializer:** `ParfumSerializer` handles mapping `categories` to objects on read and accepting IDs on write.
