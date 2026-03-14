# End-to-End Testing Guide
## Inventory Intelligence System

**Last Updated**: March 13, 2026
**Version**: 2.0.0
**Status**: Ready for Testing

---

## 🎯 Overview

This guide walks through complete end-to-end testing of the Inventory Intelligence system, from backend API to frontend UI.

---

## 🔧 Prerequisites

### 1. Backend Running

```bash
cd /root/current/erp_backend
source venv/bin/activate  # or source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

**Verify**: Visit `http://localhost:8000/api/inventory/intelligence/classify-abc/`

### 2. Frontend Running

```bash
cd /root/current
npm run dev
```

**Verify**: Visit `http://localhost:3000`

### 3. Database Migrated

```bash
cd /root/current/erp_backend
python manage.py migrate erp
```

**Expected**: `Applying erp.0022_decision_engine_models... OK`

### 4. Test User Created

```bash
python manage.py createsuperuser
# Username: testuser
# Email: test@example.com
# Password: testpass123
```

---

## 📋 Test Checklist

### Phase 1: Backend API Tests ✅

#### Test 1.1: Classify ABC (GET endpoint)

```bash
curl -X GET "http://localhost:8000/api/inventory/intelligence/classify-abc/" \
  -H "Authorization: Token YOUR_TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "classifications": {
    "A": [],
    "B": [],
    "C": []
  },
  "total_products": 0,
  "decision_id": "dec_..."
}
```

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 1.2: Forecast Demand (POST endpoint)

```bash
curl -X POST "http://localhost:8000/api/inventory/intelligence/forecast-demand/" \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 123,
    "days_ahead": 30
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "forecast": [
    {"date": "2026-03-14", "predicted_demand": 45.2, "confidence": 0.87},
    ...
  ],
  "total_predicted_demand": 1350.5,
  "confidence_score": 0.86,
  "current_stock": 1200,
  "recommendation": "...",
  "decision_id": "dec_..."
}
```

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 1.3: Analyze Transfer (POST endpoint) ⭐

```bash
curl -X POST "http://localhost:8000/api/inventory/intelligence/analyze-transfer/" \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 456,
    "from_warehouse_id": 1,
    "to_warehouse_id": 3,
    "quantity": 50,
    "reason": "Stock replenishment"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "cost_analysis": {
    "shipping": 125.00,
    "handling": 5.00,
    "packaging": 2.50,
    "labor": 25.00,
    "insurance": 7.50,
    "fuel_surcharge": 12.50,
    "total_direct_cost": 177.50
  },
  "opportunity_cost_analysis": {
    "margin_loss_during_transit": 45.00,
    "stockout_risk_at_source": 22.50,
    "delayed_fulfillment_cost": 15.00,
    "total_opportunity_cost": 82.50,
    "total_combined_cost": 260.00
  },
  "stock_impact": {...},
  "route_analysis": {...},
  "approval_recommendation": {
    "decision": "approve",
    "reasoning": "...",
    "confidence": 0.92
  },
  "transfer_score": 85,
  "executive_summary": "APPROVE: ...",
  "decision_id": "dec_..."
}
```

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 1.4: Optimize Allocation (POST endpoint)

```bash
curl -X POST "http://localhost:8000/api/inventory/intelligence/optimize-allocation/" \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_items": [
      {"product_id": 101, "quantity": 10}
    ],
    "customer_location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "priority": "STANDARD",
    "strategy": "smart"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "allocation_plan": [...],
  "total_cost": 23.75,
  "total_distance": 10.4,
  "fulfillment_score": 95,
  "executive_summary": "...",
  "decision_id": "dec_..."
}
```

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 1.5: Optimize Reorder (POST endpoint)

```bash
curl -X POST "http://localhost:8000/api/inventory/intelligence/optimize-reorder/" \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 123
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "reorder_point": 150,
  "safety_stock": 75,
  "current_stock": 200,
  "recommendation": "...",
  "decision_id": "dec_..."
}
```

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 1.6: Calculate ATP (POST endpoint)

