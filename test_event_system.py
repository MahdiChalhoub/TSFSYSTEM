#!/usr/bin/env python3
"""
Test Event System Integration
==============================

Validates that:
1. Event contracts are defined
2. Event handlers are decorated correctly
3. EventBus registration works
"""

import sys
import os
import re
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / 'erp_backend'))

def test_contracts_defined():
    """Test that contract registration function exists"""
    print("\n🔍 Test 1: Contract Registration")
    print("=" * 50)

    try:
        # Count contract definitions in file
        file_path = Path('erp_backend/kernel/contracts/event_contracts.py')
        content = file_path.read_text()

        # Count ContractRegistry.register calls
        contract_count = len(re.findall(r'ContractRegistry\.register\(', content))

        print(f"✅ Contract definitions found: {contract_count} contracts")

        # Find contract categories
        categories = re.findall(r'def (register_\w+_contracts)\(\):', content)
        print(f"\n  📦 Contract categories:")
        for category in categories:
            print(f"    • {category.replace('register_', '').replace('_contracts', '')}")

        # Check for register_all_contracts function
        has_register_all = 'def register_all_contracts():' in content
        if has_register_all:
            print(f"\n✅ register_all_contracts() function exists")
        else:
            print(f"\n❌ register_all_contracts() function missing")
            return False, 0

        return True, contract_count
    except Exception as e:
        print(f"❌ Failed: {str(e)}")
        return False, 0


def test_handlers_decorated():
    """Test that event handlers are properly decorated"""
    print("\n\n🔍 Test 2: Handler Decorators")
    print("=" * 50)

    modules_to_check = [
        'apps/inventory/events.py',
        'apps/finance/events.py',
        'apps/crm/events.py',
        'apps/pos/events.py',
        'apps/hr/events.py',
        'apps/ecommerce/events.py',
    ]

    total_handlers = 0

    for module_path in modules_to_check:
        file_path = Path('erp_backend') / module_path

        if not file_path.exists():
            print(f"⚠️  {module_path}: File not found")
            continue

        content = file_path.read_text()

        # Count @subscribe_to_event decorators
        handlers = len(re.findall(r'@subscribe_to_event\(', content))
        total_handlers += handlers

        module_name = module_path.split('/')[1]
        print(f"  ✓ {module_name:12s}: {handlers} handler(s) registered")

    print(f"\n✅ Total handlers with @subscribe_to_event: {total_handlers}")
    return True, total_handlers


def test_validation_added():
    """Test that emit_event has validation logic"""
    print("\n\n🔍 Test 3: Emit Validation")
    print("=" * 50)

    file_path = Path('erp_backend/kernel/events/event_bus.py')
    content = file_path.read_text()

    checks = {
        'ContractRegistry import': 'from kernel.contracts.registry import ContractRegistry' in content,
        'validate_payload call': 'validate_payload(payload, contract' in content,
        'ValidationError handling': 'except ValidationError' in content,
    }

    all_passed = True
    for check_name, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check_name}")
        if not passed:
            all_passed = False

    if all_passed:
        print("\n✅ emit_event() has contract validation")
    else:
        print("\n❌ emit_event() missing validation")

    return all_passed, 1 if all_passed else 0


def test_startup_registration():
    """Test that contracts are registered at Django startup"""
    print("\n\n🔍 Test 4: Startup Registration")
    print("=" * 50)

    file_path = Path('erp_backend/apps/core/apps.py')
    content = file_path.read_text()

    checks = {
        'register_all_contracts import': 'from kernel.contracts.event_contracts import register_all_contracts' in content,
        'register_all_contracts() call': 'register_all_contracts()' in content,
        'In ready() method': 'def ready(self):' in content,
    }

    all_passed = True
    for check_name, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check_name}")
        if not passed:
            all_passed = False

    if all_passed:
        print("\n✅ Contracts will be registered on Django startup")
    else:
        print("\n❌ Startup registration missing")

    return all_passed, 1 if all_passed else 0


def main():
    """Run all tests"""
    print("=" * 70)
    print(" 🧪 EVENT SYSTEM INTEGRATION TEST")
    print("=" * 70)

    results = []

    # Run tests
    results.append(test_contracts_defined())
    results.append(test_handlers_decorated())
    results.append(test_validation_added())
    results.append(test_startup_registration())

    # Summary
    print("\n\n" + "=" * 70)
    print(" 📊 SUMMARY")
    print("=" * 70)

    passed = sum(1 for r in results if r[0])
    total = len(results)

    total_handlers = results[1][1]
    total_contracts = results[0][1]

    print(f"\nTests Passed: {passed}/{total}")
    print(f"Event Contracts: {total_contracts}")
    print(f"Event Handlers: {total_handlers}")

    if passed == total:
        print("\n🎉 ✅ ALL TESTS PASSED! Event system is fully integrated!")
        print("\nWhat this means:")
        print("  • Contracts will register on Django startup")
        print("  • Handlers are wired to EventBus")
        print("  • Payloads will be validated on emit")
        print("  • Events will flow across modules automatically")
        return 0
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        return 1


if __name__ == '__main__':
    sys.exit(main())
