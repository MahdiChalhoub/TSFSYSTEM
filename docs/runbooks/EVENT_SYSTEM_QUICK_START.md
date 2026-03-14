# 🚀 Event System - Quick Start Guide

**For**: Developers adding new events to TSFSYSTEM

---

## 📖 How to Add a New Event

### **Step 1: Define Contract** (5 min)

Add to [`kernel/contracts/event_contracts.py`](erp_backend/kernel/contracts/event_contracts.py):

```python
def register_your_module_contracts():
    """Register your module events"""

    ContractRegistry.register(
        name='product.updated',
        schema={
            'type': 'object',
            'required': ['product_id', 'tenant_id'],
            'properties': {
                'product_id': {'type': 'integer'},
                'tenant_id': {'type': 'integer'},
                'old_price': {'type': 'number'},
                'new_price': {'type': 'number'}
            }
        },
        category='EVENT',
        owner_module='inventory',
        version='1.0.0',
        description='Emitted when product is updated',
        producer='inventory',
        consumers=['finance', 'ecommerce']
    )

# Don't forget to call in register_all_contracts()
def register_all_contracts():
    # ... existing registrations ...
    register_your_module_contracts()  # Add this line
```

---

### **Step 2: Emit Event** (2 min)

In your business logic:

```python
from kernel.events import emit_event

# In your service/view
def update_product(product_id, new_price):
    # ... your logic ...

    # Emit event (auto-validated against contract)
    emit_event('product.updated', {
        'product_id': product.id,
        'tenant_id': request.tenant.id,
        'old_price': float(old_price),
        'new_price': float(new_price)
    })
```

**That's it!** The event is now validated and stored in the outbox.

---

### **Step 3: Handle Event** (5 min)

Create handler in target module's `events.py`:

```python
from kernel.events import subscribe_to_event
from kernel.contracts.decorators import enforce_contract

@subscribe_to_event('product.updated')
@enforce_contract('product.updated')
def on_product_updated(event):
    """
    Auto-registered handler for product.updated
    Payload is auto-validated
    """
    product_id = event.payload['product_id']
    old_price = event.payload['old_price']
    new_price = event.payload['new_price']

    # Your logic here
    logger.info(f"Product {product_id} price changed: {old_price} → {new_price}")

    # Update finance, recalculate margins, etc.
```

**Done!** Handler is auto-registered on Django startup.

---

## 🎯 Common Patterns

### **Pattern 1: Emit & Forget** (Most Common)
```python
emit_event('order.completed', payload)
# Continue processing
```

### **Pattern 2: Process Immediately** (Synchronous)
```python
emit_event('order.completed', payload, process_immediately=True)
# Handlers execute before returning
```

### **Pattern 3: Conditional Emit**
```python
if stock_level <= threshold:
    emit_event('inventory.low_stock', {
        'product_id': product.id,
        'current_quantity': stock_level,
        'min_level': threshold,
        'tenant_id': tenant.id
    })
```

---

## 🔍 Debugging Events

### **Check if handler is registered**
```python
from kernel.events import EventBus

handlers = EventBus.get_handlers('order.completed')
print(f"Handlers: {[h.__name__ for h in handlers]}")
```

### **Check if contract exists**
```python
from kernel.contracts.registry import ContractRegistry

contract = ContractRegistry.get('order.completed')
print(f"Contract: {contract}")
```

### **Test payload validation**
```python
from kernel.contracts.testing import validate_event_payload

payload = {'order_id': 123, 'total': 99.99}
errors = validate_event_payload('order.completed', payload, raise_on_error=False)
print(f"Validation errors: {errors}")
```

---

## 📊 Available Events

### **Core Events**
- `org:provisioned` - Organization created

### **Finance Events**
- `invoice.created` - Invoice created
- `invoice.paid` - Invoice paid
- `invoice.voided` - Invoice voided
- `payment.received` - Payment received

### **Inventory Events**
- `inventory.stock_changed` - Stock level changed
- `inventory.low_stock` - Low stock alert
- `inventory.adjusted` - Inventory adjustment

### **Sales Events**
- `order.completed` - Order completed
- `order.voided` - Order voided

### **Purchasing Events**
- `purchase_order.created` - PO created
- `purchase_order.received` - PO received

### **CRM Events**
- `contact.created` - Contact created
- `contact.updated` - Contact updated

### **Subscription Events**
- `subscription.renewed` - Subscription renewed
- `subscription.updated` - Subscription updated/credited

---

## ⚠️ Best Practices

### **DO**
✅ Always define contract before emitting
✅ Use `@enforce_contract` on handlers
✅ Include `tenant_id` in all payloads
✅ Use descriptive event names (`module.action`)
✅ Keep handlers idempotent (safe to run multiple times)

### **DON'T**
❌ Emit events without contracts (validation will fail)
❌ Put heavy logic in handlers (offload to background tasks)
❌ Create circular dependencies (Module A → B → A)
❌ Modify payload in handlers (treat as immutable)
❌ Raise exceptions in handlers (use try/except, log errors)

---

## 🧪 Testing Events

```python
# In tests
from kernel.events import EventBus
from kernel.contracts.testing import ContractTestCase

class OrderTests(ContractTestCase):
    def test_order_completed_event(self):
        # Valid payload
        payload = {
            'order_id': 123,
            'customer_id': 456,
            'total_amount': 99.99,
            'currency': 'USD',
            'items': [],
            'tenant_id': 1
        }

        # Validate contract
        self.assert_contract_valid('order.completed', payload)

        # Test handler
        from apps.inventory.events import on_order_completed
        mock_event = Mock(payload=payload, tenant_id=1)
        on_order_completed(mock_event)

        # Assert side effects
        self.assertTrue(...)
```

---

## 📚 More Resources

- **Full Documentation**: [EVENT_SYSTEM_COMPLETE.md](EVENT_SYSTEM_COMPLETE.md)
- **Contract Reference**: [EVENT_CONTRACTS_COMPLETE.md](EVENT_CONTRACTS_COMPLETE.md)
- **Handler Progress**: [EVENT_HANDLERS_PROGRESS.md](EVENT_HANDLERS_PROGRESS.md)

---

## 💡 Quick Tips

1. **Event names**: Use `module.action` format (e.g., `invoice.created`)
2. **Validation**: Happens automatically if contract exists
3. **Registration**: Happens at Django startup
4. **Processing**: Async by default (outbox pattern)
5. **Failures**: Isolated (one handler failure doesn't break others)

---

**Need help?** Check the full documentation or ask in #engineering-events

**Ready to add your first event? Follow the 3 steps above!** 🚀
