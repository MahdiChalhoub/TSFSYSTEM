# ERP & Backend Implementation Plan

## Objective
Build a robust Backend and ERP (Enterprise Resource Planning) system to manage store operations (Inventory, Products, Sales). The "TSF Supermarket" online store will act as a client, fetching real-time product availability and pricing from this system.

## 1. Technological Stack Strategy
To ensure compatibility with Hostinger and Node.js:
-   **Runtime**: Node.js (v18+).
-   **Framework**: **NestJS** (Recommended for ERP due to strict architecture) OR **Express.js** (Simpler, closer to what we have). *Decision needed*.
-   **Database**: **MySQL** (Best for Hostinger compatibility) or PostgreSQL.
-   **ORM**: **Prisma** or **TypeORM** (for type-safe database interactions).

## 2. Architecture: "The Side System"
We will treat the ERP as the "Source of Truth".
-   **ERP Backend**: Handles all logic, database connections, and business rules.
-   **ERP Frontend (Admin Panel)**: Value-added interface for staff to add products, do stocktakes, etc.
-   **Store Frontend (Next.js)**: Consumes the ERP API (Read-only for products/stock, Write for Orders).

## 3. Database Schema (Phase 1: Inventory & Products)

### Table: `products`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID/Int | Primary Key |
| `sku` | String | Unique Stock Keeping Unit |
| `barcode` | String | Scannable UPC/EAN |
| `name` | String | Product Name |
| `description` | Text | HTML/Markdown description for Store |
| `category_id` | Int | Foreign Key |
| `base_price` | Decimal | Selling Price |
| `cost_price` | Decimal | Purchase Price (Hidden from Store) |
| `is_active` | Boolean | Soft delete flag |
| `created_at` | Timestamp | |

### Table: `inventory`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | Int | Primary Key |
| `product_id` | UUID/Int | FK to Products |
| `quantity_on_hand`| Int | Physical count |
| `quantity_reserved`| Int | Reserved for online orders not yet picked |
| `location_code` | String | Aisle/Shelf ID (e.g., "A1-S2") |
| `last_updated` | Timestamp | |

### Table: `stock_movements` (Audit Trail)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | Int | Primary Key |
| `product_id` | FK | |
| `type` | Enum | 'PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN' |
| `quantity_change` | Int | + or - value |
| `reason` | String | Optional note |
| `created_by` | UserID | Who made the change |

## 4. Development & Testing Workflow
1.  **Setup Backend**: Initialize the API project.
2.  **Database Migration**: Create the tables.
3.  **Seed Data**: clear test data.
4.  **Unit Tests**: Test logic (e.g., "Cannot sell more than stock").
5.  **Integration**: Connect Next.js Store to fetch this data.

## Questions for User
1.  **Structure**: Should we build this ERP inside the current `tsfci` folder (e.g., `/server/erp`) or as a completely new folder/repo? (Keeping it together makes sharing types easier).
2.  **Database**: Do you have a MySQL database created on Hostinger already, or shall we set up a local SQLite/MySQL for development first?
