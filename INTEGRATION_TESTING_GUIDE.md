# 🧪 INTEGRATION TESTING GUIDE

**Purpose**: Comprehensive guide to test and validate TSFSYSTEM ERP
**Version**: 1.0.0
**Date**: 2026-03-04

---

## 🎯 WHAT THIS GUIDE DOES

This guide walks you through **validating your entire TSFSYSTEM** to ensure:
- ✅ Kernel OS v2.0 works correctly
- ✅ Module boundaries are enforced
- ✅ Event contracts are validated
- ✅ AI coordination functions
- ✅ System is deployment-ready

---

## 📋 PRE-REQUISITES

### **1. Environment Setup**

```bash
# Navigate to project
cd /root/.gemini/antigravity/scratch/TSFSYSTEM

# Activate virtual environment (if using one)
source venv/bin/activate

# Install dependencies
cd erp_backend
pip install -r requirements.txt
```

### **2. Database Setup**

```bash
# Create database (PostgreSQL recommended)
createdb tsfsystem_dev

# Update .env file
cp .env.example .env
# Edit DATABASE_URL in .env
```

### **3. Verify Installation**

```bash
python manage.py check
# Should show: System check identified no issues (0 silenced).
```

---

## 🚀 PHASE 1: KERNEL MIGRATIONS (30 minutes)

### **Step 1: Review Migrations**

```bash
# Check what migrations will be created
python manage.py makemigrations --dry-run

# Expected: ~18 kernel tables + module tables
```

### **Step 2: Run Migrations**

```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Verify tables created
python manage.py dbshell
\dt kernel_*
\q
```

**Expected Tables**:
- `kernel_tenancy_*` (tenant, tenant_user)
- `kernel_rbac_*` (role, permission, role_permission)
- `kernel_audit_*` (audit_log, audit_trail)
- `kernel_events_*` (event_outbox, event_log)
- `kernel_config_*` (configuration, feature_flag)
- `kernel_contracts_*` (contract, contract_version)
- `kernel_modules_*` (kernel_module, org_module)
- `kernel_observability_*` (metric, performance_log)

### **Step 3: Create Superuser**

```bash
python manage.py createsuperuser
# Username: admin
# Email: admin@example.com
# Password: [your password]
```

---

## 🧪 PHASE 2: RUN INTEGRATION TESTS (2 hours)

### **Step 1: Run All Tests**

```bash
# Run complete integration test suite
python manage.py test tests.integration.test_kernel_integration

# Expected output:
# ✅ Tenant isolation: Products correctly filtered by tenant
# ✅ Event Bus: Events stored in outbox
# ✅ RBAC: Permission assignment works
# ✅ Audit Logging: CREATE actions logged
# ✅ Module Loader: Enable/disable works
# ✅ Config Engine: Set and get works
# ✅ Contract Validation: Valid payloads pass
# ✅ End-to-End: Complete sales flow works
```

### **Step 2: Test Individual Components**

#### **Test 1: Tenant Isolation**

```bash
python manage.py shell
```

```python
from erp.models import Organization
from apps.inventory.models import Product
from kernel.tenancy.middleware import set_current_tenant

# Create two tenants
tenant1 = Organization.objects.create(name="Acme", slug="acme")
tenant2 = Organization.objects.create(name="Beta", slug="beta")

# Create products
set_current_tenant(tenant1)
p1 = Product.objects.create(name="Product 1", sku="ACME-001")

set_current_tenant(tenant2)
p2 = Product.objects.create(name="Product 2", sku="BETA-001")

# Verify isolation
set_current_tenant(tenant1)
print(f"Tenant 1 products: {Product.objects.count()}")  # Should be 1

set_current_tenant(tenant2)
print(f"Tenant 2 products: {Product.objects.count()}")  # Should be 1

print("✅ Tenant isolation works!")
```

#### **Test 2: Event Bus**

```python
from kernel.events import emit_event, event_handler
from kernel.events.models import EventOutbox

# Emit event
emit_event('test.event', {'message': 'Hello World'})

# Check outbox
events = EventOutbox.objects.filter(event_type='test.event')
print(f"Events in outbox: {events.count()}")  # Should be 1

print("✅ Event bus works!")
```

#### **Test 3: RBAC**

```python
from django.contrib.auth import get_user_model
from kernel.rbac.models import Role, Permission
from kernel.rbac.services import RBACService

User = get_user_model()

# Create user
user = User.objects.create_user(username="testuser", email="test@test.com", password="pass")

# Create permission
perm = Permission.objects.create(name="finance.create_invoice")

# Create role
role = Role.objects.create(organization=tenant1, name="Accountant")
role.permissions.add(perm)

# Assign role
RBACService.assign_role(user, role, tenant1)

# Check permission
has_perm = RBACService.has_permission(user, "finance.create_invoice", tenant1)
print(f"User has permission: {has_perm}")  # Should be True

print("✅ RBAC works!")
```

