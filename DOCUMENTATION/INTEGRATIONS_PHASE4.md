# Phase 4 — Integrations

## 4.1 Stripe Payment Gateway

### Goal
Enable online payment processing via Stripe with tenant-specific encrypted API keys.

### Files

| File | Purpose |
|------|---------|
| `apps/finance/gateway_models.py` | GatewayConfig model — AES-256 encrypted keys per tenant |
| `apps/finance/stripe_gateway.py` | StripeGatewayService — intents, webhooks, refunds |

### Data Model: GatewayConfig

| Column | Type | Purpose |
|--------|------|---------|
| `gateway_type` | Char(20) | STRIPE, PAYPAL, SQUARE, MANUAL |
| `is_active` | Bool | Enabled/disabled |
| `is_test_mode` | Bool | Sandbox vs live keys |
| `api_key_encrypted` | Text | AES-256 encrypted secret key |
| `publishable_key` | Char(255) | Frontend-safe public key |
| `webhook_secret_encrypted` | Text | Encrypted webhook signing secret |
| `supported_currencies` | JSON | ["USD", "EUR", "LBP"] |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/finance/gateway-configs/` | CRUD | Manage gateway configurations |
| `/finance/gateway-configs/{id}/set-keys/` | POST | Securely set encrypted API keys |
| `/finance/gateway-configs/{id}/test-connection/` | POST | Test gateway connectivity |
| `/finance/gateway-configs/stripe-webhook/` | POST | Stripe webhook receiver |

### Stripe Service Methods

| Method | Description |
|--------|-------------|
| `create_payment_intent(amount, currency)` | Create PaymentIntent for Stripe.js |
| `retrieve_payment_intent(id)` | Check payment status |
| `create_refund(pi_id, amount)` | Full or partial refund |
| `verify_webhook(payload, sig)` | Verify Stripe signature |
| `handle_webhook_event(event)` | Auto-record payment on invoice |

---

## 4.2 E-commerce Sync

### Goal
Bidirectional sync with Shopify and WooCommerce for products, orders, and inventory.

### Files
- `apps/integrations/ecommerce_connector.py`

### Connectors

| Connector | Auth | Features |
|-----------|------|----------|
| ShopifyConnector | Access Token | Product import/export, order import, inventory sync |
| WooCommerceConnector | Consumer Key/Secret | Product import, order import, inventory sync |

### Methods (both connectors)

| Method | Description |
|--------|-------------|
| `import_products(limit)` | Pull remote products into local catalog format |
| `import_orders(limit)` | Pull remote orders into local format |
| `sync_inventory(sku/id, quantity)` | Push local stock levels to remote |
| `test_connection()` | Validate API credentials |

---

## 4.3 ZATCA/FNE E-Invoicing

### Goal
Government e-invoicing compliance for Lebanon (FNE) and Saudi Arabia (ZATCA).

### Files
- `apps/finance/einvoicing_service.py`

### FNEService Methods

| Method | Description |
|--------|-------------|
| `generate_invoice_xml(invoice)` | Build FNE-compliant XML from Invoice |
| `submit_for_certification(xml)` | Submit to FNE certification API |
| `check_status(cert_id)` | Poll certification status |

### ZATCAService Methods

| Method | Description |
|--------|-------------|
| `generate_ubl_xml(invoice)` | UBL 2.1 XML (FATOORA Phase 2) |
| `sign_invoice(xml)` | X.509 digital signing |
| `submit_invoice(xml, clearance)` | B2B clearance or B2C reporting |
| `generate_qr_code(invoice)` | TLV QR code for receipts |

---

## 4.4 Report Builder

### Goal
User-defined reports with dynamic query building, multiple export formats, and scheduled delivery.

### Files

| File | Purpose |
|------|---------|
| `apps/finance/report_models.py` | ReportDefinition + ReportExecution models |
| `apps/finance/report_service.py` | Dynamic query builder + CSV/Excel/JSON export |
| `erp/tasks.py` (updated) | `run_scheduled_reports` Celery task |

### Data Model: ReportDefinition

| Column | Type | Purpose |
|--------|------|---------|
| `data_source` | Char | Model name: Order, Invoice, Product, etc. |
| `columns` | JSON | Column definitions with field/label/width |
| `filters` | JSON | Filter conditions: field/op/value |
| `aggregations` | JSON | Sum/avg/count/min/max definitions |
| `group_by` | JSON | Group-by field list |
| `schedule_cron` | Char | Cron expression for scheduled runs |
| `email_recipients` | JSON | Delivery email addresses |

### Data Sources (auto-registered)
Order, OrderLine, Invoice, InvoiceLine, Payment, Product, Category, Contact, Employee, Attendance, Leave

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/finance/reports/` | CRUD | Manage report definitions |
| `/finance/reports/{id}/run/` | POST | Execute report (optionally export) |
| `/finance/reports/{id}/executions/` | GET | Execution history |
| `/finance/reports/data-sources/` | GET | Available models and fields |

### Supported Exports
- **CSV** — Simple comma-separated
- **JSON** — Formatted data with aggregations
- **Excel** — Styled headers (Indigo), auto-width columns, totals row