```bash
curl -X POST "http://localhost:8000/api/inventory/intelligence/calculate-atp/" \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 123,
    "quantity": 50,
    "required_date": "2026-03-20"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "available_quantity": 150,
  "atp_date": "2026-03-15",
  "confidence": 0.95,
  "recommendation": "...",
  "decision_id": "dec_..."
}
```

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 1.7: Stockout Risk (POST endpoint)

```bash
curl -X POST "http://localhost:8000/api/inventory/intelligence/stockout-risk/" \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 123,
    "days_ahead": 7
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "risk_level": "medium",
  "stockout_probability": 0.35,
  "days_until_stockout": 12,
  "recommendation": "...",
  "decision_id": "dec_..."
}
```

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 1.8: Optimize Backorders (GET endpoint)

```bash
curl -X GET "http://localhost:8000/api/inventory/intelligence/optimize-backorders/" \
  -H "Authorization: Token YOUR_TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "backorders": [],
  "total_backorders": 0,
  "recommendations": [],
  "decision_id": "dec_..."
}
```

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Phase 2: Frontend UI Tests ✅

#### Test 2.1: Access Intelligence Dashboard

**Steps**:
1. Navigate to `http://localhost:3000/inventory/intelligence`
2. Verify page loads without errors
3. Check all 7 tabs are visible

**Expected**:
- ✅ Overview tab shows
- ✅ Forecast tab shows
- ✅ Reorder tab shows
- ✅ Transfer tab shows
- ✅ Allocation tab shows
- ✅ ABC tab shows
- ✅ Stockout tab shows

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 2.2: Demand Forecast UI

**Steps**:
1. Click "Forecast" tab
2. Enter Product ID: `123`
3. Select "30 days"
4. Click "Generate Forecast"

**Expected**:
- ✅ Loading spinner appears
- ✅ Results appear after API call
- ✅ Total predicted demand shown
- ✅ Confidence score displayed
- ✅ Daily forecast table visible
- ✅ Recommendation shown

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 2.3: Transfer Analysis UI ⭐

**Steps**:
1. Click "Transfer" tab
2. Enter:
   - Product ID: `456`
   - From Warehouse: `1`
   - To Warehouse: `3`
   - Quantity: `50`
   - Reason: `Stock replenishment`
3. Click "Analyze Transfer"

**Expected**:
- ✅ Loading spinner appears
- ✅ Executive summary banner shows (green/red/yellow)
- ✅ Transfer score badge displays
- ✅ **6-component direct cost** card shows:
  - Shipping
  - Handling
  - Packaging
  - Labor
  - Insurance
  - Fuel surcharge
  - Total direct cost
- ✅ **3-component opportunity cost** card shows (PURPLE):
  - Margin loss during transit
  - Stockout risk at source
  - Delayed fulfillment cost
  - Total opportunity cost
  - TRUE TOTAL COST (highlighted)
- ✅ "Industry First!" badge visible
- ✅ Stock impact cards show
- ✅ Route analysis shows
- ✅ Approval recommendation displayed

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 2.4: Allocation Optimizer UI

**Steps**:
1. Click "Allocation" tab
2. Select strategy: "Smart"
3. Select priority: "Standard"
4. Click "Optimize Allocation"

**Expected**:
- ✅ Form displays correctly
- ✅ Dropdowns work
- ✅ Button is clickable

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 2.5: Error Handling

**Steps**:
1. Click "Forecast" tab
2. Leave Product ID empty
3. Click "Generate Forecast"

**Expected**:
- ✅ Button is disabled
- ✅ No API call made

**Steps**:
1. Enter invalid Product ID: `99999999`
2. Click "Generate Forecast"

**Expected**:
- ✅ Error message displays
- ✅ Red alert box shows

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 2.6: Responsive Design

**Steps**:
1. Open browser DevTools
2. Toggle device toolbar
3. Test on:
   - Mobile (375px)
   - Tablet (768px)
   - Desktop (1440px)

