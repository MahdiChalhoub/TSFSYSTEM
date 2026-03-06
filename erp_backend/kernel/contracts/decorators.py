"""
Contract Decorators

Decorators for enforcing contracts on functions and event handlers.
"""

from functools import wraps
from .registry import ContractRegistry
from .validators import validate_payload, ValidationError
import logging

logger = logging.getLogger(__name__)


def enforce_contract(contract_name: str, version: str = None):
    """
    Decorator to enforce contract on event handler or function.

    Args:
        contract_name: Name of contract to enforce
        version: Specific version (optional)

    Example:
        @enforce_contract('invoice.created')
        def handle_invoice_created(event):
            # event.payload is guaranteed to match contract
            invoice_id = event.payload['invoice_id']
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Get contract
            contract = ContractRegistry.get(contract_name, version)

            if not contract:
                logger.warning(f"Contract not found: {contract_name}, skipping validation")
                return func(*args, **kwargs)

            # Find payload in args
            payload = None

            # Check if first arg is event object
            if args and hasattr(args[0], 'payload'):
                payload = args[0].payload
            # Check if first arg is dict
            elif args and isinstance(args[0], dict):
                payload = args[0]
            # Check kwargs
            elif 'payload' in kwargs:
                payload = kwargs['payload']

            if payload is None:
                logger.warning(f"Could not find payload to validate for contract {contract_name}")
                return func(*args, **kwargs)

            # Validate payload
            try:
                validate_payload(payload, contract, raise_on_error=True)
            except ValidationError as e:
                logger.error(f"Contract validation failed for {contract_name}: {str(e)}")
                raise

            return func(*args, **kwargs)

        return wrapper
    return decorator


def produces_contract(contract_name: str, module_name: str = None):
    """
    Decorator to mark function as contract producer.

    Registers module as producer of this contract.

    Example:
        @produces_contract('invoice.created', module_name='finance')
        def create_invoice(...):
            ...
            emit_event('invoice.created', payload)
    """
    def decorator(func):
        # Register usage
        if module_name:
            ContractRegistry.register_usage(
                contract_name=contract_name,
                module_name=module_name,
                usage_type='PRODUCER'
            )

        return func
    return decorator


def consumes_contract(contract_name: str, module_name: str = None):
    """
    Decorator to mark function as contract consumer.

    Registers module as consumer of this contract.

    Example:
        @consumes_contract('invoice.created', module_name='inventory')
        @subscribe_to_event('invoice.created')
        def handle_invoice_created(event):
            ...
    """
    def decorator(func):
        # Register usage
        if module_name:
            ContractRegistry.register_usage(
                contract_name=contract_name,
                module_name=module_name,
                usage_type='CONSUMER'
            )

        # Also enforce contract
        return enforce_contract(contract_name)(func)

    return decorator
