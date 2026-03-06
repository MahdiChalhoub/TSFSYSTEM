"""
Migration Validator Service
===========================
Pre-flight validation to ensure organization is ready for migration.

Validates:
1. COA exists and has minimum required accounts
2. Posting rules are fully configured
3. Customer/Supplier root accounts exist in COA
4. All required accounts are properly set up
"""
import logging
from typing import Dict, List, Tuple
from erp.services import ConfigurationService
from apps.finance.models import ChartOfAccount

logger = logging.getLogger(__name__)


class MigrationValidatorService:
    """
    Validates that an organization meets all prerequisites for migration.

    Following TSFSYSTEM architecture:
    - Uses ConfigurationService.get_posting_rules() (no hardcoding)
    - Returns structured validation results
    - No side effects (read-only validation)
    """

    @staticmethod
    def validate_prerequisites(organization) -> Dict:
        """
        Validates that organization is ready for migration.

        Returns:
            {
                'is_valid': bool,
                'errors': [{'code': str, 'message': str, 'action_url': str}],
                'warnings': [{'code': str, 'message': str}],
                'coa_summary': {...},
                'posting_rules_summary': {...}
            }
        """
        errors = []
        warnings = []

        # Validation 1: Check COA exists
        coa_validation = MigrationValidatorService._validate_coa(organization)
        if not coa_validation['is_valid']:
            errors.extend(coa_validation['errors'])
        else:
            warnings.extend(coa_validation.get('warnings', []))

        # Validation 2: Check posting rules
        rules_validation = MigrationValidatorService._validate_posting_rules(organization)
        if not rules_validation['is_valid']:
            errors.extend(rules_validation['errors'])
        else:
            warnings.extend(rules_validation.get('warnings', []))

        # Validation 3: Verify automation root accounts exist
        if rules_validation['is_valid']:
            roots_validation = MigrationValidatorService._validate_automation_roots(
                organization,
                rules_validation['posting_rules']
            )
            if not roots_validation['is_valid']:
                errors.extend(roots_validation['errors'])

        is_valid = len(errors) == 0

        return {
            'is_valid': is_valid,
            'errors': errors,
            'warnings': warnings,
            'coa_summary': coa_validation.get('summary', {}),
            'posting_rules_summary': rules_validation.get('summary', {}),
        }

    @staticmethod
    def _validate_coa(organization) -> Dict:
        """Validate Chart of Accounts exists and is adequate."""
        coa_count = ChartOfAccount.objects.filter(organization=organization).count()

        if coa_count < 10:
            return {
                'is_valid': False,
                'errors': [{
                    'code': 'NO_COA',
                    'message': f'Chart of Accounts not configured. Found only {coa_count} accounts. '
                               f'Please import a COA template first (minimum 10 accounts required).',
                    'action_url': '/finance/settings/coa',
                    'action_label': 'Import COA Template'
                }]
            }

        # Get COA structure summary
        root_accounts = ChartOfAccount.objects.filter(
            organization=organization,
            parent__isnull=True
        ).count()

        total_assets = ChartOfAccount.objects.filter(
            organization=organization,
            type='ASSET'
        ).count()

        total_liabilities = ChartOfAccount.objects.filter(
            organization=organization,
            type='LIABILITY'
        ).count()

        warnings = []
        if total_assets < 3:
            warnings.append({
                'code': 'FEW_ASSETS',
                'message': f'Only {total_assets} asset accounts found. Consider importing a full COA template.'
            })

        if total_liabilities < 2:
            warnings.append({
                'code': 'FEW_LIABILITIES',
                'message': f'Only {total_liabilities} liability accounts found.'
            })

        return {
            'is_valid': True,
            'warnings': warnings,
            'summary': {
                'total_accounts': coa_count,
                'root_accounts': root_accounts,
                'asset_accounts': total_assets,
                'liability_accounts': total_liabilities,
            }
        }

    @staticmethod
    def _validate_posting_rules(organization) -> Dict:
        """Validate posting rules are fully configured."""
        rules = ConfigurationService.get_posting_rules(organization)

        required_rules = [
            ('automation', 'customerRoot', 'Customer Auto-Creation Parent Account', True),
            ('automation', 'supplierRoot', 'Supplier Auto-Creation Parent Account', True),
            ('sales', 'receivable', 'Accounts Receivable', True),
            ('sales', 'revenue', 'Sales Revenue', True),
            ('sales', 'cogs', 'Cost of Goods Sold', True),
            ('sales', 'inventory', 'Inventory Asset', True),
            ('purchases', 'payable', 'Accounts Payable', True),
            ('purchases', 'inventory', 'Purchase Inventory Account', True),
            ('purchases', 'tax', 'Input Tax/VAT Recoverable', False),  # Optional for some businesses
        ]

        missing_rules = []
        configured_rules = []

        for section, key, label, is_required in required_rules:
            value = rules.get(section, {}).get(key)

            if not value:
                if is_required:
                    missing_rules.append(label)
            else:
                # Verify account exists
                account = ChartOfAccount.objects.filter(
                    id=value,
                    organization=organization
                ).first()

                if account:
                    configured_rules.append({
                        'label': label,
                        'account_code': account.code,
                        'account_name': account.name,
                        'account_id': account.id
                    })
                else:
                    missing_rules.append(f"{label} (configured but account not found)")

        if missing_rules:
            return {
                'is_valid': False,
                'errors': [{
                    'code': 'INCOMPLETE_POSTING_RULES',
                    'message': f'Posting rules incomplete. Missing: {", ".join(missing_rules)}',
                    'action_url': '/finance/settings/posting-rules',
                    'action_label': 'Configure Posting Rules',
                    'missing_rules': missing_rules
                }],
                'posting_rules': rules
            }

        return {
            'is_valid': True,
            'summary': {
                'configured_rules': configured_rules,
                'total_configured': len(configured_rules)
            },
            'posting_rules': rules
        }

    @staticmethod
    def _validate_automation_roots(organization, posting_rules: Dict) -> Dict:
        """Verify that customerRoot and supplierRoot accounts exist and are valid."""
        errors = []

        customer_root_id = posting_rules.get('automation', {}).get('customerRoot')
        supplier_root_id = posting_rules.get('automation', {}).get('supplierRoot')

        # Validate Customer Root
        if customer_root_id:
            customer_root = ChartOfAccount.objects.filter(
                id=customer_root_id,
                organization=organization
            ).first()

            if not customer_root:
                errors.append({
                    'code': 'INVALID_CUSTOMER_ROOT',
                    'message': f'Customer root account (ID: {customer_root_id}) not found in COA. '
                               f'Please reconfigure posting rules.',
                    'action_url': '/finance/settings/posting-rules'
                })
            elif customer_root.type != 'ASSET':
                errors.append({
                    'code': 'INVALID_CUSTOMER_ROOT_TYPE',
                    'message': f'Customer root account "{customer_root.code} - {customer_root.name}" '
                               f'must be type ASSET (current: {customer_root.type}). '
                               f'Receivables are assets.',
                    'action_url': '/finance/settings/posting-rules'
                })

        # Validate Supplier Root
        if supplier_root_id:
            supplier_root = ChartOfAccount.objects.filter(
                id=supplier_root_id,
                organization=organization
            ).first()

            if not supplier_root:
                errors.append({
                    'code': 'INVALID_SUPPLIER_ROOT',
                    'message': f'Supplier root account (ID: {supplier_root_id}) not found in COA. '
                               f'Please reconfigure posting rules.',
                    'action_url': '/finance/settings/posting-rules'
                })
            elif supplier_root.type != 'LIABILITY':
                errors.append({
                    'code': 'INVALID_SUPPLIER_ROOT_TYPE',
                    'message': f'Supplier root account "{supplier_root.code} - {supplier_root.name}" '
                               f'must be type LIABILITY (current: {supplier_root.type}). '
                               f'Payables are liabilities.',
                    'action_url': '/finance/settings/posting-rules'
                })

        return {
            'is_valid': len(errors) == 0,
            'errors': errors
        }
