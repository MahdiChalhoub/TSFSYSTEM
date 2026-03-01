# Auto-Tasking Engine — Complete Specification
> Version 2.0 — 80+ Rules, 7 Modules, Full Lifecycle

---

## Architecture Overview

The Auto-Tasking Engine transforms any business event or schedule into automated task creation. It acts as a universal automation layer across all modules.

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTO-TASKING ENGINE                          │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │ Event-Based  │    │  Recurring   │    │  Task Chains    │   │
│  │ Triggers     │    │  (Celery)    │    │  (Completion)   │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬──────────┘   │
│         │                   │                    │              │
│         └───────────┬───────┴────────────────────┘              │
│                     ▼                                           │
│            ┌────────────────┐                                   │
│            │ AutoTaskRule   │── conditions match?                │
│            │ (80+ rules)    │── broadcast to role?              │
│            └────────┬───────┘── priority override?              │
│                     ▼                                           │
│            ┌────────────────┐                                   │
│            │ Task Created   │── assigned to user/role           │
│            │ (TaskBoard)    │── due in 24h                      │
│            └────────────────┘── chain children fire on complete │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### AutoTaskRule (Expanded)

| Field | Type | Description |
|-------|------|-------------|
| `rule_type` | EVENT / RECURRING | Event-based or scheduled |
| `module` | inventory/purchasing/finance/crm/sales/hr/system | Module grouping |
| `code` | VARCHAR(10) | Unique code (INV-01, PUR-03) |
| `trigger_event` | 47 choices | What fires this rule |
| `conditions` | JSON | Amount, site, client, cashier, payment method filters |
| `recurrence_interval` | DAILY/WEEKLY/MONTHLY/QUARTERLY | For RECURRING rules |
| `recurrence_time` | TIME | What time to fire |
| `recurrence_day_of_week` | 0-6 | For WEEKLY rules |
| `recurrence_day_of_month` | 1-28 | For MONTHLY rules |
| `last_fired_at` | DATETIME | When rule last created a task |
| `chain_parent` | FK(self) | Only fire when parent task completes |
| `chain_delay_minutes` | INT | Delay after parent completion |
| `broadcast_to_role` | BOOL | Create task for ALL users in role |
| `priority` | VARCHAR(20) | Override template priority |
| `stale_threshold_days` | INT | For ORDER_STALE, APPROVAL_PENDING |
| `is_system_default` | BOOL | Pre-seeded (can disable, not delete) |

---

## Complete Rule Catalog (80 Rules)

### 📦 INVENTORY MODULE (17 Rules)

| Code | Trigger | Type | Name | Priority | Chain |
|------|---------|------|------|----------|-------|
| INV-01 | PRICE_CHANGE | Event | Print price tag on price change | HIGH | — |
| INV-02 | PRICE_CHANGE | Event | Apply updated price to POS terminal | HIGH | → INV-01 |
| INV-03 | BARCODE_MISSING_PURCHASE | Event | Print barcode for purchased product | HIGH | — |
| INV-04 | BARCODE_MISSING_TRANSFER | Event | Print barcode for transferred product | HIGH | — |
| INV-05 | BARCODE_DAILY_CHECK | Recurring/Daily | Daily check: products without barcodes | MEDIUM | — |
| INV-06 | PRODUCT_CREATED | Event | Review new product data | MEDIUM | — |
| INV-07 | PRODUCT_CREATED | Event | Assign shelf location to new product | LOW | → INV-06 |
| INV-08 | EXPIRY_APPROACHING | Event | Alert: product expiring soon | HIGH | — |
| INV-09 | PRODUCT_EXPIRED | Event | Withdraw expired product from shelf | URGENT | — |
| INV-10 | PRODUCT_EXPIRED | Event | Process expired product disposal | HIGH | → INV-09 |
| INV-11 | LOW_STOCK | Event | Create purchase order for low stock | HIGH | — |
| INV-12 | NEGATIVE_STOCK | Event | Investigate negative stock | URGENT | — |
| INV-13 | STOCK_ADJUSTMENT | Event | Review stock adjustment justification | MEDIUM | — |
| INV-14 | INVENTORY_COUNT | Recurring/Weekly | Weekly count: high-value items | MEDIUM | — |
| INV-15 | INVENTORY_COUNT | Recurring/Monthly | Monthly full inventory count | HIGH | — |
| INV-16 | CUSTOM | Recurring/Daily | Daily data quality check | LOW | — |
| INV-17 | CUSTOM | Recurring/Weekly | Weekly shelf replenishment check | MEDIUM | — |

### 🛒 PURCHASING MODULE (15 Rules)