**Expected**:
- ✅ Mobile: Single column layout
- ✅ Tablet: 2-column layout
- ✅ Desktop: 3-4 column layout
- ✅ All buttons accessible
- ✅ No horizontal scroll

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Phase 3: Integration Tests ✅

#### Test 3.1: Full User Journey - Transfer Analysis

**Scenario**: User wants to analyze a transfer request

**Steps**:
1. Login to frontend
2. Navigate to `/inventory/intelligence`
3. Click "Transfer" tab
4. Fill form with real data from database
5. Submit analysis
6. Review results
7. Click "View Decision Logs" (if implemented)

**Expected**:
- ✅ Seamless flow from UI to API
- ✅ Real-time results
- ✅ Accurate calculations
- ✅ Decision logged in database

**Verification**:
```bash
# Check decision log in database
cd /root/current/erp_backend
python manage.py dbshell
SELECT COUNT(*) FROM decision_log;
SELECT * FROM decision_log ORDER BY created_at DESC LIMIT 1;
\q
```

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 3.2: Decision Engine Logging

**Steps**:
1. Make any intelligence API call
2. Check database for decision log

**Verification**:
```sql
SELECT
  id,
  context,
  decision_type,
  subject,
  created_at,
  execution_time_ms
FROM decision_log
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**:
- ✅ New row created
- ✅ Context set correctly
- ✅ Input/output data stored
- ✅ Execution time recorded

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 3.3: Configuration System

**Steps**:
1. Update configuration value
2. Make API call
3. Verify new value used

**Commands**:
```python
from kernel.config import set_config, get_config
from erp.models import Organization

org = Organization.objects.first()

# Update shipping rate
set_config(org, 'inventory', 'transfer_cost.shipping_rate_per_km', 0.75)

# Verify
rate = get_config(org, 'inventory', 'transfer_cost.shipping_rate_per_km')
print(f"Shipping rate: ${rate}/km")  # Should be 0.75
```

**Expected**:
- ✅ Configuration updated
- ✅ New value used in calculations
- ✅ Per-tenant isolation works

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Phase 4: Performance Tests ✅

#### Test 4.1: API Response Time

**Tool**: `time` command

```bash
time curl -X POST "http://localhost:8000/api/inventory/intelligence/forecast-demand/" \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 123, "days_ahead": 30}'
```

**Expected**:
- ✅ Response time < 500ms

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 4.2: Frontend Load Time

**Tool**: Browser DevTools → Network tab

**Steps**:
1. Open DevTools
2. Navigate to `/inventory/intelligence`
3. Check Network tab

**Expected**:
- ✅ Initial load < 2s
- ✅ Tab switch < 100ms
- ✅ Component render < 200ms

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

#### Test 4.3: Database Query Performance

**Tool**: Django Debug Toolbar or SQL logging

**Commands**:
```python
from django.db import connection
from django.test.utils import CaptureQueriesContext

with CaptureQueriesContext(connection) as ctx:
    # Make API call
    from apps.inventory.services.intelligence_service import InventoryIntelligenceService
    service = InventoryIntelligenceService(organization=org)
    service.forecast_demand(product_id=123, days_ahead=30)

    print(f"Queries executed: {len(ctx.captured_queries)}")
    # Expected: < 10 queries
```

**Expected**:
- ✅ < 10 database queries per request
- ✅ No N+1 query problems
- ✅ Proper use of select_related/prefetch_related

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

## 🐛 Common Issues & Solutions

### Issue 1: "Network Error" in Frontend

**Symptom**: API calls fail with network error

**Causes**:
1. Backend not running
2. CORS not configured
3. Wrong API URL

**Solutions**:
```bash
# 1. Start backend
cd /root/current/erp_backend
python manage.py runserver 0.0.0.0:8000

# 2. Check CORS in settings.py
CORS_ALLOWED_ORIGINS = ['http://localhost:3000']

# 3. Check .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

### Issue 2: "Unauthorized 401"

**Symptom**: API returns 401 Unauthorized

