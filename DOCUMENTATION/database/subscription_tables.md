# Database Table: PlanCategory

### Table Purpose
Defines the hierarchical categories for subscription plans, allowing for public (landing page), organization-specific, and internal plans.

### Columns
- `id`: Primary Key.
- `name`: Category name.
- `type`: One of `PUBLIC`, `ORGANIZATION`, `INTERNAL`.
- `parent`: Self-referencing FK for subcategories.
- `country`: FK to `Country` (used for filtering public plans by location).
- `allowed_organizations`: Many-to-Many to `Organization` (defines which orgs see this category if type is `ORGANIZATION`).

### Relationships
- `parent` (Self): One-to-Many.
- `country`: Many-to-One.
- `allowed_organizations`: Many-to-Many.
- `plans`: One-to-Many (Related to `SubscriptionPlan`).

### Which pages read from it
- Landing Page (Pricing Section).
- SaaS Control (Subscription Management).
- Organization Dashboard (Plan Selection).

### Which pages write to it
- SaaS Control (Admin only).

---

# Database Table: SubscriptionPlan

### Table Purpose
Stores the actual subscription offerings, including prices, features, and usage limits.

### Columns
- `id`: Primary Key.
- `category`: FK to `PlanCategory`.
- `name`: Plan name (e.g., "Silver", "Gold").
- `monthly_price`: Monthly billing amount.
- `annual_price`: Annual billing amount.
- `modules`: JSON list of enabled module codes.
- `features`: JSON dictionary of enabled feature flags.
- `limits`: JSON dictionary of usage limits.
- `upgrade_path`: Many-to-Many self-reference for allowed upgrade/downgrade routes.
- `is_active`: Boolean status.

### Relationships
- `category`: Many-to-One.
- `upgrade_path`: Many-to-Many.
- `organizations`: One-to-Many via `current_plan` in `Organization`.

### Which pages read from it
- Landing Page.
- Organization Dashboard.
- SaaS Control.

### Which pages write to it
- SaaS Control (Admin only).

---

# Database Table: SubscriptionPayment

### Table Purpose
Tracks the history of subscription payments and links them to the financial ledger.

### Columns
- `id`: Primary Key.
- `organization`: FK to `Organization`.
- `plan`: FK to `SubscriptionPlan`.
- `amount`: Paid amount.
- `billing_cycle`: `MONTHLY` or `ANNUAL`.
- `status`: `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`.
- `journal_entry_id`: Link to the General Ledger entry.
- `paid_at`: Timestamp of payment.

### Relationships
- `organization`: Many-to-One.
- `plan`: Many-to-One.

### Which pages read from it
- SaaS Control (Finance view).
- Organization Settings (Billing History).

### Which pages write to it
- Subscription Service (Backend logic).
