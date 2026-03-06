"""
Contracts Registry — interface definitions between modules.

Import guide:
    from kernel.contracts import define_contract, validate_payload
    from kernel.contracts.models import Contract, ContractVersion  # if model access needed
"""

# NOTE: Contract/ContractVersion are concrete models — NOT imported here.
# Import from kernel.contracts.models directly to avoid AppRegistryNotReady.

from .registry import ContractRegistry, define_contract, get_contract  # noqa: F401
from .validators import validate_payload, ValidationError  # noqa: F401
from .decorators import enforce_contract  # noqa: F401

__all__ = [
    'ContractRegistry',
    'define_contract',
    'get_contract',
    'validate_payload',
    'ValidationError',
    'enforce_contract',
]
