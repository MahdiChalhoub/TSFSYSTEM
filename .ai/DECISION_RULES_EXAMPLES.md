# Decision Rules - Examples & Usage Guide

## Overview

The Decision Engine allows creating custom business rules for automated decision-making. All rules are tenant-isolated and require an organization context.

---

## Creating Decision Rules

### Method 1: Django Admin (Recommended for non-technical users)

1. Navigate to: `http://localhost:8000/admin/erp/decisionrule/`
2. Click "Add Decision Rule"
3. Fill in the form:
   - **Name**: Descriptive rule name
   - **Context**: Where the rule applies (e.g., `inventory.transfer`)
   - **Rule Type**: THRESHOLD, FORMULA, ML, or COMPOSITE
   - **Config**: JSON configuration
   - **Priority**: Lower number = higher priority
   - **Is Active**: Enable/disable the rule

### Method 2: Python/Django ORM

```python
from kernel.decision_engine import DecisionRule
from erp.models import Organization

# Get your organization
org = Organization.objects.get(id=1)  # Replace with actual org

# Create a rule
rule = DecisionRule.objects.create(
    organization=org,
    name='Auto-Approve Low-Cost Transfers',
    description='Automatically approve transfers under $500',
    context='inventory.transfer',
    rule_type='THRESHOLD',
    config={
        'field': 'total_cost',
        'operator': 'lt',
        'value': 500,
        'action': 'approve'
    },
    priority=10,
    is_active=True
)
```

### Method 3: REST API

```bash
POST /api/erp/decision-rules/
Authorization: Token YOUR_TOKEN
Content-Type: application/json

{
  "name": "Auto-Approve Low-Cost Transfers",
  "description": "Automatically approve transfers under $500",
  "context": "inventory.transfer",
  "rule_type": "THRESHOLD",
  "config": {
    "field": "total_cost",
    "operator": "lt",
    "value": 500,
    "action": "approve"
  },
  "priority": 10,
  "is_active": true
}
```

---

## Rule Types

### 1. THRESHOLD Rules

Simple comparisons against threshold values.

**Operators**: `lt`, `lte`, `gt`, `gte`, `eq`, `ne`

#### Example 1: Auto-Approve Low-Cost Transfers

```python
{
    'name': 'Auto-Approve Low-Cost Transfers',
    'context': 'inventory.transfer',
    'rule_type': 'THRESHOLD',
    'config': {
        'field': 'total_cost',
        'operator': 'lt',
        'value': 500,
        'action': 'approve'
    },
    'priority': 10
}
```

#### Example 2: Require Approval for High-Value

```python
{
    'name': 'High-Value Transfer Approval',
    'context': 'inventory.transfer',
    'rule_type': 'THRESHOLD',
    'config': {
        'field': 'total_cost',
        'operator': 'gte',
        'value': 5000,
        'action': 'require_approval'
    },
    'priority': 5
}
```

#### Example 3: Prevent Stockouts

```python
{
    'name': 'Prevent Source Stockout',
    'context': 'inventory.transfer',
    'rule_type': 'THRESHOLD',
    'config': {
        'field': 'source_stock_after',
        'operator': 'lt',
        'value': 10,
        'action': 'reject',
        'reason': 'Would cause stockout at source'
    },
    'priority': 1  # Highest priority
}
```

### 2. FORMULA Rules

Mathematical formulas for complex calculations.

#### Example 1: Transfer Quality Score

```python
{
    'name': 'Transfer Quality Scoring',
    'context': 'inventory.transfer',
    'rule_type': 'FORMULA',
    'config': {
        'formula': '(transfer_score * 0.6) + (urgency * 0.4)',
        'threshold': 70,
        'action': 'recommend'
    },
    'priority': 50
}
```

#### Example 2: Cost-Benefit Analysis

```python
{
    'name': 'Cost-Benefit Formula',
    'context': 'inventory.transfer',
    'rule_type': 'FORMULA',
    'config': {
        'formula': '(expected_margin - total_cost) / total_cost',
        'threshold': 0.2,  # 20% ROI minimum
        'action': 'approve'
    },
    'priority': 20
}
```

### 3. ML Rules

Machine learning model execution.

#### Example 1: Demand Forecast

```python
{
    'name': 'Demand Forecast ML',
    'context': 'inventory.reorder',
    'rule_type': 'ML',
    'config': {
        'model_name': 'demand_forecast_v1',
        'input_features': ['historical_sales', 'seasonality', 'trend'],
        'threshold': 0.8,  # Confidence threshold
        'action': 'recommend_reorder'
    },
    'priority': 30
}
```

