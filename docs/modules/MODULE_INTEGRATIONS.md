# Integrations Module

## Overview
The Integrations module provides connectors to third-party services and APIs, including payment gateways, shipping carriers, accounting systems, and e-commerce platforms. It follows a plugin architecture for easy extensibility.

## Key Features
- Payment gateway integrations (Stripe, PayPal, Square)
- Shipping carrier APIs (FedEx, UPS, DHL)
- Accounting system sync (QuickBooks, Xero)
- E-commerce platform connectors (Shopify, WooCommerce)
- Webhook management and processing
- OAuth 2.0 authentication handling
- Retry logic and error handling
- Integration health monitoring

## Core Models

### Integration
**Purpose**: Configuration for third-party service connection
**Key Fields**: name, provider, credentials (encrypted), is_active, settings
**Relationships**: Belongs to Organization
**Key Methods**: `test_connection()`, `sync_data()`, `handle_webhook()`

### WebhookEndpoint
**Purpose**: Incoming webhook configurations
**Key Fields**: integration, url, secret, events, is_active
**Key Methods**: `verify_signature()`, `process_event()`

### SyncLog
**Purpose**: Track integration sync operations
**Key Fields**: integration, direction, status, records_processed, errors
**Key Methods**: `mark_success()`, `mark_failed()`, `retry()`

## Supported Integrations

### Payment Gateways
- **Stripe**: Card payments, subscriptions, refunds
- **PayPal**: Express checkout, PayPal payments
- **Square**: Card reader integration
- **Authorize.net**: Enterprise card processing

### Shipping Carriers
- **FedEx**: Rate calculation, label generation, tracking
- **UPS**: Shipping rates, package tracking
- **USPS**: Domestic shipping
- **DHL**: International shipping

### Accounting
- **QuickBooks Online**: Chart of accounts, invoices, payments sync
- **Xero**: Financial data synchronization
- **Sage**: Legacy accounting integration

### E-commerce
- **Shopify**: Product sync, order import
- **WooCommerce**: Two-way product/order sync
- **Magento**: Enterprise e-commerce integration

## API Endpoints

### GET /api/integrations/
**Description**: List available integrations for organization
**Response**:
```json
[
  {
    "id": 1,
    "name": "Stripe Payment Gateway",
    "provider": "stripe",
    "is_active": true,
    "last_sync": "2026-03-14T10:30:00Z",
    "status": "healthy"
  }
]
```

### POST /api/integrations/
**Description**: Configure new integration
**Request Body**:
```json
{
  "provider": "stripe",
  "credentials": {
    "api_key": "sk_live_...",
    "webhook_secret": "whsec_..."
  },
  "settings": {
    "auto_capture": true
  }
}
```

### POST /api/integrations/{id}/test/
**Description**: Test integration connection
**Response**: Connection status and diagnostic info

### POST /api/integrations/{id}/sync/
**Description**: Manually trigger data synchronization
**Response**: Sync job ID for status tracking

### POST /api/webhooks/{provider}/{endpoint_id}/
**Description**: Webhook receiver endpoint
**Authentication**: Signature verification
**Processing**: Async via Celery

## Configuration

**Settings**:
- `INTEGRATIONS_RETRY_ATTEMPTS`: Failed request retries (default: 3)
- `INTEGRATIONS_TIMEOUT`: API call timeout seconds (default: 30)
- `WEBHOOK_SECRET_KEY`: Webhook signature verification
- `SYNC_BATCH_SIZE`: Records per sync batch (default: 100)

## Common Workflows

### Workflow: Payment Processing
```python
from apps.integrations.providers import StripeProvider

provider = StripeProvider(organization=org)
result = provider.charge_card(
    amount=15000,  # $150.00
    currency='USD',
    card_token='tok_visa',
    description='Invoice INV-2026-001'
)

if result.success:
    # Record payment in finance module
    create_payment_record(result.transaction_id)
```

## Dependencies
- `core`: Organization, authentication
- `finance`: Payment recording
- `inventory`: Product sync
- `sales`: Order processing

---

**Last Updated**: 2026-03-14
**Module Status**: Production
