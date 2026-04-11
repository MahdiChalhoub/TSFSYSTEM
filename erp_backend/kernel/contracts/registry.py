"""
Contract Registry

Central registry for all contracts in the system.
"""

from typing import Dict, Any, Optional, List
from .models import Contract, ContractVersion, ContractUsage
import logging

logger = logging.getLogger(__name__)


class ContractRegistry:
    """
    Contract Registry - manages all interface definitions.

    Provides:
    - Contract registration
    - Schema validation
    - Version compatibility checking
    - Usage tracking
    """

    # In-memory cache of contracts
    _contracts: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def register(
        cls,
        name: str,
        schema: Dict[str, Any],
        category: str = 'TYPE',
        owner_module: str = '',
        version: str = '1.0.0',
        description: str = '',
        changelog: str = '',
        producer: str = '',
        consumers: List[str] = None
    ) -> Contract:
        """
        Register a new contract or update existing one.

        Args:
            name: Contract name (e.g., 'invoice.created.v1')
            schema: JSON Schema definition
            category: EVENT, API, TYPE, or MODEL
            owner_module: Module that owns this contract
            version: Semantic version (1.0.0)
            description: What this contract is for
            changelog: What changed in this version

        Returns:
            Contract instance

        Example:
            ContractRegistry.register(
                name='invoice.created',
                schema={
                    'type': 'object',
                    'properties': {
                        'invoice_id': {'type': 'integer'},
                        'total': {'type': 'string'},  # Decimal as string
                        'currency': {'type': 'string'},
                    },
                    'required': ['invoice_id', 'total', 'currency']
                },
                category='EVENT',
                owner_module='finance',
                version='1.0.0',
                description='Emitted when invoice is created'
            )
        """
        # Get or create contract
        contract, created = Contract.objects.get_or_create(
            name=name,
            defaults={
                'category': category,
                'owner_module': owner_module,
                'description': description,
                'current_version': version
            }
        )

        if not created:
            # Update existing contract
            contract.current_version = version
            contract.description = description or contract.description
            contract.save()

        # Create version
        contract_version, version_created = ContractVersion.objects.get_or_create(
            contract=contract,
            version=version,
            defaults={
                'schema': schema,
                'changelog': changelog
            }
        )

        if not version_created:
            # Update schema if changed
            if contract_version.schema != schema:
                contract_version.schema = schema
                contract_version.changelog = changelog
                contract_version.save()

        # Cache contract
        cls._contracts[name] = {
            'schema': schema,
            'version': version,
            'category': category,
            'owner_module': owner_module
        }

        logger.info(f"Contract registered: {name} v{version}")

        return contract

    @classmethod
    def get(cls, name: str, version: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get contract definition.

        Args:
            name: Contract name
            version: Specific version (if None, returns latest)

        Returns:
            Contract schema or None
        """
        # Try cache first
        if version is None and name in cls._contracts:
            return cls._contracts[name]

        # Query database
        try:
            contract = Contract.objects.get(name=name)

            if version:
                contract_version = ContractVersion.objects.get(
                    contract=contract,
                    version=version
                )
            else:
                # Get latest version
                contract_version = contract.versions.first()

            if contract_version:
                return {
                    'schema': contract_version.schema,
                    'version': contract_version.version,
                    'category': contract.category,
                    'owner_module': contract.owner_module
                }

        except (Contract.DoesNotExist, ContractVersion.DoesNotExist):
            logger.warning(f"Contract not found: {name} v{version}")
            return None

    @classmethod
    def register_usage(
        cls,
        contract_name: str,
        module_name: str,
        usage_type: str = 'CONSUMER',
        required_version: str = '1.0.0',
        notes: str = ''
    ):
        """
        Register that a module uses a contract.

        Args:
            contract_name: Contract name
            module_name: Module using the contract
            usage_type: PRODUCER, CONSUMER, or BOTH
            required_version: Minimum version required
            notes: Additional notes
        """
        try:
            contract = Contract.objects.get(name=contract_name)

            usage, created = ContractUsage.objects.get_or_create(
                contract=contract,
                module_name=module_name,
                defaults={
                    'usage_type': usage_type,
                    'required_version': required_version,
                    'notes': notes
                }
            )

            if created:
                logger.info(f"Contract usage registered: {module_name} uses {contract_name}")

        except Contract.DoesNotExist:
            logger.error(f"Cannot register usage for non-existent contract: {contract_name}")

    @classmethod
    def get_consumers(cls, contract_name: str) -> List[str]:
        """
        Get list of modules that consume this contract.

        Args:
            contract_name: Contract name

        Returns:
            List of module names
        """
        try:
            contract = Contract.objects.get(name=contract_name)
            usages = ContractUsage.objects.filter(
                contract=contract,
                usage_type__in=['CONSUMER', 'BOTH']
            )
            return [usage.module_name for usage in usages]
        except Contract.DoesNotExist:
            return []

    @classmethod
    def get_producers(cls, contract_name: str) -> List[str]:
        """
        Get list of modules that produce this contract.

        Args:
            contract_name: Contract name

        Returns:
            List of module names
        """
        try:
            contract = Contract.objects.get(name=contract_name)
            usages = ContractUsage.objects.filter(
                contract=contract,
                usage_type__in=['PRODUCER', 'BOTH']
            )
            return [usage.module_name for usage in usages]
        except Contract.DoesNotExist:
            return []

    @classmethod
    def check_compatibility(
        cls,
        contract_name: str,
        old_version: str,
        new_version: str
    ) -> Dict[str, Any]:
        """
        Check if version change is backward compatible.

        Args:
            contract_name: Contract name
            old_version: Old version
            new_version: New version

        Returns:
            Dict with compatibility info
        """
        try:
            contract = Contract.objects.get(name=contract_name)

            old_contract = ContractVersion.objects.get(
                contract=contract,
                version=old_version
            )
            new_contract = ContractVersion.objects.get(
                contract=contract,
                version=new_version
            )

            # Check if marked as breaking change
            if new_contract.is_breaking_change:
                return {
                    'compatible': False,
                    'reason': 'Marked as breaking change',
                    'affected_modules': cls.get_consumers(contract_name)
                }

            # TODO: Implement schema comparison logic
            # For now, assume compatible if not marked as breaking
            return {
                'compatible': True,
                'reason': 'No breaking changes detected',
                'affected_modules': []
            }

        except (Contract.DoesNotExist, ContractVersion.DoesNotExist):
            return {
                'compatible': False,
                'reason': 'Contract or version not found',
                'affected_modules': []
            }

    @classmethod
    def load_all_contracts(cls):
        """
        Load all contracts into memory cache.

        Called at application startup.
        """
        contracts = Contract.objects.prefetch_related('versions').all()

        for contract in contracts:
            latest_version = contract.versions.first()
            if latest_version:
                cls._contracts[contract.name] = {
                    'schema': latest_version.schema,
                    'version': latest_version.version,
                    'category': contract.category,
                    'owner_module': contract.owner_module
                }

        logger.info(f"Loaded {len(cls._contracts)} contracts into cache")


# Module-level convenience functions

def define_contract(
    name: str,
    schema: Dict[str, Any],
    category: str = 'TYPE',
    owner_module: str = '',
    version: str = '1.0.0',
    description: str = ''
) -> Contract:
    """
    Define a contract (convenience wrapper).

    Example:
        from kernel.contracts import define_contract

        InvoiceCreated = define_contract(
            name='invoice.created',
            schema={
                'type': 'object',
                'properties': {
                    'invoice_id': {'type': 'integer'},
                    'total': {'type': 'string'},
                },
                'required': ['invoice_id', 'total']
            },
            category='EVENT',
            owner_module='finance',
            description='Emitted when invoice is created'
        )
    """
    return ContractRegistry.register(
        name=name,
        schema=schema,
        category=category,
        owner_module=owner_module,
        version=version,
        description=description
    )


def get_contract(name: str, version: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Get contract definition (convenience wrapper).

    Example:
        from kernel.contracts import get_contract

        contract = get_contract('invoice.created')
        schema = contract['schema']
    """
    return ContractRegistry.get(name, version)