| Code | Trigger | Type | Name | Priority | Chain |
|------|---------|------|------|----------|-------|
| PUR-01 | PURCHASE_NO_ATTACHMENT | Event | Attach invoice copy to purchase | HIGH | — |
| PUR-02 | PURCHASE_ENTERED | Event | Verify received quantities | HIGH | — |
| PUR-03 | PURCHASE_ENTERED | Event | Verify purchase prices vs quotation | HIGH | — |
| PUR-04 | PURCHASE_ENTERED | Event | Quality inspection on received goods | MEDIUM | — |
| PUR-05 | PURCHASE_ENTERED | Event | Shelve received products | MEDIUM | → PUR-02 |
| PUR-06 | RECEIPT_VOUCHER | Event | Create order from receipt voucher | HIGH | — |
| PUR-07 | PO_APPROVED | Event | Send approved PO to supplier | HIGH | — |
| PUR-08 | PROFORMA_RECEIVED | Event | Check proforma vs budget | HIGH | — |
| PUR-09 | TRANSFER_CREATED | Event | Process transfer at destination | HIGH | — |
| PUR-10 | ORDER_STALE | Recurring/Daily | Follow up on stale POs (3 days) | HIGH | — |
| PUR-11 | ORDER_STALE | Recurring/Daily | Reminder: PO awaiting approval (2 days) | HIGH | — |
| PUR-12 | NEW_SUPPLIER | Event | Complete supplier onboarding | MEDIUM | — |
| PUR-13 | DELIVERY_COMPLETED | Event | Process completed delivery | HIGH | — |
| PUR-14 | CUSTOM | Recurring/Weekly | Weekly supplier performance review | LOW | — |
| PUR-15 | CUSTOM | Recurring/Monthly | Reorder point planning review | MEDIUM | — |

### 💰 FINANCE MODULE (15 Rules)

| Code | Trigger | Type | Name | Priority | Chain |
|------|---------|------|------|----------|-------|
| FIN-01 | CREDIT_SALE | Event | Follow up on credit sale | HIGH | — |
| FIN-02 | HIGH_VALUE_SALE | Event | Manager review: high-value sale | HIGH | — |
| FIN-03 | OVERDUE_INVOICE | Recurring/Daily | Follow up on overdue invoices | HIGH | — |
| FIN-04 | PAYMENT_DUE_SUPPLIER | Event | Prepare supplier payment | HIGH | — |
| FIN-05 | RECEIPT_VOUCHER | Event | Post receipt to general ledger | HIGH | — |
| FIN-06 | POS_RETURN | Event | Review return justification | MEDIUM | — |
| FIN-07 | CASHIER_DISCOUNT | Event | Review cashier-applied discount | MEDIUM | — |
| FIN-08 | DAILY_SUMMARY | Recurring/Daily | End-of-day financial summary | HIGH | — |
| FIN-09 | BANK_STATEMENT | Event | Reconcile bank statement | HIGH | — |
| FIN-10 | MONTH_END | Recurring/Monthly | Month-end close procedure | URGENT | — |
| FIN-11 | LATE_PAYMENT | Event | Escalate late payment | HIGH | — |
| FIN-12 | NEW_INVOICE | Event | Process incoming invoice | MEDIUM | — |
| FIN-13 | CUSTOM | Recurring/Weekly | Weekly cash flow review | MEDIUM | — |
| FIN-14 | CUSTOM | Recurring/Quarterly | Quarterly tax preparation | HIGH | — |
| FIN-15 | CUSTOM | Recurring/Monthly | Fixed asset depreciation | MEDIUM | — |

### 👥 CRM MODULE (8 Rules)

| Code | Trigger | Type | Name | Priority |
|------|---------|------|------|----------|
| CRM-01 | CLIENT_FOLLOWUP_DUE | Recurring/Daily | Client follow-up per strategy | MEDIUM |
| CRM-02 | SUPPLIER_FOLLOWUP_DUE | Recurring/Weekly | Supplier follow-up | MEDIUM |
| CRM-03 | NEW_CLIENT | Event | New client onboarding | MEDIUM |
| CRM-04 | CLIENT_INACTIVE | Recurring/Weekly | Re-engage inactive clients (30 days) | LOW |
| CRM-05 | CLIENT_COMPLAINT | Event | Respond to complaint within 24h | URGENT |
| CRM-06 | ADDRESS_BOOK_VERIFY | Recurring/Daily | Daily address book verification | LOW |
| CRM-07 | CUSTOM | Recurring/Monthly | Monthly VIP client review | MEDIUM |
| CRM-08 | CUSTOM | Recurring/Quarterly | Client segmentation update | LOW |

### 📋 SALES/POS MODULE (8 Rules)

