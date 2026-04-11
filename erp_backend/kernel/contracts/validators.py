"""
Contract Validators

Validate data against contract schemas.
"""

from typing import Dict, Any, List
import re


class ValidationError(Exception):
    """Raised when data doesn't match contract schema."""
    pass


class ContractValidator:
    """
    Validates data against JSON Schema-like contracts.

    Supports:
    - Type validation (string, integer, number, boolean, object, array)
    - Required fields
    - Pattern matching (regex)
    - Min/max values
    - Nested objects
    """

    @classmethod
    def validate(cls, data: Any, schema: Dict[str, Any]) -> List[str]:
        """
        Validate data against schema.

        Args:
            data: Data to validate
            schema: JSON Schema definition

        Returns:
            List of error messages (empty if valid)

        Example:
            schema = {
                'type': 'object',
                'properties': {
                    'invoice_id': {'type': 'integer'},
                    'total': {'type': 'string', 'pattern': r'^\d+\.\d{2}$'},
                },
                'required': ['invoice_id', 'total']
            }

            errors = ContractValidator.validate(data, schema)
            if errors:
                raise ValidationError(', '.join(errors))
        """
        errors = []

        # Validate type
        expected_type = schema.get('type')
        if expected_type:
            type_error = cls._validate_type(data, expected_type)
            if type_error:
                errors.append(type_error)
                return errors  # If type is wrong, other validations will fail

        # Validate based on type
        if expected_type == 'object':
            errors.extend(cls._validate_object(data, schema))
        elif expected_type == 'array':
            errors.extend(cls._validate_array(data, schema))
        elif expected_type == 'string':
            errors.extend(cls._validate_string(data, schema))
        elif expected_type in ['integer', 'number']:
            errors.extend(cls._validate_number(data, schema))

        return errors

    @classmethod
    def _validate_type(cls, data: Any, expected_type: str) -> str:
        """Validate data type."""
        type_map = {
            'string': str,
            'integer': int,
            'number': (int, float),
            'boolean': bool,
            'object': dict,
            'array': list,
            'null': type(None)
        }

        expected_python_type = type_map.get(expected_type)
        if expected_python_type and not isinstance(data, expected_python_type):
            return f"Expected {expected_type}, got {type(data).__name__}"

        return ''

    @classmethod
    def _validate_object(cls, data: Dict, schema: Dict[str, Any]) -> List[str]:
        """Validate object (dict)."""
        errors = []

        properties = schema.get('properties', {})
        required = schema.get('required', [])

        # Check required fields
        for field in required:
            if field not in data:
                errors.append(f"Missing required field: {field}")

        # Validate each property
        for field, field_schema in properties.items():
            if field in data:
                field_errors = cls.validate(data[field], field_schema)
                for error in field_errors:
                    errors.append(f"{field}: {error}")

        # Check for additional properties
        if not schema.get('additionalProperties', True):
            for field in data.keys():
                if field not in properties:
                    errors.append(f"Unexpected field: {field}")

        return errors

    @classmethod
    def _validate_array(cls, data: List, schema: Dict[str, Any]) -> List[str]:
        """Validate array (list)."""
        errors = []

        # Validate min/max items
        min_items = schema.get('minItems')
        if min_items is not None and len(data) < min_items:
            errors.append(f"Array too short: expected at least {min_items} items, got {len(data)}")

        max_items = schema.get('maxItems')
        if max_items is not None and len(data) > max_items:
            errors.append(f"Array too long: expected at most {max_items} items, got {len(data)}")

        # Validate items
        items_schema = schema.get('items')
        if items_schema:
            for i, item in enumerate(data):
                item_errors = cls.validate(item, items_schema)
                for error in item_errors:
                    errors.append(f"[{i}]: {error}")

        return errors

    @classmethod
    def _validate_string(cls, data: str, schema: Dict[str, Any]) -> List[str]:
        """Validate string."""
        errors = []

        # Validate pattern
        pattern = schema.get('pattern')
        if pattern and not re.match(pattern, data):
            errors.append(f"String does not match pattern: {pattern}")

        # Validate length
        min_length = schema.get('minLength')
        if min_length is not None and len(data) < min_length:
            errors.append(f"String too short: expected at least {min_length} chars, got {len(data)}")

        max_length = schema.get('maxLength')
        if max_length is not None and len(data) > max_length:
            errors.append(f"String too long: expected at most {max_length} chars, got {len(data)}")

        # Validate enum
        enum = schema.get('enum')
        if enum and data not in enum:
            errors.append(f"Invalid value: expected one of {enum}, got {data}")

        return errors

    @classmethod
    def _validate_number(cls, data: (int, float), schema: Dict[str, Any]) -> List[str]:
        """Validate number (integer or float)."""
        errors = []

        # Validate minimum
        minimum = schema.get('minimum')
        if minimum is not None and data < minimum:
            errors.append(f"Number too small: expected >= {minimum}, got {data}")

        # Validate maximum
        maximum = schema.get('maximum')
        if maximum is not None and data > maximum:
            errors.append(f"Number too large: expected <= {maximum}, got {data}")

        return errors


# Module-level convenience function

def validate_payload(data: Any, contract: Dict[str, Any], raise_on_error: bool = True):
    """
    Validate data against contract schema.

    Args:
        data: Data to validate
        contract: Contract dict (must have 'schema' key)
        raise_on_error: Raise ValidationError if validation fails

    Returns:
        None if valid

    Raises:
        ValidationError if invalid and raise_on_error=True

    Example:
        from kernel.contracts import get_contract, validate_payload

        contract = get_contract('invoice.created')
        validate_payload(payload, contract)  # Raises ValidationError if invalid
    """
    schema = contract.get('schema', contract)  # Support both formats

    errors = ContractValidator.validate(data, schema)

    if errors:
        error_msg = f"Contract validation failed: {'; '.join(errors)}"
        if raise_on_error:
            raise ValidationError(error_msg)
        return errors

    return None
