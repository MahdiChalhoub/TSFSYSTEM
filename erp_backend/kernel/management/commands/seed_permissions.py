"""
Seed Permissions Management Command

Creates initial permission set for all modules.

Usage:
    python manage.py seed_permissions
"""

from django.core.management.base import BaseCommand
from kernel.rbac.models import Permission


class Command(BaseCommand):
    help = 'Seed initial permissions for all modules'

    def handle(self, *args, **kwargs):
        permissions = [
            # Finance Module
            {'code': 'finance.view_invoice', 'name': 'View Invoices', 'module': 'finance'},
            {'code': 'finance.create_invoice', 'name': 'Create Invoices', 'module': 'finance'},
            {'code': 'finance.edit_invoice', 'name': 'Edit Invoices', 'module': 'finance'},
            {'code': 'finance.delete_invoice', 'name': 'Delete Invoices', 'module': 'finance', 'is_dangerous': True},
            {'code': 'finance.void_invoice', 'name': 'Void Invoices', 'module': 'finance', 'is_dangerous': True},
            {'code': 'finance.view_payment', 'name': 'View Payments', 'module': 'finance'},
            {'code': 'finance.create_payment', 'name': 'Create Payments', 'module': 'finance'},
            {'code': 'finance.void_payment', 'name': 'Void Payments', 'module': 'finance', 'is_dangerous': True},
            {'code': 'finance.view_reports', 'name': 'View Financial Reports', 'module': 'finance'},
            {'code': 'finance.export_data', 'name': 'Export Financial Data', 'module': 'finance'},

            # Inventory Module
            {'code': 'inventory.view_product', 'name': 'View Products', 'module': 'inventory'},
            {'code': 'inventory.create_product', 'name': 'Create Products', 'module': 'inventory'},
            {'code': 'inventory.edit_product', 'name': 'Edit Products', 'module': 'inventory'},
            {'code': 'inventory.delete_product', 'name': 'Delete Products', 'module': 'inventory', 'is_dangerous': True},
            {'code': 'inventory.adjust_stock', 'name': 'Adjust Stock Levels', 'module': 'inventory'},
            {'code': 'inventory.view_warehouse', 'name': 'View Warehouses', 'module': 'inventory'},
            {'code': 'inventory.transfer_stock', 'name': 'Transfer Stock', 'module': 'inventory'},

            # POS Module
            {'code': 'pos.open_register', 'name': 'Open Register', 'module': 'pos'},
            {'code': 'pos.close_register', 'name': 'Close Register', 'module': 'pos'},
            {'code': 'pos.process_sale', 'name': 'Process Sale', 'module': 'pos'},
            {'code': 'pos.void_sale', 'name': 'Void Sale', 'module': 'pos', 'is_dangerous': True},
            {'code': 'pos.apply_discount', 'name': 'Apply Discounts', 'module': 'pos'},
            {'code': 'pos.view_reports', 'name': 'View POS Reports', 'module': 'pos'},

            # CRM Module
            {'code': 'crm.view_customer', 'name': 'View Customers', 'module': 'crm'},
            {'code': 'crm.create_customer', 'name': 'Create Customers', 'module': 'crm'},
            {'code': 'crm.edit_customer', 'name': 'Edit Customers', 'module': 'crm'},
            {'code': 'crm.delete_customer', 'name': 'Delete Customers', 'module': 'crm', 'is_dangerous': True},
            {'code': 'crm.view_contact', 'name': 'View Contacts', 'module': 'crm'},
            {'code': 'crm.create_contact', 'name': 'Create Contacts', 'module': 'crm'},
            {'code': 'crm.export_data', 'name': 'Export CRM Data', 'module': 'crm'},

            # HR Module
            {'code': 'hr.view_employee', 'name': 'View Employees', 'module': 'hr'},
            {'code': 'hr.create_employee', 'name': 'Create Employees', 'module': 'hr'},
            {'code': 'hr.edit_employee', 'name': 'Edit Employees', 'module': 'hr'},
            {'code': 'hr.delete_employee', 'name': 'Delete Employees', 'module': 'hr', 'is_dangerous': True},
            {'code': 'hr.view_salary', 'name': 'View Salary Information', 'module': 'hr'},
            {'code': 'hr.process_payroll', 'name': 'Process Payroll', 'module': 'hr', 'is_dangerous': True},
            {'code': 'hr.manage_attendance', 'name': 'Manage Attendance', 'module': 'hr'},

            # Sales Module
            {'code': 'sales.view_order', 'name': 'View Orders', 'module': 'sales'},
            {'code': 'sales.create_order', 'name': 'Create Orders', 'module': 'sales'},
            {'code': 'sales.edit_order', 'name': 'Edit Orders', 'module': 'sales'},
            {'code': 'sales.cancel_order', 'name': 'Cancel Orders', 'module': 'sales', 'is_dangerous': True},
            {'code': 'sales.view_quote', 'name': 'View Quotes', 'module': 'sales'},
            {'code': 'sales.create_quote', 'name': 'Create Quotes', 'module': 'sales'},

            # Procurement Module
            {'code': 'procurement.view_purchase_order', 'name': 'View Purchase Orders', 'module': 'procurement'},
            {'code': 'procurement.create_purchase_order', 'name': 'Create Purchase Orders', 'module': 'procurement'},
            {'code': 'procurement.approve_purchase_order', 'name': 'Approve Purchase Orders', 'module': 'procurement'},
            {'code': 'procurement.cancel_purchase_order', 'name': 'Cancel Purchase Orders', 'module': 'procurement', 'is_dangerous': True},
            {'code': 'procurement.view_supplier', 'name': 'View Suppliers', 'module': 'procurement'},

            # System Admin
            {'code': 'system.manage_users', 'name': 'Manage Users', 'module': 'system', 'is_dangerous': True},
            {'code': 'system.manage_roles', 'name': 'Manage Roles', 'module': 'system', 'is_dangerous': True},
            {'code': 'system.view_audit_logs', 'name': 'View Audit Logs', 'module': 'system'},
            {'code': 'system.manage_config', 'name': 'Manage Configuration', 'module': 'system', 'is_dangerous': True},
            {'code': 'system.view_reports', 'name': 'View System Reports', 'module': 'system'},
        ]

        created_count = 0
        updated_count = 0

        for perm_data in permissions:
            perm, created = Permission.objects.get_or_create(
                code=perm_data['code'],
                defaults=perm_data
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  ✓ Created: {perm.code}"))
            else:
                # Update existing permission
                for key, value in perm_data.items():
                    if key != 'code':
                        setattr(perm, key, value)
                perm.save()
                updated_count += 1
                self.stdout.write(f"  → Updated: {perm.code}")

        self.stdout.write(self.style.SUCCESS(f"\n✅ Permissions seeded: {created_count} created, {updated_count} updated"))