| Code | Trigger | Type | Name | Priority |
|------|---------|------|------|----------|
| POS-01 | ORDER_COMPLETED | Event | Post-sale verification | LOW |
| POS-02 | NEGATIVE_STOCK | Event | Investigate negative stock sale | URGENT |
| POS-03 | CUSTOM | Recurring/Daily | Daily register close verification | HIGH |
| POS-04 | CUSTOM | Recurring/Daily | Daily discount review | MEDIUM |
| POS-05 | CUSTOM | Recurring/Weekly | Weekly sales performance analysis | MEDIUM |
| POS-06 | HIGH_VALUE_SALE | Event | Customer satisfaction follow-up | MEDIUM |
| POS-07 | CUSTOM | Recurring/Daily | Follow up on expiring quotations | MEDIUM |
| POS-08 | POS_RETURN | Event | Restock returned items | MEDIUM |

### 👤 HR MODULE (5 Rules)

| Code | Trigger | Type | Name | Priority |
|------|---------|------|------|----------|
| HR-01 | EMPLOYEE_ONBOARD | Event | New employee onboarding checklist | HIGH |
| HR-02 | LEAVE_REQUEST | Event | Review leave request | MEDIUM |
| HR-03 | ATTENDANCE_ANOMALY | Recurring/Daily | Review attendance anomalies | MEDIUM |
| HR-04 | CUSTOM | Recurring/Monthly | Monthly payroll preparation | URGENT |
| HR-05 | CUSTOM | Recurring/Quarterly | Quarterly performance evaluation | MEDIUM |

### ⚙️ SYSTEM MODULE (8 Rules)

| Code | Trigger | Type | Name | Priority |
|------|---------|------|------|----------|
| SYS-01 | USER_REGISTRATION | Event | Approve new user registration | HIGH |
| SYS-02 | REPORT_NEEDS_REVIEW | Event | Review flagged report | MEDIUM |
| SYS-03 | ORDER_STALE | Recurring/Daily | Untreated orders reminder (3 days) | HIGH |
| SYS-04 | APPROVAL_PENDING | Recurring/Daily | Pending approvals reminder (2 days) | HIGH |
| SYS-05 | CUSTOM | Event | Review supplier portal proforma | HIGH |
| SYS-06 | CUSTOM | Event | Process supplier price change request | HIGH |
| SYS-07 | CUSTOM | Event | Respond to client support ticket | HIGH |
| SYS-08 | CUSTOM | Recurring/Weekly | Weekly system health check | LOW |

---

## Task Chains (Dependencies)

```
INV-01 Price Tag Printed ──→ INV-02 Apply to POS
INV-06 Review New Product ──→ INV-07 Assign Shelf Location
INV-09 Withdraw Expired  ──→ INV-10 Process Disposal
PUR-02 Verify Quantities ──→ PUR-05 Shelve Products
```

When parent task is completed, child task auto-creates (with optional delay).

---

## Integration Points

### How to fire triggers from other modules:

```python
# Inventory module
from apps.workspace.signals import trigger_inventory_event
trigger_inventory_event(org, 'PRICE_CHANGE', product_name='Coca-Cola', reference='PROD-123')
trigger_inventory_event(org, 'LOW_STOCK', product_name='Sugar', product_id=45)

# Purchasing module
from apps.workspace.signals import trigger_purchasing_event
trigger_purchasing_event(org, 'PURCHASE_ENTERED', reference='PO-2026-001', amount=500000)

# Finance module
from apps.workspace.signals import trigger_finance_event
trigger_finance_event(org, 'CREDIT_SALE', amount=1000000, client_id=12, user=cashier)

# CRM module
from apps.workspace.signals import trigger_crm_event
trigger_crm_event(org, 'NEW_CLIENT', reference='John Doe', client_id=15)
```

---

## Frontend Pages

| Page | Route | Purpose |
|------|-------|---------|
| Auto-Task Settings | `/workspace/auto-task-settings` | Module-grouped overview with filters |
| Auto-Task Rules | `/workspace/auto-task-rules` | Create/edit individual rules |
| TaskBoard | `/workspace/tasks` | View and manage all tasks |

---

## Deployment Checklist

```bash
# 1. Run migration
python manage.py migrate workspace

# 2. Seed default rules (all orgs)
python manage.py seed_auto_tasks

# 3. Or seed for specific org
python manage.py seed_auto_tasks --subdomain demo

# 4. Add Celery Beat schedule (in settings.py CELERY_BEAT_SCHEDULE)
'fire-recurring-auto-tasks': {
    'task': 'apps.workspace.tasks.fire_recurring_auto_tasks',
    'schedule': crontab(minute='*/15'),
},
'check-stale-orders': {
    'task': 'apps.workspace.tasks.check_stale_orders',
    'schedule': crontab(hour=8, minute=0),  # 8 AM daily
},
```