#### **Test 4: Audit Logging**

```python
from apps.finance.models import Invoice
from kernel.audit.models import AuditLog
from kernel.tenancy.middleware import set_current_user
from decimal import Decimal

set_current_tenant(tenant1)
set_current_user(user)

# Create invoice
invoice = Invoice.objects.create(
    reference="INV-001",
    total_amount=Decimal("100.00")
)

# Check audit log
logs = AuditLog.objects.filter(
    content_type__model='invoice',
    object_id=str(invoice.id),
    action='CREATE'
)
print(f"Audit logs: {logs.count()}")  # Should be >= 1

print("✅ Audit logging works!")
```

---

## 🔒 PHASE 3: TEST ENFORCEMENT SYSTEM (1 hour)

### **Step 1: Install Enforcement**

```bash
# Install pre-commit hook and create baseline
bash .ai/enforcement/install.sh

# Expected output:
# ✅ Scripts are executable
# ✅ Pre-commit hook installed
# ✅ Baseline created
# ✅ Enforcement system is operational
```

### **Step 2: Create Baseline**

```bash
python3 .ai/enforcement/enforce.py baseline

# View baseline
cat .ai/enforcement/baseline.json | jq '.counts'

# Output shows existing violations
```

### **Step 3: Test Enforcement**

```bash
# Check a file
python3 .ai/enforcement/enforce.py check erp_backend/apps/finance/models.py

# Should show any violations
```

### **Step 4: Test Pre-Commit Hook**

```bash
# Create a test file with violation
echo "TAX_RATE = 0.15" > /tmp/test_violation.py

# Try to commit (will fail)
git add /tmp/test_violation.py
git commit -m "test"

# Should be blocked with:
# ❌ Architecture violations detected
```

---

## 📋 PHASE 4: TEST EVENT CONTRACTS (1 hour)

### **Step 1: Register Contracts**

```bash
python manage.py register_contracts

# Expected output:
# ✅ Registered 19 event contracts
# 📋 Registered Contracts:
#   • contact.created (crm → finance, notifications)
#   • invoice.created (finance → notifications, reporting)
#   ...
```

### **Step 2: Generate Documentation**

```bash
python manage.py register_contracts --generate-docs

# Creates: docs/EVENT_CONTRACTS.md
```

### **Step 3: Test Contract Validation**

```bash
python manage.py shell
```

```python
from kernel.contracts.testing import validate_event_payload
from kernel.contracts.event_contracts import register_all_contracts

register_all_contracts()

# Valid payload
payload = {
    'invoice_id': 123,
    'customer_id': 456,
    'total_amount': 99.99,
    'currency': 'USD',
    'tenant_id': 1
}

errors = validate_event_payload('invoice.created', payload, raise_on_error=False)
print(f"Validation errors: {len(errors)}")  # Should be 0

print("✅ Contract validation works!")
```

### **Step 4: Get Module Communication Map**

```bash
python manage.py register_contracts --map

# Creates: docs/MODULE_COMMUNICATION_MAP.md
```

---

## 🎯 PHASE 5: END-TO-END SCENARIOS (2 hours)

### **Scenario 1: Organization Provisioning**

```python
from erp.services import ProvisioningService
from kernel.events import emit_event

# Provision new organization
result = ProvisioningService.provision_organization(
    org_name="Test Company",
    admin_email="admin@testcompany.com"
)

# This should:
# 1. Create organization
# 2. Emit org:provisioned event
# 3. Finance module creates chart of accounts
# 4. Inventory module creates default warehouse
# 5. CRM module creates billing contact

print("✅ Organization provisioning works!")
```

### **Scenario 2: Complete Sales Flow**

```python
from apps.pos.models import Order
from apps.inventory.models import Inventory
from kernel.events import emit_event
from decimal import Decimal

# 1. Create POS sale
order = Order.objects.create(
    type='SALE',
    total_amount=Decimal("100.00"),
    reference="SALE-001"
)

# 2. Emit order.completed event
emit_event('order.completed', {
    'order_id': order.id,
    'type': 'SALE',
    'total_amount': 100.00,
    'lines': [{
        'product_id': product.id,
        'quantity': 1,
        'unit_price': 100.00,
        'cost_price': 60.00
    }],
    'tenant_id': tenant.id
})

# 3. Process events
from kernel.events.processor import EventProcessor
processor = EventProcessor()
processor.process_pending_events()

# 4. Verify results
# - Inventory deducted
# - Finance journal entry created
# - Audit logs created

print("✅ Complete sales flow works!")
```

### **Scenario 3: Cross-Module Event Flow**

