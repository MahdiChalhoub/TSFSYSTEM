# AUTO-TASKING ENGINE — Complete Specification

> **Vision**: Every module, every feature, every business event has a configurable auto-task.
> Like permissions apply to every page, auto-tasks apply to every business process.

---

## Architecture

### Two Types of Auto-Tasks (Unified Model, Filterable)

| Type | Trigger | Example |
|---|---|---|
| **Event-Based** | A system event fires | Price changed → print price tag |
| **Time-Based (Recurring)** | Cron schedule | Every Monday → check stock levels |

Both use the same `AutoTaskRule` model. The `rule_type` field differentiates them.
User can filter: "Show me all", "Show event-based only", "Show recurring only".

### Task Chain (Dependency)
Some tasks require a **chain**: Task A done → Task B auto-created → Task C auto-created.
Example: Price changed → Print price tag (Task A) → Apply to POS (Task B, only after A is done).

---

## Complete Auto-Task Catalog (Grouped by Module)

### 📦 INVENTORY MODULE

| # | Trigger | Auto-Task Created | Default Assignee | Recurrence |
|---|---|---|---|---|
| INV-01 | Product price changed | Print new price tag from printing engine | Shelf Manager / Rayoniste | Event |
| INV-02 | Price tag printed & confirmed | Apply price to POS terminal | System (auto) | Event (chain from INV-01) |
| INV-03 | Product purchased without barcode | Print barcode label (with purchased qty) | Shelf Manager | Event |
| INV-04 | Product transferred without barcode | Print barcode label (with transfer qty) | Warehouse Manager | Event |
| INV-05 | Daily: Products without barcodes | Generate barcode labels for untagged products | Shelf Manager | Daily |
| INV-06 | New product created | Review product details (category, price, supplier) | Product Manager | Event |
| INV-07 | Product expiry approaching (X days) | Alert: Product expiring, review shelf quantity | Shelf Manager | Daily check |
| INV-08 | Product expired | Withdraw product from shelf, quarantine | Shelf Manager | Event |
| INV-09 | Low stock alert triggered | Create purchase order or transfer request | Procurement Lead | Event |
| INV-10 | Inventory count overdue | Perform physical count for zone/category | Warehouse Manager | Weekly/Monthly |
| INV-11 | Stock adjustment made | Review adjustment justification | Inventory Auditor | Event |

### 🛒 PURCHASING MODULE

| # | Trigger | Auto-Task Created | Default Assignee | Recurrence |
|---|---|---|---|---|
| PUR-01 | Purchase entered without invoice attachment | Attach copy of supplier invoice | Purchaser | Event |
| PUR-02 | Purchase entered | Verify received quantities vs ordered | Warehouse Receiver | Event |
| PUR-03 | Purchase entered | Verify prices vs supplier quotation | Procurement Lead | Event |
| PUR-04 | Purchase entered | Verify product quality/condition | Quality Inspector | Event |
| PUR-05 | Receipt voucher arrived | Create corresponding purchase order | Procurement Lead | Event |
| PUR-06 | Purchase order created | Review and approve PO | Manager/Director | Event |
| PUR-07 | Proforma received | Check proforma vs budget/quotation | Finance Controller | Event |
| PUR-08 | Purchase order not confirmed after X days | Reminder: Confirm or cancel pending PO | Procurement Lead | Daily check |
| PUR-09 | Transfer order created | Process transfer at destination | Destination Warehouse Mgr | Event |

### 💰 FINANCE MODULE

| # | Trigger | Auto-Task Created | Default Assignee | Recurrence |
|---|---|---|---|---|
| FIN-01 | Credit sale completed | Follow up on credit collection | Collections Agent | Event |
| FIN-02 | High-value sale (> threshold) | Manager review of transaction | Store Manager | Event |
| FIN-03 | Invoice overdue (X days) | Contact client for payment | Collections Agent | Daily check |
| FIN-04 | Supplier payment due date approaching | Prepare supplier payment | Finance Controller | Event |
| FIN-05 | Receipt voucher arrived | Process and post to ledger | Accountant | Event |
| FIN-06 | End of day | Generate daily financial summary | Finance Controller | Daily |
| FIN-07 | POS return/refund processed | Review return justification | Store Manager | Event |
| FIN-08 | Cashier applied discount > threshold | Review discount authorization | Store Manager | Event |
| FIN-09 | Bank statement received | Reconcile bank statement | Accountant | Event/Monthly |
| FIN-10 | Month end | Close period and validate entries | Chief Accountant | Monthly |

