#!/usr/bin/env python3
"""
Create Sample Decision Rules
=============================

Creates demonstration decision rules for the inventory module.
These rules showcase the Decision Engine's capabilities.
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from kernel.decision_engine import DecisionRule, MLModel
from decimal import Decimal

print("=" * 70)
print("Creating Sample Decision Rules")
print("=" * 70)
print()

# Get or create a test organization (you can modify this for your needs)
from erp.models import Organization

# For demonstration, we'll create rules without organization (global defaults)
# In production, each organization would have their own rules

sample_rules = [
    {
        'name': 'Auto-Approve Low-Cost Transfers',
        'description': 'Automatically approve transfers under $500',
        'context': 'inventory.transfer',
        'rule_type': 'THRESHOLD',
        'config': {
            'field': 'total_cost',
            'operator': 'lt',
            'value': 500,
            'action': 'approve'
        },
        'priority': 10,
        'is_active': True
    },
    {
        'name': 'Require Approval for High-Value Transfers',
        'description': 'Transfers over $5000 need manager approval',
        'context': 'inventory.transfer',
        'rule_type': 'THRESHOLD',
        'config': {
            'field': 'total_cost',
            'operator': 'gte',
            'value': 5000,
            'action': 'require_approval'
        },
        'priority': 5,
        'is_active': True
    },
    {
        'name': 'High Transfer Score Bonus',
        'description': 'Boost score for transfers with good metrics',
        'context': 'inventory.transfer',
        'rule_type': 'FORMULA',
        'config': {
            'formula': 'transfer_score > 80',
            'multiplier': 1.2,
            'description': 'Increase confidence for high-quality transfers'
        },
        'priority': 50,
        'is_active': True
    },
    {
        'name': 'Prevent Source Stockout',
        'description': 'Block transfers that would cause source stockout',
        'context': 'inventory.transfer',
        'rule_type': 'THRESHOLD',
        'config': {
            'field': 'source_stock_after_transfer',
            'operator': 'lt',
            'value': 10,
            'action': 'reject',
            'reason': 'Would cause stockout at source warehouse'
        },
        'priority': 1,  # Highest priority
        'is_active': True
    },
    {
        'name': 'Smart Allocation Strategy',
        'description': 'Use smart allocation for standard orders',
        'context': 'inventory.allocation',
        'rule_type': 'THRESHOLD',
        'config': {
            'field': 'priority',
            'operator': 'eq',
            'value': 'STANDARD',
            'strategy': 'smart'
        },
        'priority': 100,
        'is_active': True
    },
    {
        'name': 'Nearest Warehouse for Express Orders',
        'description': 'Use nearest warehouse for express delivery',
        'context': 'inventory.allocation',
        'rule_type': 'THRESHOLD',
        'config': {
            'field': 'priority',
            'operator': 'eq',
            'value': 'EXPRESS',
            'strategy': 'nearest'
        },
        'priority': 10,
        'is_active': True
    },
]

print(f"Creating {len(sample_rules)} sample rules...")
print()

created_count = 0
for rule_data in sample_rules:
    try:
        rule, created = DecisionRule.objects.get_or_create(
            name=rule_data['name'],
            context=rule_data['context'],
            defaults=rule_data
        )

        if created:
            print(f"✅ Created: {rule.name}")
            print(f"   Context: {rule.context}")
            print(f"   Type: {rule.rule_type}")
            print(f"   Priority: {rule.priority}")
            created_count += 1
        else:
            print(f"⚠️  Exists: {rule.name}")

        print()

    except Exception as e:
        print(f"❌ Failed to create '{rule_data['name']}': {e}")
        print()

print("=" * 70)
print(f"Summary: {created_count} new rules created")
print("=" * 70)
print()

# Display all rules
print("All Decision Rules:")
print("=" * 70)

rules = DecisionRule.objects.all().order_by('context', 'priority')
current_context = None

for rule in rules:
    if rule.context != current_context:
        print()
        print(f"📋 Context: {rule.context}")
        print("-" * 70)
        current_context = rule.context

    status = "🟢 ACTIVE" if rule.is_active else "🔴 INACTIVE"
    print(f"   [{rule.priority:3d}] {rule.name:40s} {status}")
    print(f"         Type: {rule.rule_type:15s} | Executions: {rule.execution_count}")

print()
print("=" * 70)
print()
print("✅ Sample rules created successfully!")
print()
print("To view rules in Django admin:")
print("   http://localhost:8000/admin/erp/decisionrule/")
print()
print("To test rules via Decision Engine:")
print("""
from kernel.decision_engine import DecisionEngine

engine = DecisionEngine(organization=None)
result = engine.evaluate(
    context='inventory.transfer',
    subject='transfer_request',
    input_data={'total_cost': 300, 'transfer_score': 85}
)
print(result)
""")
print()
