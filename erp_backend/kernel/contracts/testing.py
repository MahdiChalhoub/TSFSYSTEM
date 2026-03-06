"""
Contract Testing Utilities
===========================
Tools for testing event contracts in unit tests.

Usage:
    from kernel.contracts.testing import validate_event_payload, ContractTestCase

    class MyTests(ContractTestCase):
        def test_invoice_created_event(self):
            payload = {
                'invoice_id': 123,
                'customer_id': 456,
                'total_amount': 99.99,
                'currency': 'USD',
                'tenant_id': 1
            }
            self.assert_contract_valid('invoice.created', payload)
"""

from typing import Dict, Any, List
from django.test import TestCase
from .validators import validate_payload, ValidationError
from .event_contracts import get_all_contracts


def validate_event_payload(event_name: str, payload: Dict[str, Any],
                           raise_on_error: bool = True) -> List[str]:
    """
    Validate an event payload against its contract.

    Args:
        event_name: Name of the event (e.g., 'invoice.created')
        payload: The payload to validate
        raise_on_error: Whether to raise exception on validation failure

    Returns:
        List of validation errors (empty if valid)

    Raises:
        ValidationError: If raise_on_error=True and validation fails
        KeyError: If contract not found

    Example:
        errors = validate_event_payload('invoice.created', {
            'invoice_id': 123,
            'total_amount': 99.99,
            'currency': 'USD',
            'tenant_id': 1
        })
    """
    contracts = get_all_contracts()

    if event_name not in contracts:
        raise KeyError(f"Contract not found: {event_name}")

    contract = contracts[event_name]
    schema = contract.get('schema', {})

    try:
        validate_payload(payload, {'schema': schema}, raise_on_error=raise_on_error)
        return []
    except ValidationError as e:
        if raise_on_error:
            raise
        return [str(e)]


class ContractTestCase(TestCase):
    """
    Base test case class with contract validation helpers.

    Example:
        class InvoiceTests(ContractTestCase):
            def test_create_invoice_emits_event(self):
                invoice = Invoice.objects.create(...)

                # Verify event was emitted
                self.assert_event_emitted('invoice.created')

                # Verify payload is valid
                payload = self.get_emitted_event_payload('invoice.created')
                self.assert_contract_valid('invoice.created', payload)
    """

    def assert_contract_valid(self, event_name: str, payload: Dict[str, Any]):
        """Assert that a payload is valid for a given contract"""
        errors = validate_event_payload(event_name, payload, raise_on_error=False)
        self.assertEqual(
            [], errors,
            f"Contract validation failed for {event_name}: {errors}"
        )

    def assert_contract_invalid(self, event_name: str, payload: Dict[str, Any]):
        """Assert that a payload is INVALID for a given contract"""
        errors = validate_event_payload(event_name, payload, raise_on_error=False)
        self.assertNotEqual(
            [], errors,
            f"Expected contract validation to fail for {event_name}"
        )

    def get_contract_schema(self, event_name: str) -> Dict[str, Any]:
        """Get the schema for a contract"""
        contracts = get_all_contracts()
        if event_name not in contracts:
            raise KeyError(f"Contract not found: {event_name}")
        return contracts[event_name].get('schema', {})

    def get_contract_required_fields(self, event_name: str) -> List[str]:
        """Get list of required fields for a contract"""
        schema = self.get_contract_schema(event_name)
        return schema.get('required', [])


def generate_example_payload(event_name: str) -> Dict[str, Any]:
    """
    Generate an example payload for an event contract.

    Useful for testing and documentation.

    Args:
        event_name: Name of the event

    Returns:
        Example payload dictionary

    Example:
        payload = generate_example_payload('invoice.created')
        # Returns: {'invoice_id': 1, 'total_amount': 100.0, ...}
    """
    contracts = get_all_contracts()

    if event_name not in contracts:
        raise KeyError(f"Contract not found: {event_name}")

    contract = contracts[event_name]
    schema = contract.get('schema', {})
    properties = schema.get('properties', {})
    required = schema.get('required', [])

    payload = {}

    for field_name in required:
        field_schema = properties.get(field_name, {})
        payload[field_name] = _generate_example_value(field_schema)

    return payload


def _generate_example_value(field_schema: Dict[str, Any]) -> Any:
    """Generate example value based on field schema"""
    field_type = field_schema.get('type', 'string')

    if 'enum' in field_schema:
        return field_schema['enum'][0]

    if field_type == 'integer':
        return 1
    elif field_type == 'number':
        return 100.0
    elif field_type == 'boolean':
        return True
    elif field_type == 'array':
        return []
    elif field_type == 'object':
        return {}
    else:  # string
        if field_schema.get('format') == 'date':
            return '2026-03-04'
        elif field_schema.get('format') == 'date-time':
            return '2026-03-04T10:30:00Z'
        elif field_schema.get('format') == 'email':
            return 'user@example.com'
        else:
            return 'value'


def verify_all_events_have_contracts() -> List[str]:
    """
    Verify that all events emitted in the codebase have contracts.

    Returns:
        List of event names that are missing contracts

    Usage in tests:
        def test_all_events_have_contracts(self):
            missing = verify_all_events_have_contracts()
            self.assertEqual([], missing, f"Missing contracts: {missing}")
    """
    # This would require scanning the codebase for emit_event() calls
    # and comparing against registered contracts
    # Implementation depends on project structure
    pass


def verify_all_handlers_match_contracts() -> List[str]:
    """
    Verify that all event handlers consume events with valid contracts.

    Returns:
        List of inconsistencies found
    """
    # This would require scanning event handler registrations
    # and verifying they match registered contracts
    pass
