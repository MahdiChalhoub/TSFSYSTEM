# TSF Ultimate Enterprise Suite - Technical Architecture (v2)

## 1. System Philosophy: "Total Freedom & Control"
This is a unified Business Operating System (BOS) for TSF.
-   **Zero Limitations**: The architecture supports infinite scaling of warehouses, users, and transactions.
-   **Central Nervous System**: All modules (CRM, HR, ERP, Store) share *one* database, meaning data flows instantly between departments.
-   **Granular Security**: Freedom for you (the owner) to do anything; strict limits for employees via Role-Based Access Control (RBAC).

---

## 2. The 7 Pillars (Modules)

### Module A: Core Security, Audit & Approvals (The Guard)
*   **Authentication & RBAC**: Secure Login with granular permissions (e.g., "Can Edit Price" vs "Can View Price").
*   **Universal Audit Trail**: "The Black Box". Every single field change (Old Value -> New Value) is recorded.
*   **Approval Workflow**: Critical actions (Price Changes, Large POs) trigger a "Pending Approval" state.

### Module B: CRM & Requests (Relationships)
*   **Unified Contact Book**: Suppliers and Customers.
*   **360° View**: See every Purchase Order or Sales Receipt linked to the profile.
*   **Request System**: Any employee can raise a "Product Request". Tracks status `REQUESTED` -> `APPROVED` -> `ORDERED` -> `ARRIVED`.
*   **Loyalty & Credit**: Manage customer credit limits and loyalty points.

### Module C: Advanced Inventory & Counting
*   **Multi-Warehouse**: Main Warehouse, Shop Floor, Virtual Bins (Damaged).
*   **Smart Counting**: "Blind Count" mode (Staff count without knowing system quantity).
*   **Expiry Tracking**: Strict batch management. Alerts for items expiring soon.
*   **Smart Transfers**: Algorithm analyzes Sales Velocity to suggest transfers.

### Module D1: Commercial Sales (POS)
*   **Smart Point of Sales**: Fast checkout, offline capable mode, hold cart functions.
*   **Flexible Pricing**: Wholesale prices, VIP tiers, Discount rules.
*   **Procurement Intelligence**: Supplier scorecards (Delivery time, Quality ratings).

### Module D2: Purchasing Application (The Funnel)
*   **Workflow**: Purchase Request -> Purchase Order (PO) -> Goods Received Note (GRN) -> Supplier Invoice.
*   **Pricing Engine**: When costs change, auto-calculate new selling prices based on margin rules.

### Module E: Automation & Tasks (The Robot)
*   **Donkey Task Automation**: Auto-add labels to print queue on price change; Auto-barcode generation.
*   **Expiry Alerts**: Auto-generate "Check" tasks for Shelf Managers.
*   **Smart Replenishment**: "Stop ordering Product X, we have too much".

### Module F: Workforce & Productivity (HR)
*   **Task Engine**: Assign tasks to specific employees or roles.
*   **Performance Evaluation**: Track "Sales per Hour" or "Tasks Completed".
*   **Payroll**: Integrated with Attendance (Clock-in/out) and Commission logic.

### Module G: Financial Grade Accounting
*   **General Ledger**: The heart of the financial system.
*   **Expense Claims**: Employees upload photos of receipts; Manager approves.
*   **Profit & Loss**: Real-time dashboard of profitability.

### Module H: Reports & Intelligence
*   **Custom Report Builder**: Drag-and-drop report creator.
*   **Forecasting**: AI predictions on what to buy based on last year's season.

---

## 3. Technology Stack (Implementation)

**We are building this using a modern Next.js 15+ frontend and a robust Django 5+ backend (REST Framework).**

### Database & Backend - "The Golden Source"
The system utilizes a Django-managed PostgreSQL database, leveraging the **Connector Module Pattern** for multi-tenant isolation and transaction integrity.

- **Authentication**: Custom Django-based JWT/Session authentication with Organization awareness.
- **Audit engine**: Server-side mixins record every field change (Old -> New).
- **APIs**: High-performance JSON APIs using Django Rest Framework.

## 4. Execution Plan

*   **Layer 1 (Core)**: Django Backend, Auth System, RBAC. **(COMPLETED)**
*   **Layer 2 (Inventory)**: Products, Warehouses, Stock, Scanning.
*   **Layer 3 (Finance)**: General Ledger, COA, Fiscal Management.
*   **Layer 4 (Commercial)**: POS Terminal, Purchasing Workflow.
*   **Layer 5 (HR & Productivity)**: Employee management and tasks.

---

**Current Status**: The core engine is stable. We are currently hardening the **Finance** and **Inventory** layers across the SaaS federation.
