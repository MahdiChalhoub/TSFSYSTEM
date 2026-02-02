# Django ERP Core Module Documentation

## Goal of the module
To serve as the reliable, scalable "Brain" of the SaaS platform, handling core business logic, multi-tenancy isolation, complex accounting (General Ledger), and inventory valuation.

## Architecture
- **Tech Stack**: Django 5.x, Django REST Framework (DRF), PostgreSQL.
- **Isolation Strategy**: Multi-tenancy via `organizationId` (UUID) present in all operational models.
- **Frontend Integration**: Next.js (Frontend) communicates with Django via an API Gateway/Proxy layer.

## Core Models
### Organization
- **Purpose**: Represents a SaaS tenant (Company).
- **Columns**: `id` (UUID), `name`, `slug`, `is_active`, `created_at`, `updated_at`.
- **Relationships**: Parent to all `Site`, `User`, `Role`, `Product`, etc.

### Site
- **Purpose**: Represents a physical or virtual location (Warehouse, Store, Branch).
- **Columns**: `organization`, `name`, `code`, `address`, `city`, `phone`, `vat_number`, `is_active`.
- **Relationships**: Belong to one `Organization`.

### User (Custom User)
- **Purpose**: System login and identity.
- **Columns**: `organization`, `role`, `home_site`, `is_active_account` + standard Django User fields.
- **Relationships**: Belongs to one `Organization` and optionally one `Role`/`Site`.

## Workflow: Tenant Provisioning
1. **Creation**: A new `Organization` is created with a unique `slug`.
2. **Standard Setup**: Default `Permission` set is ensured.
3. **Owner Creation**: A primary `User` is created and linked to the `Organization`.
4. **Site Activation**: A default "Main Branch" `Site` is provisioned for the tenant.

## Integration Plan
- **Data Reading**: Next.js will fetch data from Django for all ERP-related features (Finance, Inventory).
- **Data Writing**: Form submissions in Next.js will be proxied to Django API endpoints.
