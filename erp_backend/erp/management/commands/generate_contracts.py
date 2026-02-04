"""
Management command to auto-generate Module Contracts.
Scans all SystemModules and creates contract records defining:
- What each module provides (endpoints, events)
- What each module needs from others (dependencies)

Run with: python manage.py generate_contracts
"""

from django.core.management.base import BaseCommand
from erp.models import SystemModule
from erp.connector_models import ModuleContract

# =============================================================================
# MODULE CONTRACT DEFINITIONS
# =============================================================================

# These define what each module provides and needs
# Based on actual codebase analysis

MODULE_CONTRACTS = {
    # =========================================================================
    # CORE - The foundation everything depends on
    # =========================================================================
    'core': {
        'provides': {
            'read_endpoints': [
                'organizations/',
                'users/',
                'sites/',
                'permissions/',
                'roles/',
            ],
            'write_endpoints': [
                'organizations/create/',
                'users/create/',
                'sites/create/',
            ],
            'events_emitted': [
                'organization.created',
                'organization.updated',
                'user.created',
                'user.updated',
                'site.created',
            ],
            'functions_exposed': [
                'get_organization',
                'get_user',
                'check_permission',
            ]
        },
        'needs': {
            'data_from': [],  # Core doesn't depend on anything
            'events_from': [],
            'capabilities': []
        },
        'rules': {
            'can_work_without': [],
            'buffer_writes_to': [],
            'critical_dependencies': []  # Core IS the critical dependency
        }
    },

    # =========================================================================
    # INVENTORY - Products, Categories, Stock
    # =========================================================================
    'inventory': {
        'provides': {
            'read_endpoints': [
                'products/',
                'products/{id}/',
                'products/cost/',
                'categories/',
                'brands/',
                'units/',
                'warehouses/',
                'stock-levels/',
                'attributes/',
                'countries/',
            ],
            'write_endpoints': [
                'products/create/',
                'products/{id}/update/',
                'stock-levels/adjust/',
                'categories/create/',
                'brands/create/',
            ],
            'events_emitted': [
                'product.created',
                'product.updated',
                'stock.adjusted',
                'stock.low_alert',
                'category.created',
            ],
            'functions_exposed': [
                'get_product_cost',
                'validate_sku',
                'get_stock_level',
                'calculate_amc',  # Average Moving Cost
            ]
        },
        'needs': {
            'data_from': [
                {'module': 'finance', 'endpoint': 'accounts/', 'blocking': False},
            ],
            'events_from': [
                {'module': 'pos', 'event': 'sale.completed'},
                {'module': 'pos', 'event': 'purchase.received'},
            ],
            'capabilities': []
        },
        'rules': {
            'can_work_without': ['crm', 'hr'],
            'buffer_writes_to': ['finance'],
            'critical_dependencies': ['core']
        }
    },

    # =========================================================================
    # FINANCE - Accounting, Ledger, Reports
    # =========================================================================
    'finance': {
        'provides': {
            'read_endpoints': [
                'accounts/',
                'coa/',  # Chart of Accounts
                'fiscal-years/',
                'fiscal-periods/',
                'journal-entries/',
                'ledger/',
                'reports/trial-balance/',
                'reports/pnl/',
                'reports/balance-sheet/',
                'loans/',
            ],
            'write_endpoints': [
                'journal-entries/create/',
                'journal-entries/{id}/post/',
                'accounts/create/',
                'loans/create/',
                'transactions/create/',
            ],
            'events_emitted': [
                'journal.posted',
                'journal.voided',
                'period.closed',
                'fiscal_year.closed',
                'account.created',
            ],
            'functions_exposed': [
                'post_journal_entry',
                'get_account_balance',
                'calculate_pnl',
                'get_effective_cost',
            ]
        },
        'needs': {
            'data_from': [
                {'module': 'inventory', 'endpoint': 'products/cost/', 'blocking': False},
                {'module': 'pos', 'endpoint': 'transactions/', 'blocking': False},
            ],
            'events_from': [
                {'module': 'pos', 'event': 'sale.completed'},
                {'module': 'inventory', 'event': 'stock.adjusted'},
            ],
            'capabilities': []
        },
        'rules': {
            'can_work_without': ['crm', 'hr'],
            'buffer_writes_to': [],
            'critical_dependencies': ['core']
        }
    },

    # =========================================================================
    # POS - Point of Sale, Sales, Purchases
    # =========================================================================
    'pos': {
        'provides': {
            'read_endpoints': [
                'pos/sessions/',
                'pos/registers/',
                'sales/',
                'purchases/',
                'transactions/',
                'receipts/',
                'return-requests/',
            ],
            'write_endpoints': [
                'pos/sessions/open/',
                'pos/sessions/close/',
                'sales/create/',
                'purchases/create/',
                'transactions/create/',
                'return-requests/create/',
            ],
            'events_emitted': [
                'sale.completed',
                'sale.voided',
                'purchase.created',
                'purchase.received',
                'session.opened',
                'session.closed',
                'drawer.reconciled',
            ],
            'functions_exposed': [
                'process_sale',
                'process_return',
                'open_register',
                'close_register',
            ]
        },
        'needs': {
            'data_from': [
                {'module': 'inventory', 'endpoint': 'products/', 'blocking': True},
                {'module': 'inventory', 'endpoint': 'stock-levels/', 'blocking': True},
                {'module': 'finance', 'endpoint': 'accounts/', 'blocking': False},
                {'module': 'crm', 'endpoint': 'customers/', 'blocking': False},
            ],
            'events_from': [],
            'capabilities': ['inventory.get_stock_level', 'finance.post_journal_entry']
        },
        'rules': {
            'can_work_without': ['crm', 'hr'],
            'buffer_writes_to': ['finance'],
            'critical_dependencies': ['core', 'inventory']
        }
    },

    # =========================================================================
    # CRM - Customer Relationship Management
    # =========================================================================
    'crm': {
        'provides': {
            'read_endpoints': [
                'contacts/',
                'customers/',
                'suppliers/',
                'loyalty-programs/',
                'loyalty-points/',
            ],
            'write_endpoints': [
                'contacts/create/',
                'customers/create/',
                'suppliers/create/',
                'loyalty-points/award/',
                'loyalty-points/redeem/',
            ],
            'events_emitted': [
                'contact.created',
                'customer.created',
                'supplier.created',
                'loyalty.points_awarded',
                'loyalty.points_redeemed',
            ],
            'functions_exposed': [
                'get_customer_loyalty',
                'award_points',
                'redeem_points',
            ]
        },
        'needs': {
            'data_from': [
                {'module': 'pos', 'endpoint': 'sales/', 'blocking': False},
            ],
            'events_from': [
                {'module': 'pos', 'event': 'sale.completed'},
            ],
            'capabilities': []
        },
        'rules': {
            'can_work_without': ['finance', 'hr', 'inventory'],
            'buffer_writes_to': [],
            'critical_dependencies': ['core']
        }
    },

    # =========================================================================
    # HR - Human Resources
    # =========================================================================
    'hr': {
        'provides': {
            'read_endpoints': [
                'employees/',
                'payroll/',
                'attendance/',
                'approvals/',
                'roles/',
            ],
            'write_endpoints': [
                'employees/create/',
                'payroll/process/',
                'attendance/record/',
                'approvals/approve/',
                'approvals/reject/',
            ],
            'events_emitted': [
                'employee.created',
                'employee.terminated',
                'payroll.processed',
                'approval.granted',
                'approval.rejected',
            ],
            'functions_exposed': [
                'get_employee_access',
                'check_approval_status',
            ]
        },
        'needs': {
            'data_from': [
                {'module': 'finance', 'endpoint': 'accounts/', 'blocking': False},
            ],
            'events_from': [],
            'capabilities': ['finance.post_journal_entry']
        },
        'rules': {
            'can_work_without': ['inventory', 'pos', 'crm'],
            'buffer_writes_to': ['finance'],
            'critical_dependencies': ['core']
        }
    },
}


