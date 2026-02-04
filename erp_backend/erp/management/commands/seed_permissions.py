"""
Management command to seed the Permission table with all module permissions.
Run: python manage.py seed_permissions
"""

from django.core.management.base import BaseCommand
from erp.models import Permission


class Command(BaseCommand):
    help = 'Seeds the Permission table with all defined module permissions'

    # All module permissions following the pattern: module.action_resource
    PERMISSIONS = {
        # Inventory Module
        'inventory': [
            ('inventory.view_products', 'View Products'),
            ('inventory.add_product', 'Add New Product'),
            ('inventory.edit_product', 'Edit Product'),
            ('inventory.delete_product', 'Delete Product'),
            ('inventory.view_stock', 'View Stock Levels'),
            ('inventory.adjust_stock', 'Adjust Stock'),
            ('inventory.receive_stock', 'Receive Stock'),
            ('inventory.transfer_stock', 'Transfer Stock Between Warehouses'),
            ('inventory.view_warehouses', 'View Warehouses'),
            ('inventory.manage_warehouses', 'Manage Warehouses'),
            ('inventory.view_categories', 'View Categories'),
            ('inventory.manage_categories', 'Manage Categories'),
            ('inventory.view_brands', 'View Brands'),
            ('inventory.manage_brands', 'Manage Brands'),
        ],
        # Finance Module
        'finance': [
            ('finance.view_ledger', 'View General Ledger'),
            ('finance.create_entry', 'Create Journal Entry'),
            ('finance.post_entry', 'Post Journal Entry'),
            ('finance.void_entry', 'Void Journal Entry'),
            ('finance.view_reports', 'View Financial Reports'),
            ('finance.manage_coa', 'Manage Chart of Accounts'),
            ('finance.view_accounts', 'View Financial Accounts'),
            ('finance.manage_accounts', 'Manage Financial Accounts'),
            ('finance.view_fiscal', 'View Fiscal Periods'),
            ('finance.manage_fiscal', 'Manage Fiscal Periods'),
        ],
        # POS Module
        'pos': [
            ('pos.sell', 'Process Sales'),
            ('pos.void_sale', 'Void Sale'),
            ('pos.apply_discount', 'Apply Discounts'),
            ('pos.view_sales', 'View Sales History'),
            ('pos.manage_registers', 'Manage Cash Registers'),
            ('pos.close_register', 'Close Register'),
            ('pos.view_reports', 'View POS Reports'),
        ],
        # Contacts/CRM Module
        'crm': [
            ('crm.view_contacts', 'View Contacts'),
            ('crm.add_contact', 'Add Contact'),
            ('crm.edit_contact', 'Edit Contact'),
            ('crm.delete_contact', 'Delete Contact'),
            ('crm.view_suppliers', 'View Suppliers'),
            ('crm.view_customers', 'View Customers'),
        ],
        # Purchasing Module
        'purchasing': [
            ('purchasing.view_orders', 'View Purchase Orders'),
            ('purchasing.create_order', 'Create Purchase Order'),
            ('purchasing.approve_order', 'Approve Purchase Order'),
            ('purchasing.receive_order', 'Receive Purchase Order'),
            ('purchasing.void_order', 'Void Purchase Order'),
        ],
        # Audit Module
        'audit': [
            ('audit.view_logs', 'View Audit Logs'),
            ('audit.manage_workflows', 'Manage Workflow Definitions'),
            ('audit.approve_requests', 'Approve/Reject Approval Requests'),
            ('audit.view_tasks', 'View Task Queue'),
            ('audit.manage_tasks', 'Manage Tasks'),
        ],
        # Organization/Admin Module
        'admin': [
            ('admin.view_users', 'View Users'),
            ('admin.manage_users', 'Manage Users'),
            ('admin.view_roles', 'View Roles'),
            ('admin.manage_roles', 'Manage Roles'),
            ('admin.view_settings', 'View Settings'),
            ('admin.manage_settings', 'Manage Settings'),
            ('admin.view_sites', 'View Sites'),
            ('admin.manage_sites', 'Manage Sites'),
        ],
    }

    def handle(self, *args, **options):
        created_count = 0
        existing_count = 0
        
        for module, permissions in self.PERMISSIONS.items():
            self.stdout.write(f"\n📦 Processing module: {module}")
            
            for code, name in permissions:
                obj, created = Permission.objects.get_or_create(
                    code=code,
                    defaults={'name': name}
                )
                
                if created:
                    created_count += 1
                    self.stdout.write(self.style.SUCCESS(f"  ✅ Created: {code}"))
                else:
                    existing_count += 1
                    self.stdout.write(f"  ⏭️  Exists: {code}")
        
        self.stdout.write(f"\n{'='*50}")
        self.stdout.write(self.style.SUCCESS(
            f"✅ Seeding complete: {created_count} created, {existing_count} already existed"
        ))
        self.stdout.write(f"Total permissions in database: {Permission.objects.count()}")
