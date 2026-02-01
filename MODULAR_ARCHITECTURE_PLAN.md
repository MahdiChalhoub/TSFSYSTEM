# 🏗️ Modular Architecture Plan

This document outlines the strategy to develop the system as a **"Modular Monolith"**.
This allows us to work on **one module at a time** (isolated capability) while keeping them **linked** seamlessly in the final application.

---

## 🧩 The Core Concept

Instead of building a "big messy app", we treat each part of the business as a separate "Module" with its own responsibilities.

### Why this approach?
1.  **Focus:** We can finish "Inventory" 100% before worrying about "Sales".
2.  **Stability:** Changing the "HR" module won't break the "POS" module.
3.  **Speed:** We can test modules individually.

---

## 🗺️ Module Map

We will divide the project into these distinct modules:

### 📦 Module A: Inventory Core (Current Focus)
*   **Responsibility:** Defining *what* you sell.
*   **Components:** Products, Brands, Categories, Attributes (Parfums), Units.
*   **Status:** ~80% Complete. (Needs refinement on Barcodes/Pricing).

### 🏭 Module B: Stock Control (Warehouse)
*   **Responsibility:** Managing *how much* you have.
*   **Components:**
    *   **Stocktake:** Counting physical items (Sessions, Entries).
    *   **Movements:** In/Out logs.
    *   **Suppliers:** Purchasing & Receiving (Bon Entré).
*   **Link to Core:** Uses Product IDs from Module A.

### 💰 Module C: POS (Point of Sale)
*   **Responsibility:** Selling items to customers.
*   **Components:**
    *   Cashier Interface (Touch friendly).
    *   Cart / Basket.
    *   Receipts & Printing.
    *   Daily Sessions (Z-Report).
*   **Link to Core:** Reads Prices/Barcodes from Module A.
*   **Link to Stock:** Deducts Quantity from Module B.

### 👥 Module D: CRM & Loyalty
*   **Responsibility:** Managing customers.
*   **Components:** Customer Profiles, Loyalty Points, History.
*   **Link to POS:** Attached to Sales in Module C.

### 📅 Module E: HR & Scheduling
*   **Responsibility:** Managing staff.
*   **Components:** Employees, Shifts, Availability, Payroll calculator.
*   **Link to POS:** Cashiers verify via Module E user accounts.

---

## 🛠️ Technical Strategy: "How to Link Them?"

We will keep everything in **One Repository** (Monolith) to avoid deployment headaches, but we will separate the code strictly.

### 1. The Shared "Brain" (Data Layer)
*   **`schema.prisma`**: This is the contract. All modules share the database.
*   *Example:* The `Product` table is defined once. Module A writes to it, Module C reads from it.

### 2. File Structure Organization
We will move towards this structure:

```text
src/
├── app/
│   ├── admin/
│   │   ├── inventory/   <-- Module A & B UI
│   │   ├── crm/         <-- Module D UI
│   │   └── hr/          <-- Module E UI
│   └── pos/             <-- Module C UI (Independent Layout)
│
├── components/
│   ├── inventory/       <-- Components only for Inventory
│   ├── pos/             <-- Components only for POS
│   └── shared/          <-- Buttons, Inputs, Modals (Used by everyone)
│
└── lib/
    ├── service/         <-- Business Logic
    │   ├── inventory.ts
    │   ├── stock.ts
    │   └── pos.ts
```

### 3. Development Workflow

1.  **Pick a Module:** e.g., "Module B: Stock Control".
2.  **Define Data:** Update `schema.prisma` for Stocktakes/Suppliers.
3.  **Build Logic:** Create `src/lib/service/stock.ts`.
4.  **Build UI:** Create `src/app/admin/stock/...`.
5.  **Test:** Verify only Stock features.
6.  **Link:** Add a button in "Product Details" (Module A) to "View Stock History" (Module B).

---

## ✅ Next Steps Recommendation

Since we are finishing **Module A (Inventory Core)**, the logical next step is **Module B (Stock Control)** or **Module C (POS)** depending on your business priority.

**Recommendation:**
1.  **Finish Module A**: Ensure Attributes, Barcodes, and Pricing are perfect.
2.  **Start Module C (POS)**: Because you need to sell products to make money. The "Stock Control" can be simple (+/-) for now and upgraded later.
 