class Command(BaseCommand):
    help = 'Generate Module Contracts for all installed system modules'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Overwrite existing contracts',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without saving',
        )

    def handle(self, *args, **options):
        force = options.get('force', False)
        dry_run = options.get('dry_run', False)

        self.stdout.write(self.style.NOTICE('🔍 Scanning installed modules...'))

        # Get all installed system modules
        modules = SystemModule.objects.filter(status='INSTALLED')
        
        if not modules.exists():
            self.stdout.write(self.style.WARNING('⚠️ No installed modules found'))
            return

        created_count = 0
        updated_count = 0
        skipped_count = 0

        for module in modules:
            module_code = module.name.lower()
            
            # Get contract definition (or create generic one)
            if module_code in MODULE_CONTRACTS:
                contract_data = MODULE_CONTRACTS[module_code]
            else:
                # Generic contract for unknown modules
                contract_data = {
                    'provides': {
                        'read_endpoints': [],
                        'write_endpoints': [],
                        'events_emitted': [],
                        'functions_exposed': []
                    },
                    'needs': {
                        'data_from': [],
                        'events_from': [],
                        'capabilities': []
                    },
                    'rules': {
                        'can_work_without': [],
                        'buffer_writes_to': [],
                        'critical_dependencies': ['core']
                    }
                }
                self.stdout.write(
                    self.style.WARNING(f'  ⚠️ {module_code}: Using generic contract (not in definitions)')
                )

            # Check if contract exists
            existing = ModuleContract.objects.filter(module=module).first()

            if existing and not force:
                skipped_count += 1
                self.stdout.write(f'  ⏭️ {module_code}: Skipped (already exists)')
                continue

            if dry_run:
                action = 'Would update' if existing else 'Would create'
                self.stdout.write(f'  🔹 {module_code}: {action}')
                continue

            # Create or update contract
            obj, created = ModuleContract.objects.update_or_create(
                module=module,
                defaults={
                    'provides': contract_data['provides'],
                    'needs': contract_data['needs'],
                    'rules': contract_data['rules'],
                    'version': module.version or '1.0.0'
                }
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'  ✅ {module_code}: Created'))
            else:
                updated_count += 1
                self.stdout.write(self.style.SUCCESS(f'  🔄 {module_code}: Updated'))

        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(self.style.SUCCESS('📋 Contract Generation Complete'))
        self.stdout.write(f'   Created: {created_count}')
        self.stdout.write(f'   Updated: {updated_count}')
        self.stdout.write(f'   Skipped: {skipped_count}')
        self.stdout.write(self.style.SUCCESS('=' * 50))