### 👥 CRM MODULE

| # | Trigger | Auto-Task Created | Default Assignee | Recurrence |
|---|---|---|---|---|
| CRM-01 | Client follow-up strategy due | Contact client per strategy | Sales Rep | Strategy schedule |
| CRM-02 | Supplier follow-up strategy due | Contact supplier per strategy | Procurement Lead | Strategy schedule |
| CRM-03 | New client registered | Welcome call/email + complete profile | Sales Rep | Event |
| CRM-04 | Client inactive > X days | Re-engagement outreach | Sales Rep | Weekly check |
| CRM-05 | Address book verification | Verify and update contact information | Admin | Daily |
| CRM-06 | Client complaint filed | Respond and resolve complaint | Customer Service | Event |

### 📋 SALES / POS MODULE

| # | Trigger | Auto-Task Created | Default Assignee | Recurrence |
|---|---|---|---|---|
| POS-01 | Negative stock sale | Investigate and replenish stock | Inventory Manager | Event |
| POS-02 | End of day close failed | Resolve register discrepancy | Cashier Supervisor | Event |
| POS-03 | Order completed | Post-sale customer satisfaction check | Sales Rep | Event (optional) |
| POS-04 | Late payment detected | Follow up on payment | Collections Agent | Event |

### 👤 HR MODULE

| # | Trigger | Auto-Task Created | Default Assignee | Recurrence |
|---|---|---|---|---|
| HR-01 | New employee onboarded | Complete onboarding checklist | HR Manager | Event |
| HR-02 | Leave request submitted | Review and approve/reject leave | HR Manager | Event |
| HR-03 | Attendance anomaly detected | Investigate absence/tardiness | HR Manager | Daily check |

### ⚙️ SYSTEM / ADMIN

| # | Trigger | Auto-Task Created | Default Assignee | Recurrence |
|---|---|---|---|---|
| SYS-01 | New user registration | Approve user account | Admin | Event |
| SYS-02 | Report generated with review flag | Review report | Manager | Event |
| SYS-03 | Order not treated after X days | Reminder: Process pending order | Responsible User | Daily check |
| SYS-04 | Order not approved after X days | Reminder: Approve pending order | Approver | Daily check |
| SYS-05 | Order not confirmed after X days | Reminder: Confirm pending order | Responsible User | Daily check |

---

## Data Model

### AutoTaskRule (expanded)
```python
class AutoTaskRule(TenantModel):
    RULE_TYPE_CHOICES = (
        ('EVENT', 'Event-Based'),
        ('RECURRING', 'Time-Based Recurring'),
    )
    
    rule_type = CharField(choices=RULE_TYPE_CHOICES, default='EVENT')
    
    # Module grouping
    module = CharField(max_length=30, choices=MODULE_CHOICES)  # inventory, finance, etc.
    code = CharField(max_length=10, unique_per_org=True)  # INV-01, PUR-03, etc.
    
    # Event trigger (for EVENT type)
    trigger_event = CharField(choices=TRIGGER_CHOICES)
    
    # Recurrence (for RECURRING type)  
    recurrence_cron = CharField(null=True)  # "0 8 * * 1" = every Monday 8am
    recurrence_interval = CharField(choices=INTERVAL_CHOICES, null=True)  # DAILY, WEEKLY, MONTHLY
    recurrence_time = TimeField(null=True)  # What time to fire
    recurrence_day_of_week = IntegerField(null=True)  # 0=Mon, 6=Sun
    recurrence_day_of_month = IntegerField(null=True)  # 1-31
    last_fired_at = DateTimeField(null=True)
    
    # Task chain
    chain_parent = ForeignKey('self', null=True)  # Only fire when parent task is COMPLETED
    chain_delay_minutes = IntegerField(default=0)  # Wait X minutes after parent completes
    
    # Priority override
    priority = CharField(choices=PRIORITY_CHOICES, default='MEDIUM')
    
    # Assignment
    assign_to_user = ForeignKey(User, null=True)
    assign_to_role = ForeignKey(Role, null=True)
    broadcast_to_role = BooleanField(default=False)  # Create task for ALL users in role
```

