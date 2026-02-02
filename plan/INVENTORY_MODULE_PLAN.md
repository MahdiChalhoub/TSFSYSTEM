# 🏭 Inventory & Stock System Expansion Plan

This document outlines the detailed roadmap to build a comprehensive Inventory Management System for TSF Store.

---

## 📅 Architecture Overview

We will execute this in **6 Logical Phases** to ensure stability.

### ✅ Phase 1: Advanced Product DNA (Core Data)
*Focus: Ensuring product data is perfect before we track stock.*

1.  **Automatic Barcode System** 
** my comment ** Thsi system will be used when no barcode issued from manifacture 

with an internal SKU for us , with a SKU Related with each supplier 
    *   **Logic:** Generate EAN-13 or internal strings (e.g., `200` prefix + ProductID).
    *   **UI:** "Generate" button on Product Form.
    *   **Settings:** Configuration screen for prefixes.
2.  **Smart Naming V2**
    ** my comment ** this smart naming will have a rule full custumized by user and saved and can be assign to all categories / brand / or multiple categories or brand 
    we need to creat this page

    *   **Logic:** Formula: `[Brand] [Attribute/Family] [Size][Unit] - [Country]`
    *   **Automation:** Auto-fill Name field when attributes change.
3.  **Variant & Clone System**
    *   **Duplicate:** "Clone Product" button (copies all fields except SKU/Barcode).
    *   **Variant Generator:** "Create Variants" tool (Select "Strawberry", "Vanilla" → Generates 2 products).
4.  **Image Management**
    *   **Gallery:** Support up to 5 images per product.

---

### 💰 Phase 2: Pricing & Value Engineering
*Focus: Knowing exactly how much money is sitting on the shelf.*

1.  **Costing Engine**
    *   **Fields:** `PurchasePrice` (Base), `ShippingCost`, `TaxRate`.
    *   **Computation:** `EffectiveCost = PurchasePrice + (PurchasePrice * Tax) + Shipping`.
2.  **Pricing Intelligence**
    *   **Tax Groups:** Define "Standard (15%)", "Exempt (0%)".
    *   **Pricing Groups:**
        *   **By Client:** Wholesale vs Retail prices.
        *   **By Product Family:** "All Shampoos have 30% margin".
3.  **Packaging Geometry**
    *   **Concept:** Parent/Child link. "Carton of 12" (Parent) -> "Single Unit" (Child).
    *   **Costing:** Carton Cost / 12 = Unit Cost.

---

### 📦 Phase 3: Stock Operations (The "Warehouse")
*Focus: Recording the physical movement of goods.*

1.  **Stock Adjustment (Audit Fixes)**
    *   **Screen:** "Add Adjustment".
    *   **Reasons:** Damaged, Expired, Theft, Found, Internal Use.
    *   **Effect:** Immediately updates `QuantityOnHand`.
2.  **Stock Transfer**
    *   **Screen:** "Move Stock".
    *   **Flow:** Warehouse A (Send) -> In Transit -> Warehouse B (Receive).
    *   **Alerts:** "You have 5 incoming transfers waiting acceptance".
3.  **Item Swap (Warranty/Exchange)**
    *   **Screen:** Stock Swap.
    *   **Logic:** Customer returns broken item A (Stock +1 Damaged), takes item B (Stock -1 Good).
4.  **Packaging Operations**
    *   **"De-package" Action:** Open 1 Box -> Stock +12 Units.
    *   **"Pack" Action:** Gather 12 Units -> Stock +1 Box.

---

### 🛡️ Phase 4: Maintenance & Integrity
*Focus: Preventing errors and fraud.*

1.  **"Modification Mode" (Audit Log)**
    *   **Feature:** Track *every* field change. "User X changed Price from 10 to 12".
    *   **UI:** "History" tab on Product Details.
2.  **Expiry Control**
    *   **Data:** `BatchNumber` + `ExpiryDate`.
    *   **Alerts:** Dashboard widget "Items expiring in 30 days".
3.  **Shelf Integrity**
    *   **Alert:** "Cost Price increased! Check Shelf Label." (Margin protection).

---

### 📊 Phase 5: Reporting center
*Focus: Business Intelligence.*

1.  **Reports**
    *   **Stock Movement:** "Show me everything that moved yesterday."
    *   **Valuation:** "What is the total value of the warehouse right now?"
    *   **Combined:** Stock Levels + Cost Value columns.
2.  **Labeling**
    *   **Action:** "Print Labels" (Select products -> PDF layout).
    *   **Types:** Barcode Stickers, Shelf Tags (Large price).

---

### 🛍️ Phase 6: Promotions
*Focus: Driving sales.*

1.  **Promo Engine**
    *   **Rules:** "Buy X Get Y", "Discount %", "Bundle Price".
    *   **Control:** Date range enforcement.

---

## ⏱️ Execution Plan (Immediate Next Steps)

**Starting with Phase 1 (Product DNA):**
1.  Add `BarcodeSettings` to Database.
2.  Implement `generateBarcode()` service.
3.  Update `ProductForm` with "Clone" and "Generate Barcode" buttons.
4.  Implement `ImageGallery` component.