**Causes**:
1. No auth token
2. Invalid token
3. Token expired

**Solutions**:
```typescript
// Check token in browser console
console.log(localStorage.getItem('auth_token'));

// Get new token
// 1. Login via UI
// 2. Or create token manually:
```

```python
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.get(username='testuser')
token, created = Token.objects.get_or_create(user=user)
print(f"Token: {token.key}")
```

---

### Issue 3: "Product/Warehouse Not Found"

**Symptom**: API returns 404 for product/warehouse

**Cause**: Test data doesn't exist

**Solution**:
```python
# Create test data
from apps.inventory.models import Product, Warehouse
from erp.models import Organization

org = Organization.objects.first()

# Create warehouse
wh1 = Warehouse.objects.create(
    organization=org,
    name="Warehouse 1",
    code="WH-1"
)

wh2 = Warehouse.objects.create(
    organization=org,
    name="Warehouse 2",
    code="WH-2"
)

# Create product
product = Product.objects.create(
    organization=org,
    name="Test Product",
    sku="PROD-123"
)

print(f"Created: {product.id}, {wh1.id}, {wh2.id}")
```

---

### Issue 4: Components Not Found

**Symptom**: Import errors in frontend

**Cause**: File paths incorrect

**Solution**:
```typescript
// Correct imports
import DemandForecast from './components/DemandForecast';
import { useIntelligenceAPI } from './hooks/useIntelligenceAPI';

// Check file exists
ls -la /root/current/src/app/\(privileged\)/inventory/intelligence/components/
```

---

## 📊 Test Results Template

```
==============================================
INVENTORY INTELLIGENCE - TEST RESULTS
==============================================

Date: _______________
Tester: _____________
Environment: Dev / Staging / Production

BACKEND API TESTS
-----------------
[✅/❌] Test 1.1: Classify ABC
[✅/❌] Test 1.2: Forecast Demand
[✅/❌] Test 1.3: Analyze Transfer
[✅/❌] Test 1.4: Optimize Allocation
[✅/❌] Test 1.5: Optimize Reorder
[✅/❌] Test 1.6: Calculate ATP
[✅/❌] Test 1.7: Stockout Risk
[✅/❌] Test 1.8: Optimize Backorders

FRONTEND UI TESTS
-----------------
[✅/❌] Test 2.1: Dashboard Access
[✅/❌] Test 2.2: Forecast UI
[✅/❌] Test 2.3: Transfer UI
[✅/❌] Test 2.4: Allocation UI
[✅/❌] Test 2.5: Error Handling
[✅/❌] Test 2.6: Responsive Design

INTEGRATION TESTS
-----------------
[✅/❌] Test 3.1: Full User Journey
[✅/❌] Test 3.2: Decision Logging
[✅/❌] Test 3.3: Configuration

PERFORMANCE TESTS
-----------------
[✅/❌] Test 4.1: API Response (< 500ms)
[✅/❌] Test 4.2: Frontend Load (< 2s)
[✅/❌] Test 4.3: DB Queries (< 10)

OVERALL STATUS: _______________

NOTES:
______________________________________
______________________________________
______________________________________
```

---

## ✅ Success Criteria

**System is ready for production when**:
- ✅ All 8 backend API tests pass
- ✅ All 6 frontend UI tests pass
- ✅ All 3 integration tests pass
- ✅ All 3 performance tests meet targets
- ✅ No critical bugs found
- ✅ Documentation complete
- ✅ Code reviewed

**Total**: 20/20 tests passing = **READY FOR PRODUCTION** 🚀

---

## 📞 Support

**Issues**: Report in GitHub
**Questions**: Check documentation in `.ai/` folder
**Architecture**: See `ANTIGRAVITY_CONSTRAINTS.md`
**API Docs**: See `.ai/INVENTORY_API_COMPLETE.md`
**Frontend Docs**: See `.ai/FRONTEND_INTELLIGENCE_COMPLETE.md`

---

**Happy Testing!** 🎉
