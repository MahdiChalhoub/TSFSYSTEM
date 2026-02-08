"""
Management Command: register_contracts
=======================================
Registers ModuleContract records for all business modules.
Idempotent — safe to re-run. Creates or updates contracts.

Usage:
    python manage.py register_contracts
    python manage.py register_contracts --verbose
"""

from django.core.management.base import BaseCommand
from erp.models import SystemModule
from erp.connector_models import ModuleContract


# ─── Contract Definitions ──────────────────────────────────────────────
# Each module declares:
#   provides  - events emitted, read/write endpoints, functions exposed
#   needs     - events subscribed to, data dependencies
#   rules     - graceful degradation behavior
# ────────────────────────────────────────────────────────────────────────

MODULE_CONTRACTS = {
    'finance': {
        'provides': {
            'read_endpoints': [
                'chart-of-accounts/',
                'fiscal-years/',
                'fiscal-periods/',
                'financial-accounts/',
                'journal-entries/',
                'transactions/',
                'loans/',
                'barcode-settings/',
            ],
            'write_endpoints': [
                'journal-entries/create/',
                'transactions/create/',
                'loans/create/',
            ],
            'events_emitted': [
                'journal:posted',
                'payment:received',
                'fiscal_year:closed',
            ],
            'functions_exposed': [
                'post_journal_entry',
                'get_account_balance',
                'generate_barcode',
            ],
        },
        'needs': {
            'events_from': [
                {'module': 'kernel', 'event': 'org:provisioned'},
                {'module': 'crm', 'event': 'contact:created'},
                {'module': 'pos', 'event': 'order:completed'},
                {'module': 'inventory', 'event': 'inventory:adjusted'},
                {'module': 'kernel', 'event': 'subscription:renewed'},
            ],
            'data_from': [
                {'module': 'inventory', 'endpoint': 'products/', 'blocking': False},
                {'module': 'crm', 'endpoint': 'contacts/', 'blocking': False},
            ],
        },
        'rules': {
            'can_work_without': ['crm', 'hr', 'pos'],
            'buffer_writes_to': [],
            'critical_dependencies': ['core'],
        },
    },

    'crm': {
        'provides': {
            'read_endpoints': [
                'contacts/',
                'contacts/search/',
            ],
            'write_endpoints': [
                'contacts/create/',
                'contacts/update/',
            ],
            'events_emitted': [
                'contact:created',
                'contact:updated',
            ],
            'functions_exposed': [
                'get_contact_by_id',
                'search_contacts',
            ],
        },
        'needs': {
            'events_from': [
                {'module': 'kernel', 'event': 'org:provisioned'},
            ],
            'data_from': [],
        },
        'rules': {
            'can_work_without': ['finance', 'inventory', 'hr', 'pos'],
            'buffer_writes_to': [],
            'critical_dependencies': ['core'],
        },
    },

    'inventory': {
        'provides': {
            'read_endpoints': [
                'products/',
                'products/search/',
                'categories/',
                'warehouses/',
                'stock-levels/',
            ],
            'write_endpoints': [
                'products/create/',
                'stock/adjust/',
                'stock/transfer/',
            ],
            'events_emitted': [
                'stock:updated',
                'inventory:adjusted',
                'inventory:low_stock',
            ],
            'functions_exposed': [
                'get_product_cost',
                'get_stock_level',
                'validate_sku',
            ],
        },
        'needs': {
            'events_from': [
                {'module': 'pos', 'event': 'order:completed'},
                {'module': 'pos', 'event': 'order:voided'},
                {'module': 'kernel', 'event': 'org:provisioned'},
            ],
            'data_from': [],
        },
        'rules': {
            'can_work_without': ['crm', 'hr'],
            'buffer_writes_to': ['finance'],
            'critical_dependencies': ['core'],
        },
    },

    'hr': {
        'provides': {
            'read_endpoints': [
                'employees/',
                'departments/',
            ],
            'write_endpoints': [
                'employees/create/',
                'payroll/process/',
            ],
            'events_emitted': [
                'payroll:processed',
                'payroll:journal_needed',
            ],
            'functions_exposed': [
                'get_employee_by_user',
            ],
        },
        'needs': {
            'events_from': [
                {'module': 'kernel', 'event': 'org:provisioned'},
                {'module': 'hr', 'event': 'payroll:processed'},
            ],
            'data_from': [
                {'module': 'finance', 'endpoint': 'chart-of-accounts/', 'blocking': False},
            ],
        },
        'rules': {
            'can_work_without': ['crm', 'pos', 'inventory'],
            'buffer_writes_to': ['finance'],
            'critical_dependencies': ['core'],
        },
    },

    'pos': {
        'provides': {
            'read_endpoints': [
                'orders/',
                'order-lines/',
            ],
            'write_endpoints': [
                'orders/create/',
                'checkout/',
            ],
            'events_emitted': [
                'order:completed',
                'order:voided',
            ],
            'functions_exposed': [
                'get_order_by_id',
            ],
        },
        'needs': {
            'events_from': [
                {'module': 'finance', 'event': 'payment:received'},
                {'module': 'inventory', 'event': 'inventory:low_stock'},
            ],
            'data_from': [
                {'module': 'inventory', 'endpoint': 'products/', 'blocking': True},
                {'module': 'crm', 'endpoint': 'contacts/', 'blocking': False},
            ],
        },
        'rules': {
            'can_work_without': ['crm', 'hr'],
            'buffer_writes_to': ['finance', 'inventory'],
            'critical_dependencies': ['core', 'inventory'],
        },
    },
}


class Command(BaseCommand):
    help = 'Register ModuleContract records for all business modules'

    def add_arguments(self, parser):
        parser.add_argument(
            '--verbose', action='store_true',
            help='Print detailed contract info for each module'
        )

    def handle(self, *args, **options):
        verbose = options.get('verbose', False)
        created_count = 0
        updated_count = 0
        skipped_count = 0

        self.stdout.write(self.style.MIGRATE_HEADING(
            'Registering Module Contracts...'
        ))

        for module_name, contract_data in MODULE_CONTRACTS.items():
            try:
                # Find the SystemModule record
                sys_module = SystemModule.objects.filter(name=module_name).first()
                if not sys_module:
                    self.stdout.write(self.style.WARNING(
                        f'  ⚠ {module_name}: SystemModule not found — skipping'
                    ))
                    skipped_count += 1
                    continue

                # Create or update the contract
                contract, created = ModuleContract.objects.update_or_create(
                    module=sys_module,
                    defaults={
                        'provides': contract_data['provides'],
                        'needs': contract_data['needs'],
                        'rules': contract_data['rules'],
                        'version': sys_module.version,
                    }
                )

                if created:
                    created_count += 1
                    self.stdout.write(self.style.SUCCESS(
                        f'  ✅ {module_name}: Contract CREATED'
                    ))
                else:
                    updated_count += 1
                    self.stdout.write(self.style.SUCCESS(
                        f'  🔄 {module_name}: Contract UPDATED'
                    ))

                if verbose:
                    events_in = [e['event'] for e in contract_data['needs'].get('events_from', [])]
                    events_out = contract_data['provides'].get('events_emitted', [])
                    self.stdout.write(f'     Subscribes to: {", ".join(events_in)}')
                    self.stdout.write(f'     Emits:         {", ".join(events_out)}')

            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'  ❌ {module_name}: {e}'
                ))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Done: {created_count} created, {updated_count} updated, {skipped_count} skipped'
        ))
        total = ModuleContract.objects.count()
        self.stdout.write(f'Total contracts in DB: {total}')