```python
# Test: Invoice Created → Notifications Sent

from apps.finance.models import Invoice
from kernel.events import emit_event

invoice = Invoice.objects.create(
    reference="INV-TEST-001",
    total_amount=Decimal("500.00")
)

emit_event('invoice.created', {
    'invoice_id': invoice.id,
    'customer_id': customer.id,
    'total_amount': 500.00,
    'currency': 'USD',
    'tenant_id': tenant.id
})

# Process events
processor.process_pending_events()

# Verify notifications module received event
# (Check notification logs or email queue)

print("✅ Cross-module events work!")
```

---

## ✅ PHASE 6: VALIDATION CHECKLIST

Run through this checklist to ensure everything works:

### **Kernel OS Components**

- [ ] **Tenancy**: Multi-tenant isolation works
- [ ] **RBAC**: Permission assignment and checking works
- [ ] **Audit**: All changes are logged
- [ ] **Events**: Events are emitted and processed
- [ ] **Config**: Configuration get/set works
- [ ] **Contracts**: Contract validation works
- [ ] **Modules**: Module enable/disable works
- [ ] **Observability**: Metrics and logging work

### **Enforcement System**

- [ ] **Pre-commit hook**: Installed and blocks violations
- [ ] **Baseline**: Created with existing violations
- [ ] **CI Integration**: GitHub Actions runs enforcement
- [ ] **Validation**: Script detects violations correctly

### **Event Contracts**

- [ ] **Registration**: All 19 contracts registered
- [ ] **Documentation**: Generated and readable
- [ ] **Validation**: Valid payloads pass, invalid fail
- [ ] **Communication Map**: Shows module relationships

### **Integration**

- [ ] **Database**: All migrations applied
- [ ] **Tests**: All integration tests pass
- [ ] **End-to-End**: Complete flows work
- [ ] **Performance**: Response times acceptable

---

## 📊 PERFORMANCE BENCHMARKS

### **Expected Performance**

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Tenant isolation query | <5ms | <10ms |
| Event emission | <10ms | <20ms |
| Permission check | <5ms | <10ms |
| Audit log write | <5ms | <10ms |
| Contract validation | <1ms | <5ms |

### **Run Performance Tests**

```bash
python manage.py test tests.performance
```

---

## 🐛 TROUBLESHOOTING

### **Issue: Migrations Fail**

**Solution**:
```bash
# Check database connection
python manage.py dbshell

# Reset migrations (WARNING: Dev only!)
python manage.py migrate --fake kernel zero
python manage.py migrate kernel
```

### **Issue: Tests Fail**

**Solution**:
```bash
# Run with verbose output
python manage.py test tests.integration --verbosity=2

# Run specific test
python manage.py test tests.integration.test_kernel_integration.TenancyIntegrationTest.test_tenant_isolation
```

### **Issue: Pre-Commit Hook Not Working**

**Solution**:
```bash
# Reinstall
bash .ai/enforcement/install.sh

# Check hook exists
ls -la .git/hooks/pre-commit

# Test manually
python3 .ai/enforcement/enforce.py check --staged
```

### **Issue: Contract Registration Fails**

**Solution**:
```bash
# Check Python path
python manage.py shell
>>> from kernel.contracts.event_contracts import register_all_contracts
>>> register_all_contracts()
```

---

## 📈 MONITORING

### **Health Check Endpoints**

```python
# Add to urls.py
from django.http import JsonResponse

def health_check(request):
    from kernel.tenancy.models import Tenant
    from kernel.events.models import EventOutbox

    return JsonResponse({
        'status': 'healthy',
        'tenants': Tenant.objects.count(),
        'pending_events': EventOutbox.objects.filter(status='PENDING').count()
    })
```

### **Metrics to Track**

- **Tenant count**: Growth over time
- **Event backlog**: Pending events in outbox
- **Audit log volume**: Rate of changes
- **Permission checks**: Denied vs granted
- **Module status**: Enabled modules per tenant

---

## ✅ SUCCESS CRITERIA

Your system is ready for production when:

- ✅ All integration tests pass
- ✅ All enforcement checks pass
- ✅ All contracts validated
- ✅ Performance benchmarks met
- ✅ No critical violations in baseline
- ✅ Documentation complete
- ✅ Monitoring in place

---

## 🚀 NEXT STEPS AFTER TESTING

Once all tests pass:

1. **Deploy to Staging**: Test in staging environment
2. **Load Testing**: Test with realistic data volumes
3. **Security Audit**: Review RBAC and tenant isolation
4. **Documentation**: Update with any findings
5. **Production Deployment**: Deploy to production!

---

**Version**: 1.0.0
**Last Updated**: 2026-03-04
**Status**: ✅ Ready for Use
