"""
seed_all_permissions — Enterprise Permission Catalogue
======================================================
Seeds comprehensive CRUD permissions for every entity + action-based
permissions for workflows. Standard CRUD = view, create, edit, delete.

Run: python manage.py seed_all_permissions
"""
from django.core.management.base import BaseCommand


# ═══════════════════════════════════════════════════════════════════════════════
# Helper: auto-generate CRUD for a resource
# ═══════════════════════════════════════════════════════════════════════════════

def _crud(module: str, resource: str, label: str) -> dict[str, str]:
    """Generate standard view/create/edit/delete permissions for a resource."""
    return {
        f'{module}.view_{resource}':   f'View {label}',
        f'{module}.create_{resource}': f'Create {label}',
        f'{module}.edit_{resource}':   f'Edit {label}',
        f'{module}.delete_{resource}': f'Delete {label}',
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MASTER PERMISSION CATALOGUE
# ═══════════════════════════════════════════════════════════════════════════════

PERMISSION_CATALOGUE: dict[str, dict[str, str]] = {

    # ─── POS & Sales ──────────────────────────────────────────────────────────
    'sales': {
        # CRUD: Orders
        **_crud('sales', 'orders', 'sales orders'),
        # CRUD: Quotations
        **_crud('sales', 'quotations', 'quotations'),
        # CRUD: Credit Notes
        **_crud('sales', 'credit_notes', 'credit notes'),
        # CRUD: Returns
        **_crud('sales', 'returns', 'sales returns'),
        # CRUD: Discount Rules
        **_crud('sales', 'discount_rules', 'discount rules'),
        # CRUD: Consignment
        **_crud('sales', 'consignment', 'consignment orders'),
        # CRUD: Delivery Zones
        **_crud('sales', 'delivery_zones', 'delivery zones'),
        # CRUD: Drivers
        **_crud('sales', 'drivers', 'drivers'),
        # Workflow actions
        'sales.view_dashboard':       'View sales dashboard',
        'sales.confirm_order':        'Confirm a draft order',
        'sales.cancel_order':         'Cancel an open order',
        'sales.mark_delivered':       'Record delivery on order',
        'sales.mark_paid':            'Record payment on order',
        'sales.write_off':            'Write off unpaid balance',
        'sales.generate_invoice':     'Generate customer invoice',
        'sales.apply_discount_5':     'Apply discount up to 5%',
        'sales.apply_discount_15':    'Apply discount up to 15%',
        'sales.apply_discount_any':   'Apply unlimited discount',
        'sales.view_cost_price':      'View COGS / cost price',
        'sales.override_price':       'Override unit selling price',
        'sales.view_audit_trail':     'View sales audit trail',
        'sales.manage_delivery_hub':  'Manage delivery hub',
    },

    # ─── POS Terminal ─────────────────────────────────────────────────────────
    'pos': {
        # CRUD: POS Sessions
        **_crud('pos', 'sessions', 'POS sessions'),
        # CRUD: POS Settings
        **_crud('pos', 'settings', 'POS settings'),
        # Actions
        'pos.access_terminal':        'Access POS terminal',
        'pos.process_sale':           'Process sales at POS',
        'pos.process_return':         'Process returns at POS',
        'pos.void_order':             'Void an order at POS',
        'pos.apply_loyalty':          'Apply loyalty points',
        'pos.manager_override':       'Use manager override PIN',
        'pos.view_reports':           'View POS reports',
        'pos.cash_management':        'Manage cash drawer',
        'pos.park_orders':            'Park orders for later',
        'pos.manage_tables':          'Manage table assignments',
        'pos.split_payment':          'Split payment methods',
        'pos.modify_completed':       'Modify completed orders',
    },

    # ─── Purchasing & Procurement ─────────────────────────────────────────────
    'purchases': {
        # CRUD: Purchase Orders
        **_crud('purchases', 'orders', 'purchase orders'),
        # CRUD: Purchase Invoices
        **_crud('purchases', 'invoices', 'purchase invoices'),
        # CRUD: Receipt Orders
        **_crud('purchases', 'receipts', 'receipt orders'),
        # CRUD: Purchase Returns
        **_crud('purchases', 'returns', 'purchase returns'),
        # CRUD: Credit Notes
        **_crud('purchases', 'credit_notes', 'purchase credit notes'),
        # CRUD: RFQ / Quotations
        **_crud('purchases', 'quotations', 'RFQs & quotations'),
        # CRUD: Consignments
        **_crud('purchases', 'consignments', 'purchase consignments'),
        # CRUD: Supplier Package Prices
        **_crud('purchases', 'package_prices', 'supplier package prices'),
        # Actions
        'purchases.view_dashboard':      'View procurement dashboard',
        'purchases.approve_order':       'Approve purchase orders',
        'purchases.confirm_order':       'Confirm purchase orders',
        'purchases.cancel_order':        'Cancel purchase orders',
        'purchases.receive_goods':       'Record goods receipts',
        'purchases.verify_invoice':      'Verify purchase invoices',
        'purchases.supplier_sourcing':   'Access supplier sourcing',
        'purchases.view_analytics':      'View purchase analytics',
    },

    # ─── Products & Catalog ───────────────────────────────────────────────────
    'products': {
        # CRUD: Products
        **_crud('products', 'products', 'products'),
        # CRUD: Categories
        **_crud('products', 'categories', 'categories'),
        # CRUD: Brands
        **_crud('products', 'brands', 'brands'),
        # CRUD: Units
        **_crud('products', 'units', 'units of measure'),
        # CRUD: Attributes
        **_crud('products', 'attributes', 'product attributes'),
        # CRUD: Packaging
        **_crud('products', 'packaging', 'packaging levels'),
        # CRUD: Combos & Bundles
        **_crud('products', 'combos', 'combo & bundles'),
        # CRUD: Barcodes
        **_crud('products', 'barcodes', 'barcodes'),
        # CRUD: Product Groups
        **_crud('products', 'groups', 'product groups'),
        # CRUD: Category Rules
        **_crud('products', 'category_rules', 'category rules'),
        # CRUD: Fresh Profiles
        **_crud('products', 'fresh_profiles', 'fresh profiles'),
        # CRUD: Inventory Policies
        **_crud('products', 'policies', 'inventory policies'),
        # CRUD: Labels
        **_crud('products', 'labels', 'product labels'),
        # CRUD: Price Change Requests
        **_crud('products', 'price_changes', 'price change requests'),
        # Views
        'products.view_stock_matrix':    'View stock matrix',
        'products.view_readiness':       'View product readiness',
        'products.view_countries':       'View countries',
        'products.manage_countries':     'Manage countries',
    },

    # ─── Warehousing & Inventory ──────────────────────────────────────────────
    'inventory': {
        # CRUD: Warehouses / Locations
        **_crud('inventory', 'warehouses', 'warehouses / locations'),
        # CRUD: Warehouse Zones
        **_crud('inventory', 'zones', 'warehouse zones'),
        # CRUD: Stock Transfers
        **_crud('inventory', 'transfers', 'stock transfers'),
        # CRUD: Stock Counts
        **_crud('inventory', 'stock_counts', 'stock counts'),
        # CRUD: Adjustment Orders
        **_crud('inventory', 'adjustments', 'adjustment orders'),
        # CRUD: Serial Numbers
        **_crud('inventory', 'serials', 'serial numbers'),
        # CRUD: Operational Requests
        **_crud('inventory', 'requests', 'operational requests'),
        # CRUD: Goods Receipts
        **_crud('inventory', 'goods_receipts', 'goods receipts'),
        # CRUD: Inventory Groups
        **_crud('inventory', 'groups', 'inventory groups'),
        # CRUD: Strategy Manifests (Transfer Orders)
        **_crud('inventory', 'manifests', 'strategy manifests'),
        # Views & Actions
        'inventory.view_dashboard':      'View inventory dashboard',
        'inventory.view_movements':      'View stock movements',
        'inventory.view_valuation':      'View stock valuation',
        'inventory.view_analytics':      'View inventory analytics',
        'inventory.view_expiry_alerts':  'View expiry alerts',
        'inventory.view_low_stock':      'View low-stock alerts',
        'inventory.view_intelligence':   'Access intelligence hub',
        'inventory.view_explorer':       'Access product explorer',
        'inventory.view_price_governance': 'View price governance',
        'inventory.view_audit_trail':    'View product audit trail',
        'inventory.view_data_quality':   'Run data quality audit',
    },

    # ─── Finance & Accounting ─────────────────────────────────────────────────
    'finance': {
        # CRUD: Chart of Accounts
        **_crud('finance', 'coa', 'chart of accounts'),
        # CRUD: Journal Entries
        **_crud('finance', 'journal_entries', 'journal entries'),
        # CRUD: Vouchers
        **_crud('finance', 'vouchers', 'vouchers'),
        # CRUD: Invoices
        **_crud('finance', 'invoices', 'invoices'),
        # CRUD: Payments & Receipts
        **_crud('finance', 'payments', 'payments & receipts'),
        # CRUD: Expenses
        **_crud('finance', 'expenses', 'expenses'),
        # CRUD: Deferred Expenses
        **_crud('finance', 'deferred_expenses', 'deferred expenses'),
        # CRUD: Assets & Depreciation
        **_crud('finance', 'assets', 'fixed assets'),
        # CRUD: Loan Contracts
        **_crud('finance', 'loans', 'loan contracts'),
        # CRUD: Cash Registers
        **_crud('finance', 'cash_registers', 'cash registers'),
        # CRUD: Financial Accounts
        **_crud('finance', 'accounts', 'financial accounts'),
        # CRUD: Account Categories
        **_crud('finance', 'account_categories', 'account categories'),
        # CRUD: Posting Rules
        **_crud('finance', 'posting_rules', 'posting rules'),
        # CRUD: Fiscal Years
        **_crud('finance', 'fiscal_years', 'fiscal years'),
        # CRUD: Payment Methods
        **_crud('finance', 'payment_methods', 'payment methods'),
        # CRUD: Document Sequences
        **_crud('finance', 'sequences', 'document sequences'),
        # CRUD: Budget
        **_crud('finance', 'budgets', 'budgets'),
        # CRUD: Profit Centers
        **_crud('finance', 'profit_centers', 'profit centers'),
        # CRUD: Bank Statements
        **_crud('finance', 'bank_statements', 'bank statements'),
        # CRUD: Revenue
        **_crud('finance', 'revenue', 'revenue accrual'),
        # Actions & Views
        'finance.view_dashboard':            'View finance dashboard',
        'finance.approve_journal_entry':     'Approve journal entries',
        'finance.reverse_journal_entry':     'Reverse journal entries',
        'finance.manage_settings':           'Configure finance settings',
        'finance.view_customer_balances':    'View customer balances',
        'finance.view_supplier_balances':    'View supplier balances',
        'finance.manage_bank_reconciliation': 'Perform bank reconciliation',
        'finance.manage_profit_distribution': 'Manage profit distribution',
        'finance.view_trial_balance':        'View trial balance',
        'finance.view_pnl':                  'View profit & loss',
        'finance.view_balance_sheet':        'View balance sheet',
        'finance.view_aging':                'View aging reports',
        'finance.view_cash_flow':            'View cash flow report',
        'finance.view_audit_trail':          'View financial audit trail',
        'finance.view_statements':           'View financial statements',
        # Close-gate permissions — bypass period locks at posting time.
        # post_locked_period: post into a soft-closed (CLOSED) standard period.
        # post_adjustment_period: post into the 13th audit/adjustment period
        # after soft-close (auditor / controller role only).
        'finance.post_locked_period':        'Post journal entries into a soft-closed (CLOSED) period',
        'finance.post_adjustment_period':    'Post adjusting entries into the audit / 13th-month period',
        # Year-close orchestration
        'finance.soft_close_year':           'Run soft year-end close (closes months, leaves audit period open)',
        'finance.hard_close_year':           'Run hard year-end close (finalize / lock fiscal year forever)',
        'finance.override_close_checklist':  'Override an unmet close checklist to proceed with year-end close',
    },

    # ─── Tax Engine ───────────────────────────────────────────────────────────
    'tax': {
        # CRUD: Tax Groups
        **_crud('tax', 'tax_groups', 'tax groups (VAT rates)'),
        # CRUD: Org Tax Policies
        **_crud('tax', 'org_policies', 'org tax policies'),
        # CRUD: Counterparty Tax Profiles
        **_crud('tax', 'counterparty_profiles', 'counterparty tax profiles'),
        # CRUD: Custom Tax Rules
        **_crud('tax', 'custom_rules', 'custom tax rules'),
        # CRUD: Withholding Tax Rules
        **_crud('tax', 'withholding_rules', 'withholding tax rules'),
        # CRUD: VAT Returns
        **_crud('tax', 'vat_returns', 'VAT return filings'),
        # Actions & Views
        'tax.view_dashboard':                'View tax dashboard',
        'tax.manage_bad_debt':               'Manage bad debt VAT claims',
        'tax.manage_advance_vat':            'Manage advance payment VAT',
        'tax.manage_credit_note_vat':        'Manage credit note VAT',
        'tax.manage_margin_scheme':          'Manage margin scheme',
        'tax.manage_reverse_charge':         'Manage reverse charge',
        'tax.view_vat_history':              'View VAT rate history',
        'tax.view_reports':                  'View tax reports',
        'tax.file_vat_return':               'File VAT returns',
        'tax.manage_settlement':             'Manage VAT settlement',
        'tax.manage_periodic_accrual':       'Manage periodic tax accrual',
    },

    # ─── CRM & Relationships ──────────────────────────────────────────────────
    'crm': {
        # CRUD: Contacts
        **_crud('crm', 'contacts', 'contacts & leads'),
        # CRUD: Follow-ups
        **_crud('crm', 'followups', 'follow-ups'),
        # CRUD: Price Groups
        **_crud('crm', 'pricing_groups', 'pricing groups'),
        # CRUD: Tags
        **_crud('crm', 'tags', 'contact tags'),
        # CRUD: CRM Settings
        **_crud('crm', 'settings', 'CRM settings'),
        # Views
        'crm.view_dashboard':                'View CRM dashboard',
        'crm.view_supplier_performance':     'View supplier performance',
        'crm.view_insights':                 'View customer insights',
    },

    # ─── HR & Workforce ──────────────────────────────────────────────────────
    'hr': {
        # CRUD: Employees
        **_crud('hr', 'employees', 'employees'),
        # CRUD: Departments
        **_crud('hr', 'departments', 'departments'),
        # CRUD: Shifts
        **_crud('hr', 'shifts', 'shift schedules'),
        # CRUD: Attendance
        **_crud('hr', 'attendance', 'attendance records'),
        # CRUD: Payroll
        **_crud('hr', 'payroll', 'payroll records'),
        # CRUD: Leave Requests
        **_crud('hr', 'leaves', 'leave requests'),
        # Actions
        'hr.view_overview':              'View HR overview',
        'hr.process_payroll':            'Process payroll run',
        'hr.approve_leaves':             'Approve leave requests',
    },

    # ─── eCommerce & Client Portal ────────────────────────────────────────────
    'ecommerce': {
        # CRUD: Online Orders
        **_crud('ecommerce', 'orders', 'online orders'),
        # CRUD: Catalog
        **_crud('ecommerce', 'catalog', 'product catalog'),
        # CRUD: Coupons
        **_crud('ecommerce', 'coupons', 'coupons'),
        # CRUD: Promotions
        **_crud('ecommerce', 'promotions', 'promotions'),
        # CRUD: Reviews
        **_crud('ecommerce', 'reviews', 'product reviews'),
        # CRUD: Themes
        **_crud('ecommerce', 'themes', 'storefront themes'),
        # CRUD: Webhooks
        **_crud('ecommerce', 'webhooks', 'webhooks'),
        # CRUD: Client Access
        **_crud('ecommerce', 'client_access', 'client portal access'),
        # CRUD: Client Tickets
        **_crud('ecommerce', 'tickets', 'client tickets'),
        # Views
        'ecommerce.view_dashboard':          'View eCommerce dashboard',
        'ecommerce.manage_storefront':       'Configure storefront settings',
        'ecommerce.view_client_orders':      'View client orders',
        'ecommerce.manage_portal_config':    'Configure client portal',
    },

    # ─── Access Control & Administration ──────────────────────────────────────
    'admin': {
        # CRUD: Users
        **_crud('admin', 'users', 'user accounts'),
        # CRUD: Roles
        **_crud('admin', 'roles', 'roles & permissions'),
        # CRUD: Feature Flags
        **_crud('admin', 'features', 'feature flags'),
        # CRUD: Custom Domains
        **_crud('admin', 'domains', 'custom domains'),
        # CRUD: Payment Terms
        **_crud('admin', 'payment_terms', 'payment terms'),
        # CRUD: Notification Rules
        **_crud('admin', 'notifications', 'notification rules'),
        # Actions
        'admin.approve_registrations':       'Approve/reject registrations',
        'admin.manage_client_access':        'Manage client portal access',
        'admin.manage_supplier_access':      'Manage supplier portal access',
        'admin.manage_system_settings':      'Configure system settings',
        'admin.manage_appearance':           'Manage themes & appearance',
        'admin.manage_regional':             'Manage regional settings',
        'admin.manage_security':             'Configure security settings',
        'admin.view_audit_log':              'View system audit log',
        'admin.manage_storage':              'Manage files & storage',
        'admin.manage_marketplace':          'Access app marketplace',
        'admin.manage_whatsapp':             'Configure WhatsApp alerts',
    },

    # ─── Intelligence & AI ────────────────────────────────────────────────────
    'mcp': {
        # CRUD: AI Agents
        **_crud('mcp', 'agents', 'AI agents / virtual employees'),
        # CRUD: AI Providers
        **_crud('mcp', 'providers', 'AI providers'),
        # CRUD: Tools
        **_crud('mcp', 'tools', 'tool registry'),
        # Views & Actions
        'mcp.access_hub':                    'Access Intelligence Hub',
        'mcp.use_assistant':                 'Use AI assistant',
        'mcp.view_logs':                     'View agent logs',
        'mcp.view_conversations':            'View conversations',
        'mcp.view_usage':                    'View AI usage & billing',
    },

    # ─── Compliance & FNE ─────────────────────────────────────────────────────
    'compliance': {
        # CRUD: FNE Certificates
        **_crud('compliance', 'certificates', 'FNE certificates'),
        # CRUD: Sticker Inventory
        **_crud('compliance', 'stickers', 'FNE sticker inventory'),
        # Views
        'compliance.manage_fne':             'Manage FNE e-invoicing',
        'compliance.view_monitoring':        'View compliance monitoring',
    },

    # ─── Workspace & Tasks ────────────────────────────────────────────────────
    'workspace': {
        # CRUD: Tasks
        **_crud('workspace', 'tasks', 'workspace tasks'),
        # CRUD: Auto-Task Rules
        **_crud('workspace', 'auto_task_rules', 'auto-task rules'),
        # CRUD: WISE Rules
        **_crud('workspace', 'wise_rules', 'WISE intelligence rules'),
        # CRUD: Templates
        **_crud('workspace', 'templates', 'document templates'),
        # CRUD: Questionnaires
        **_crud('workspace', 'questionnaires', 'questionnaires'),
        # CRUD: Scores
        **_crud('workspace', 'scores', 'evaluation scores'),
        # Actions
        'workspace.manage_supplier_portal':  'Manage supplier portal',
        'workspace.manage_wise_console':     'Access WISE console',
    },

    # ─── Delivery & Logistics ─────────────────────────────────────────────────
    'delivery': {
        # CRUD: Delivery Orders
        **_crud('delivery', 'orders', 'delivery orders'),
        # CRUD: Delivery Zones
        **_crud('delivery', 'zones', 'delivery zones'),
        # CRUD: Drivers
        **_crud('delivery', 'drivers', 'drivers'),
        # Actions
        'delivery.view_dashboard':       'View delivery dashboard',
        'delivery.assign_driver':        'Assign driver to delivery',
        'delivery.mark_delivered':       'Mark delivery as completed',
        'delivery.manage_pricing':       'Manage zone-based pricing',
    },
}


class Command(BaseCommand):
    help = 'Seed the complete permission catalogue (CRUD + actions for every entity)'

    def add_arguments(self, parser):
        parser.add_argument('--org-slug', type=str, help='Organization slug to create bootstrap roles for')
        parser.add_argument('--cleanup', action='store_true', help='Delete orphaned permissions not in current catalogue')

    def handle(self, *args, **options):
        from erp.models import Permission
        from kernel.rbac.models import KernelPermission

        # Cleanup orphans first if requested
        if options.get('cleanup'):
            catalogue_codes = set()
            for perms in PERMISSION_CATALOGUE.values():
                catalogue_codes.update(perms.keys())
            orphans = Permission.objects.exclude(code__in=catalogue_codes)
            count = orphans.count()
            if count:
                # Remove from role M2M first, then delete
                for p in orphans:
                    p.role_set.clear()
                orphans.delete()
                self.stdout.write(self.style.WARNING(f'🗑️  Cleaned up {count} orphaned permissions'))
            else:
                self.stdout.write('No orphans to clean up.')

        total_created = 0
        total_existing = 0
        # Mirror into KernelPermission so the kernel.rbac.check_permission()
        # path (used at JE-posting time + by FiscalActionPermission) can
        # see the same codes the legacy admin UI shows.
        kernel_created = 0

        for module_name, perms in PERMISSION_CATALOGUE.items():
            created_count = 0
            for code, description in perms.items():
                _, created = Permission.objects.get_or_create(
                    code=code,
                    defaults={'name': description, 'description': description}
                )
                if created:
                    created_count += 1
                    total_created += 1
                else:
                    total_existing += 1

                _, k_created = KernelPermission.objects.get_or_create(
                    code=code,
                    defaults={
                        'name': description,
                        'description': description,
                        'module': module_name,
                    },
                )
                if k_created:
                    kernel_created += 1

            perm_count = len(perms)
            self.stdout.write(
                f'  [{module_name:12s}] {perm_count:3d} permissions '
                f'({created_count} new, {perm_count - created_count} existing)'
            )

        if kernel_created:
            self.stdout.write(self.style.SUCCESS(
                f'  [kernel.rbac] mirrored {kernel_created} new codes into KernelPermission'
            ))

        self.stdout.write(self.style.SUCCESS(
            f'\n✅ Done. {total_created} created, {total_existing} already existed. '
            f'Total: {total_created + total_existing} permissions across '
            f'{len(PERMISSION_CATALOGUE)} modules.'
        ))

        # If org-slug provided, also create bootstrap roles
        org_slug = options.get('org_slug')
        if org_slug:
            self._create_bootstrap_roles(org_slug)

    def _create_bootstrap_roles(self, slug):
        from erp.models import Permission, Role, Organization

        try:
            org = Organization.objects.get(slug=slug)
        except Organization.DoesNotExist:
            self.stderr.write(f'Organization "{slug}" not found')
            return

        BOOTSTRAP = {
            'Administrator': list(
                code for perms in PERMISSION_CATALOGUE.values() for code in perms.keys()
            ),
            'Manager': [c for c in (
                list(PERMISSION_CATALOGUE.get('sales', {}).keys()) +
                list(PERMISSION_CATALOGUE.get('purchases', {}).keys()) +
                list(PERMISSION_CATALOGUE.get('products', {}).keys()) +
                list(PERMISSION_CATALOGUE.get('inventory', {}).keys()) +
                list(PERMISSION_CATALOGUE.get('crm', {}).keys()) +
                list(PERMISSION_CATALOGUE.get('finance', {}).keys())[:20] +
                list(PERMISSION_CATALOGUE.get('hr', {}).keys())[:10] +
                list(PERMISSION_CATALOGUE.get('delivery', {}).keys())
            )],
            'Accountant': list(PERMISSION_CATALOGUE.get('finance', {}).keys()) +
                          list(PERMISSION_CATALOGUE.get('tax', {}).keys()),
            'Sales Clerk': [
                'sales.view_orders', 'sales.create_orders', 'sales.edit_orders',
                'sales.confirm_order', 'sales.mark_delivered', 'sales.apply_discount_5',
                'sales.view_quotations', 'sales.create_quotations',
                'pos.access_terminal', 'pos.view_sessions', 'pos.create_sessions',
                'pos.process_sale', 'pos.cash_management', 'pos.park_orders',
                'products.view_products', 'crm.view_contacts',
            ],
            'Warehouse Staff': [
                'products.view_products',
                'inventory.view_warehouses', 'inventory.view_zones',
                'inventory.view_transfers', 'inventory.create_transfers', 'inventory.edit_transfers',
                'inventory.view_stock_counts', 'inventory.create_stock_counts', 'inventory.edit_stock_counts',
                'inventory.view_adjustments', 'inventory.create_adjustments',
                'inventory.view_serials', 'inventory.create_serials', 'inventory.edit_serials',
                'inventory.view_goods_receipts', 'inventory.create_goods_receipts',
                'inventory.view_requests', 'inventory.create_requests',
                'inventory.view_movements', 'inventory.view_low_stock',
                'inventory.view_expiry_alerts', 'inventory.view_dashboard',
                'purchases.receive_goods',
            ],
            'HR Officer': list(PERMISSION_CATALOGUE.get('hr', {}).keys()),
            'Viewer': [c for c in (
                # All view_ permissions across every module
                [code for perms in PERMISSION_CATALOGUE.values()
                 for code in perms.keys() if code.split('.')[1].startswith('view_')]
            )],
        }

        for role_name, perm_codes in BOOTSTRAP.items():
            role, _ = Role.objects.get_or_create(
                name=role_name, organization=org,
                defaults={'description': f'Bootstrap role: {role_name}'}
            )
            perms = Permission.objects.filter(code__in=perm_codes)
            role.permissions.set(perms)
            self.stdout.write(f'  Role "{role_name}" → {perms.count()} permissions')

        self.stdout.write(self.style.SUCCESS(f'✅ Bootstrap roles created for "{org.name}"'))
