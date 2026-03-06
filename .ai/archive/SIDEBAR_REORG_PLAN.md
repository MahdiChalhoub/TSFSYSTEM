# Implementation Plan: Sidebar Navigation Reorganization

## 1. Objective
Transform the previous flat and redundant navigation structure into a logical, domain-driven hierarchy that reflects modern ERP best practices. Focus on reducing visual noise, removing duplicates, and improving user mental mapping.

## 2. Reorganized Hierarchy

### I. Overview (Core Operations)
*   **Dashboard**: ` /dashboard` - Central business health.
*   **Setup Wizard**: `/setup-wizard` - Onboarding and config.
*   **TaskBoard & Performance**: `/workspace/tasks` - Daily operations and project tracking.
*   **Import (Migration)**: `/migration` - External data onboarding.

### II. Commercial (Direct Revenue)
*   **Point of Sale (POS)**:
    *   Terminal: `/sales`
    *   History: `/sales/history`
    *   Daily Summary: `/sales/summary`
    *   Analytics: `/sales/analytics`
*   **Sales & Orders**:
    *   Quotations: `/sales/quotations`
    *   Deliveries: `/sales/deliveries`
    *   Returns & Credit Notes: `/sales/returns`, `/sales/credit-notes`
    *   Discount Rules: `/sales/discounts`
*   **eCommerce**:
    *   Storefront & Themes: `/ecommerce/settings`, `/ecommerce/themes`
    *   Online Orders: `/ecommerce/orders`
    *   Product Catalog: `/ecommerce/catalog`

### III. Supply Chain (Operations & Logistics)
*   **Purchasing**:
    *   Procurement Console: `/purchases`
    *   Orders & Returns: `/purchases/purchase-orders`, `/purchases/returns`
    *   Sourcing: `/purchases/sourcing`
*   **Products & Catalog**:
    *   Master Data: `/products`
    *   Categories: `/inventory/categories`
    *   Brands/Units: `/inventory/units`
*   **Warehousing & Stock**:
    *   Locations: `/inventory/warehouses`
    *   Movements & Counts: `/inventory/movements`, `/inventory/stock-count`
    *   Transfer & Adjustment Orders: `/inventory/transfer-orders`, `/inventory/adjustment-orders`
    *   Alerts: `/inventory/low-stock`
*   **Supplier Portal**:
    *   Supplier Access & Gate: `/workspace/supplier-access`, `/workspace/supplier-portal`
    *   Proformas & Price Requests: `/workspace/proformas`, `/workspace/price-requests`

### IV. Performance (Finance & Accuracy)
*   **Accounting**:
    *   Chart of Accounts: `/finance/chart-of-accounts`
    *   General Ledger & Audit: `/finance/ledger`, `/finance/audit-trail`
    *   Fiscal Years: `/finance/fiscal-years`
*   **A/R & A/P**:
    *   Invoices & Payments: `/finance/invoices`, `/finance/payments`
    *   Expenses: `/finance/expenses`
    *   Reconciliation: `/finance/bank-reconciliation`
*   **Financial Reports**:
    *   Trial Balance / P&L / Balance Sheet
    *   Aging & Budgeting
    *   Tax (VAT) Reporting: `/finance/tax-reports`
*   **Cash & Assets**:
    *   Cash Registers: `/finance/cash-register`
    *   Bank Drawing: `/finance/accounts`
    *   Fixed Assets: `/finance/assets`

### V. Relationships (External Entities)
*   **Contacts & Leads**: `/crm/contacts`
*   **Price Groups**: `/crm/pricing`
*   **Client Portal**:
    *   Portal Settings: `/workspace/portal-config`
    *   Client Orders/Tickets/quotes: `/workspace/client-access`, `/workspace/quote-inbox`

### VI. Intelligence (AI/ML)
*   **AI Assistant**: `/mcp/chat`
*   **Virtual Employees**: `/mcp/agents`
*   **Knowledge Base**: `/mcp/conversations`

### VII. Management (Global Config)
*   **Security & Roles**: `/settings/roles`
*   **Custom Domains**: `/settings/domains`
*   **Audit Trail/Events**: `/finance/events`
*   **Subscription**: `/subscription`

## 3. Key Changes Applied
1.  **Duplicate Removal**: Deleted 14 redundant route entries that were previously split between Module views and Finance views.
2.  **Terminology Alignment**: Renamed "CRM" to "Relationships" and "Supply Chain" to include both Warehouse and Purchasing for integrated flow.
3.  **Visual Consistency**: Implemented a map of specific Lucide icons to route types to ensure the sidebar feels cohesive.
4.  **SaaS Isolation**: Explicitly grouped Platform hooks under "SaaS Control" with restricted visibility.

## 4. Verification Steps
- [ ] Verify all routes resolve through the new menu.
- [ ] Confirm breadcrumbs (where applicable) match the new organizational depth.
- [ ] Test visibility settings (Superuser vs Tenant User) across the new groups.
