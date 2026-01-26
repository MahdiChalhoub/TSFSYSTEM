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

**We are building this *inside* your existing Next.js project to utilize Server Actions for maximum performance.**

### Database Schema (Prisma) - "The Golden Source"
We need a robust schema to handle this complexity.

```prisma
// 1. People & Access
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  role      String    // 'OWNER', 'MANAGER', 'STAFF'
  tasks     Task[]    // Tasks assigned to this user
}

// 2. CRM
model Contact {
  id        Int       @id @default(autoincrement())
  type      String    // 'SUPPLIER', 'CUSTOMER'
  name      String
  balance   Decimal   // Money they owe us (or we owe them)
  orders    Order[]
}

// 3. Operations
model Task {
  id          Int      @id @default(autoincrement())
  title       String
  assignedTo  User     @relation(fields: [userId], references: [id])
  status      String   // 'PENDING', 'DONE'
  evaluation  Int?     // Manager rating (1-5 stars)
}

// ... Plus Inventory, Products, and Financials models
```

## 4. Execution Plan (How we build this massive system)

We cannot build it all at once. We must layer it like a cake.

*   **Layer 1 (Data Foundation)**: Install Prisma, Design DB, Auth System. **(REQUIRED FIRST)**
*   **Layer 2 (Inventory)**: Products, Warehouses, Stock.
*   **Layer 3 (CRM & Partners)**: Suppliers, Customers.
*   **Layer 4 (Transactions)**: Buying and Selling.
*   **Layer 5 (HR & Tasks)**: Managing the team.

---

**Current Status**: We are at **Step 0**. We need to install the Database Engine to support *any* of this.