#### Example 2: ABC Classification

```python
{
    'name': 'ABC Classification ML',
    'context': 'inventory.allocation',
    'rule_type': 'ML',
    'config': {
        'model_name': 'abc_classifier',
        'input_features': ['value', 'turnover', 'margin'],
        'action': 'classify'
    },
    'priority': 50
}
```

### 4. COMPOSITE Rules

Combination of multiple rules.

#### Example: Multi-Stage Approval

```python
{
    'name': 'Multi-Stage Transfer Approval',
    'context': 'inventory.transfer',
    'rule_type': 'COMPOSITE',
    'config': {
        'rules': [
            {
                'type': 'threshold',
                'field': 'total_cost',
                'operator': 'gte',
                'value': 1000,
                'weight': 0.4
            },
            {
                'type': 'threshold',
                'field': 'transfer_score',
                'operator': 'lt',
                'value': 70,
                'weight': 0.3
            },
            {
                'type': 'formula',
                'formula': 'stockout_risk_source + stockout_risk_dest',
                'threshold': 0.5,
                'weight': 0.3
            }
        ],
        'aggregation': 'weighted_vote',
        'threshold': 0.6,
        'action': 'require_approval'
    },
    'priority': 15
}
```

---

## Contexts

Available contexts for rules:

| Context | Description | Input Fields |
|---------|-------------|--------------|
| `inventory.transfer` | Transfer approval | total_cost, transfer_score, source_stock_after, dest_stock_after, distance_km |
| `inventory.allocation` | Order allocation | priority, total_cost, total_distance, product_count |
| `inventory.reorder` | Reorder decisions | current_stock, reorder_point, lead_time, forecast_demand |
| `inventory.approval` | General approvals | amount, requestor_level, urgency |

---

## Priority System

Rules are executed in **priority order** (lower number = higher priority):

- **1-10**: Critical rules (safety, compliance)
- **11-50**: Business rules (approvals, thresholds)
- **51-100**: Optimization rules (scoring, recommendations)
- **100+**: Low-priority rules (logging, analytics)

### Example Priority Scheme

```
Priority 1  → Prevent Stockouts (MUST)
Priority 5  → High-Value Approval (SHOULD)
Priority 10 → Auto-Approve Low-Cost (MAY)
Priority 50 → Quality Scoring (OPTIMIZE)
Priority 100→ Analytics Logging (NICE-TO-HAVE)
```

---

## Sample Rule Set: Transfer Approval Workflow

Complete example for transfer approval automation:

```python
from kernel.decision_engine import DecisionRule
from erp.models import Organization

org = Organization.objects.get(id=1)

# Rule 1: Safety First - Prevent Stockouts
DecisionRule.objects.create(
    organization=org,
    name='Safety: Prevent Source Stockout',
    context='inventory.transfer',
    rule_type='THRESHOLD',
    config={
        'field': 'source_stock_after',
        'operator': 'lt',
        'value': 10,
        'action': 'reject',
        'reason': 'Insufficient stock at source'
    },
    priority=1,
    is_active=True
)

# Rule 2: High-Value Requires Approval
DecisionRule.objects.create(
    organization=org,
    name='Approval: High-Value Transfers',
    context='inventory.transfer',
    rule_type='THRESHOLD',
    config={
        'field': 'total_cost',
        'operator': 'gte',
        'value': 5000,
        'action': 'require_approval',
        'approver_role': 'inventory_manager'
    },
    priority=5,
    is_active=True
)

# Rule 3: Auto-Approve Good Transfers
DecisionRule.objects.create(
    organization=org,
    name='Auto-Approve: Quality Transfers',
    context='inventory.transfer',
    rule_type='COMPOSITE',
    config={
        'rules': [
            {'field': 'total_cost', 'operator': 'lt', 'value': 1000, 'weight': 0.4},
            {'field': 'transfer_score', 'operator': 'gte', 'value': 80, 'weight': 0.6}
        ],
        'aggregation': 'weighted_vote',
        'threshold': 0.7,
        'action': 'approve'
    },
    priority=10,
    is_active=True
)

# Rule 4: Optimize Route
DecisionRule.objects.create(
    organization=org,
    name='Optimize: Shortest Route',
    context='inventory.transfer',
    rule_type='FORMULA',
    config={
        'formula': 'distance_km * shipping_cost_per_km',
        'minimize': True,
        'action': 'recommend_route'
    },
    priority=50,
    is_active=True
)
```

---

## Using Rules via Decision Engine

### Execute Rules for a Transfer