### New Trigger Events to Add
```python
TRIGGER_CHOICES = (
    # Existing
    ('PRICE_CHANGE', 'Product Price Changed'),
    ('LOW_STOCK', 'Low Stock Alert'),
    ...
    
    # NEW — Inventory
    ('BARCODE_MISSING_PURCHASE', 'Product Purchased Without Barcode'),
    ('BARCODE_MISSING_TRANSFER', 'Product Transferred Without Barcode'),
    ('PRODUCT_CREATED', 'New Product Created'),
    ('PRODUCT_EXPIRED', 'Product Has Expired'),
    ('STOCK_ADJUSTMENT', 'Stock Adjustment Made'),
    
    # NEW — Purchasing  
    ('PURCHASE_NO_ATTACHMENT', 'Purchase Without Invoice Attachment'),
    ('PURCHASE_ENTERED', 'Purchase Order Entered'),
    ('RECEIPT_VOUCHER', 'Receipt Voucher Arrived'),
    ('PROFORMA_RECEIVED', 'Proforma Received'),
    ('ORDER_STALE', 'Order Not Treated After X Days'),
    ('TRANSFER_CREATED', 'Transfer Order Created'),
    
    # NEW — Finance
    ('PAYMENT_DUE_SUPPLIER', 'Supplier Payment Due'),
    ('BANK_STATEMENT', 'Bank Statement Received'),
    ('MONTH_END', 'Month-End Close'),
    
    # NEW — CRM
    ('CLIENT_FOLLOWUP_DUE', 'Client Follow-Up Strategy Due'),
    ('SUPPLIER_FOLLOWUP_DUE', 'Supplier Follow-Up Due'),
    ('CLIENT_INACTIVE', 'Client Inactive > X Days'),
    ('NEW_CLIENT', 'New Client Registered'),
    
    # NEW — HR
    ('EMPLOYEE_ONBOARD', 'New Employee Onboarded'),
    ('LEAVE_REQUEST', 'Leave Request Submitted'),
    ('ATTENDANCE_ANOMALY', 'Attendance Anomaly Detected'),
    
    # NEW — System
    ('USER_REGISTRATION', 'New User Registration'),
    ('REPORT_NEEDS_REVIEW', 'Report Needs Review'),
    ('APPROVAL_PENDING', 'Approval Pending > X Days'),
)
```

---

## Settings Page: `/workspace/auto-task-settings`

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│ ⚡ Auto-Task Settings                              [+ New]  │
│ Configure automatic task creation for every business process │
├──────────────────────────────────────────────────────────────┤
│ Filter: [All ▾] [Event ▾] [Recurring ▾] | Module: [All ▾]  │
│ Search: [_______________________________]                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─ 📦 INVENTORY ──────────────────────── 11 rules ── 8 on ─┐│
│ │ ✅ INV-01  Price Change → Print Tag      Shelf Mgr   EVT ││
│ │ ✅ INV-02  Tag Printed → Apply POS       System      CHN ││
│ │ ✅ INV-03  No Barcode (Purchase) → Print Shelf Mgr   EVT ││
│ │ ⬜ INV-04  No Barcode (Transfer) → Print Warehouse   EVT ││
│ │ ✅ INV-05  Daily: Untagged Products      Shelf Mgr   ⏰D ││
│ │ ...                                                       ││
│ └───────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌─ 🛒 PURCHASING ─────────────────────── 9 rules ── 6 on ──┐│
│ │ ✅ PUR-01  No Attachment → Request       Purchaser    EVT ││
│ │ ✅ PUR-02  Purchase → Verify Qty         Receiver     EVT ││
│ │ ...                                                       ││
│ └───────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌─ 💰 FINANCE ────────────────────────── 10 rules ── 7 on ─┐│
│ │ ...                                                       ││
│ └───────────────────────────────────────────────────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Click on a rule → Expand/Edit inline:
```
┌─── INV-01: Price Change → Print Tag ─────────────────── ✅ ─┐
│ Trigger: PRICE_CHANGE   │ Type: Event-Based                  │
│ Task: Print new price tag from printing engine               │
│ Assigned to: [Shelf Manager ▾]  or  User: [Select User ▾]   │
│ Priority: [🟠 High ▾]                                       │
│ Chain: After completion → [INV-02: Apply to POS ▾]          │
│ Conditions: Min price change: [___] %                        │
│                                                [Save] [Reset]│
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

1. **Phase 1** — Backend model expansion (add rule_type, recurrence, chain, module, code)
2. **Phase 2** — Seed 50+ default auto-task definitions
3. **Phase 3** — Settings page (`/workspace/auto-task-settings`)
4. **Phase 4** — Wire triggers into existing business logic (signals)
5. **Phase 5** — Celery beat task for recurring rules
6. **Phase 6** — Task chain execution (parent complete → child created)
