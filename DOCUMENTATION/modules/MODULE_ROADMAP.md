# Module Roadmap: Supplier Gate, Client Gate & Workspace

> **Status**: Planning — Not yet implemented  
> **Created**: 2026-02-19  
> **Priority**: Future modules after current integration stabilization  

---

## Module 1: 🏭 Supplier Gate (Supplier Community Portal)

**Goal**: Give suppliers controlled access to YOUR ERP — self-serve, propose orders, collaborate.

### Features

#### 1.1 Supplier Dashboard
- Key metrics (their sales to you, pending orders, stock levels)
- Notifications center (PO approvals, price change responses)

#### 1.2 Order & Statement Visibility
- View their Purchase Orders with status tracking
- Sales history to your organization
- Statement of account (balance, payments, pending invoices)

#### 1.3 Stock Visibility (Permission-Gated)
- See stock levels of their products in your warehouses (authorized only)
- Stock alerts when their products run low
- Product performance/evaluation (sell-through rate, returns, shelf life)

#### 1.4 Proforma Suggestion Workflow
```
Supplier creates Proforma → Sends to you → You review → 
  ✅ Approve → Auto-converts to Purchase Order → Normal PO cycle
  ❌ Reject → Supplier notified with reason → Can revise & resend
  ✏️ Negotiate → Counter-proposal sent back
```

#### 1.5 Price Management Requests
- Selling price adjustment requests
- Purchase price proposals
- Approval workflow with counter-proposal support
- Price change history log

#### 1.6 Permissions
| Permission | Description |
|-----------|-------------|
| `VIEW_OWN_ORDERS` | See their POs and history |
| `VIEW_OWN_STOCK` | See stock of their products |
| `VIEW_OWN_STATEMENT` | Financial statement access |
| `CREATE_PROFORMA` | Propose new proformas |
| `REQUEST_PRICE_CHANGE` | Propose price adjustments |
| `VIEW_PRODUCT_PERFORMANCE` | See evaluation metrics |

#### 1.7 Architecture
- **Auth**: Separate supplier login (JWT with supplier role)
- **Backend**: `apps/supplier_portal/`
- **Frontend**: `(supplier)/` route group
- **Notifications**: Email + in-app

---

## Module 2: 🛒 Client Gate (Client Community Portal + eCommerce)

**Goal**: Full client portal — eCommerce + account management + loyalty + delivery tracking.

### Features

#### 2.1 Client Dashboard
- Unified order history (site, app, physical store, POS — all channels)
- Account balance and statement
- Loyalty points + Coin wallet balance
- Wallet barcode for POS redemption
- **Account barcode**: Client scans at POS → purchases auto-assigned to their account (no manual lookup needed) 

#### 2.2 Full eCommerce
- Product catalog with search/filters
- Shopping cart + checkout + payment (Stripe, mobile money)
- Wishlist and favorites
- Personalized pricing tiers

#### 2.3 Delivery Tracking
- Real-time GPS tracking on map
- Order status timeline
- Estimated delivery time
- Driver info and contact
- **Driver & delivery rating**: Client rates delivery experience after completion
- **Problem reporting**: Client can report issues (damaged, wrong item, late) with photos

#### 2.4 Loyalty & Wallet
- Earn points per purchase, redeem for discounts
- Coin wallet (POS change stored digitally)
- Barcode for POS scanning
- Transaction history

#### 2.5 Communication
- Product availability requests
- Complaint tickets with tracking
- Real-time chat with support
- Feedback, ratings, and suggestions

#### 2.6 Architecture
- **Auth**: Client registration (email, phone, social)
- **Backend**: `apps/client_portal/`
- **Frontend**: `(client)/` route group or standalone
- **Mobile**: Designed for React Native / Flutter transfer
- **Real-time**: WebSocket for chat + tracking
- **Maps**: Leaflet/Mapbox for delivery visualization

---

## Module 3: 📋 Workspace (Task Management & Employee Performance)

**Goal**: Hierarchical task system with auto-tasks, checklists, KPIs, and performance reports.

### Features

#### 3.1 Organization Hierarchy & Task Flow
- Visual org chart tree
- **Higher → Lower**: Task assignment direction
- **Lower → Higher**: Task replies/responses flow back up as notifications
- **Lower → Higher requests**: Suggestions, material requests, escalations (not direct tasks, requires approval)
- Group or individual assignment

C
| Trigger | Auto-Task |
|---------|----------|
| Price change | Update shelf label |
| New invoice | Verify and enter invoice |
| Low stock | Create purchase order |
| Expiry approaching | Check expiry dates |
| New supplier | Visit and collect documents |
| Client complaint | Call client |
| PO approved | Create order with supplier |

#### 3.3 Manual Tasks
- Rich task creation (title, assignee, priority, due date)
- Reminders, overdue alerts, escalation
- Subtasks, dependencies, attachments, comments
- **Recurring tasks**: Daily, weekly, monthly, or custom schedule (not just one-time)

#### 3.4 Checklists
| Type | Example |
|------|---------|
| Start of Shift | Cash count, cleanliness, equipment |
| Mid-Shift | Restocking, temp checks, quality |
| End of Shift | Cash reconciliation, cleanup, security |
| Custom | Any org-defined checklist |

#### 3.5 KPI & Points System
- Points per task type (configurable)
- Auto-calculated: completion rate, on-time %, quality score
- Employee leaderboard (Bronze → Silver → Gold → Platinum)
- Linkable to incentives/bonuses

#### 3.6 Questionnaires & Evaluations
- Organization creates evaluation templates
- Scheduled assignments (weekly, monthly, quarterly)
- Scored responses linked to employee profile

#### 3.7 Performance Reports
Auto-generated per employee:
- Task metrics (total, on-time %, overdue %)
- Checklist compliance rate
- KPI / Points accumulated
- Evaluation scores
- Timesheet integration (from HR attendance)
- Trend charts over time

#### 3.8 Architecture
- **Backend**: `apps/workspace/`
- **Models**: `Task`, `TaskTemplate`, `AutoTaskRule`, `Checklist`, `ChecklistTemplate`, `Questionnaire`, `EmployeeScore`, `KPIConfig`
- **Signals**: Connect to Inventory → Tasks, Finance → Tasks, POS → Tasks
- **Celery**: Auto-task generation, reminders, KPI computation

---

## Implementation Priority

| Phase | Module | Effort | Why This Order |
|-------|--------|--------|----------------|
| Phase 1 | Workspace | ~2 weeks | Internal-only, lower risk, builds notification infra |
| Phase 2 | Supplier Gate | ~2 weeks | Depends on PO, Finance, Inventory |
| Phase 3 | Client Gate | ~3-4 weeks | Largest scope (eCommerce + loyalty + tracking) |

---

## Confirmed Future Additions
1. ✅ Supplier product catalog upload (propose new products)
2. ✅ Client referral program (invite friends → earn points)
3. ✅ Recurring/subscription orders for regular clients
4. ✅ AI task priority suggestions from historical patterns
5. ✅ PWA support for mobile-first before native app