```python
from kernel.decision_engine import DecisionEngine

# Create engine instance
engine = DecisionEngine(organization=org)

# Evaluate transfer request
result = engine.evaluate(
    context='inventory.transfer',
    subject='transfer_request',
    input_data={
        'total_cost': 2500.00,
        'transfer_score': 85,
        'source_stock_after': 50,
        'dest_stock_after': 70,
        'distance_km': 250,
        'product_id': 123,
        'quantity': 50
    },
    subject_id='TR-2026-001'
)

# Result structure
{
    'decision': 'approve',
    'confidence': 0.87,
    'reasoning': 'Transfer meets all criteria. Score: 85/100',
    'recommendations': [
        'Transfer approved automatically',
        'Use direct route (250km)',
        'Estimated cost: $2,500'
    ],
    'rules_applied': [1, 10, 50],  # Rule IDs
    'metadata': {
        'execution_time_ms': 45.2,
        'cache_hit': False
    }
}
```

### Check Decision Logs

```python
from kernel.decision_engine import DecisionLog

# View recent decisions
recent = DecisionLog.objects.filter(
    organization=org,
    context='inventory.transfer'
).order_by('-created_at')[:10]

for log in recent:
    print(f"{log.created_at}: {log.decision_type} - {log.subject}")
    print(f"  Confidence: {log.output_data.get('confidence')}")
    print(f"  Rules: {log.rules_applied}")
```

---

## Performance Tuning

### Caching

Decision results are cached for 5 minutes by default:

```python
# In module.json
{
  "decision_engine": {
    "cache_enabled": true,
    "cache_ttl_seconds": 300
  }
}
```

### Rule Optimization

1. **Use Priority Wisely**: Place common rules first
2. **Minimize ML Rules**: ML is slower than threshold rules
3. **Cache ML Predictions**: Enable ML cache
4. **Disable Unused Rules**: Set `is_active=False` instead of deleting

### Monitoring

Track rule performance:

```python
from kernel.decision_engine import DecisionRule

rule = DecisionRule.objects.get(id=1)
print(f"Executions: {rule.execution_count}")
print(f"Success Rate: {rule.success_count / rule.execution_count * 100:.1f}%")
print(f"Avg Time: {rule.avg_execution_time_ms}ms")
```

---

## Best Practices

### 1. Start Simple
Begin with THRESHOLD rules, then add FORMULA and ML rules.

### 2. Test Thoroughly
Create test cases for each rule:

```python
# Test case
result = engine.evaluate(
    context='inventory.transfer',
    subject='test_transfer',
    input_data={'total_cost': 100}  # Should auto-approve
)
assert result['decision'] == 'approve'
```

### 3. Document Rules
Use the `description` field extensively.

### 4. Version Control
When changing rules, consider:
- Duplicating the rule with new version
- Deactivating old rule
- Monitoring both for a transition period

### 5. Audit Trail
Decision logs are permanent - use them for:
- Compliance audits
- Performance analysis
- ML model training data
- Business intelligence

---

## Troubleshooting

### Rule Not Firing

Check:
1. `is_active = True`
2. Priority order (higher priority rules might override)
3. Input data field names match config
4. Organization context is correct

### Unexpected Results

Enable debug logging:

```python
import logging
logging.getLogger('kernel.decision_engine').setLevel(logging.DEBUG)
```

### Performance Issues

- Check `avg_execution_time_ms` for slow rules
- Reduce number of active rules
- Enable caching
- Simplify COMPOSITE rules

---

## API Integration

Rules are automatically applied when using Intelligence APIs:

```bash
# Transfer analysis automatically applies transfer rules
POST /api/inventory/intelligence/analyze-transfer/
{
  "product_id": 123,
  "from_warehouse_id": 1,
  "to_warehouse_id": 3,
  "quantity": 50
}

# Response includes rule-based decision
{
  "approval_recommendation": {
    "decision": "approve",
    "confidence": 0.87,
    "rules_applied": [1, 10, 50]
  }
}
```

---

## Summary

Decision Rules provide:
- ✅ Automated decision-making
- ✅ Configurable business logic
- ✅ Tenant isolation
- ✅ Complete audit trail
- ✅ ML integration
- ✅ Performance optimization

**Next Steps**:
1. Create your first rule via Django admin
2. Test it with sample data
3. Monitor decision logs
4. Refine based on results
5. Add more sophisticated rules

For support, see:
- `kernel/decision_engine/` source code
- Decision logs in admin: `/admin/erp/decisionlog/`
- API documentation: `/api/schema/`
