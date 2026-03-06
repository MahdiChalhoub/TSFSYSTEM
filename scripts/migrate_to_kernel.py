#!/usr/bin/env python3
"""
Migrate Modules to Kernel OS v2.0
==================================

This script automates the migration of all app modules from the old TenantModel
architecture to the new Kernel OS v2.0 architecture.

What it does:
1. Replaces `from erp.models import TenantModel` with Kernel OS imports
2. Replaces `TenantModel` → `TenantOwnedModel` or `AuditLogMixin, TenantOwnedModel`
3. Replaces `organization` → `tenant` in constraints
4. Adds event emission where appropriate
5. Creates backup of original files

Usage:
    python scripts/migrate_to_kernel.py [--dry-run] [--module inventory]
"""

import os
import re
import shutil
import argparse
from pathlib import Path
from datetime import datetime


class KernelMigrator:
    """Migrates modules to Kernel OS v2.0"""

    def __init__(self, dry_run=False, backup=True):
        self.dry_run = dry_run
        self.backup = backup
        self.base_dir = Path(__file__).parent.parent / 'erp_backend' / 'apps'
        self.changes = []

    def migrate_all_modules(self):
        """Migrate all modules"""
        modules = [
            'inventory',
            'finance',
            'crm',
            'pos',
            'hr',
            'ecommerce',
            'client_portal',
            'storage',
            'supplier_portal',
            'workspace',
        ]

        print(f"\n{'='*70}")
        print(f"🚀 Migrating Modules to Kernel OS v2.0")
        print(f"{'='*70}\n")
        print(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE'}")
        print(f"Backup: {'Enabled' if self.backup else 'Disabled'}\n")

        for module in modules:
            module_path = self.base_dir / module
            if module_path.exists():
                print(f"\n📦 Processing module: {module}")
                self.migrate_module(module_path, module)
            else:
                print(f"⚠️  Module not found: {module}")

        self.print_summary()

    def migrate_module(self, module_path, module_name):
        """Migrate a single module"""
        model_files = list(module_path.rglob('models*.py'))

        for model_file in model_files:
            if '__pycache__' in str(model_file):
                continue

            print(f"  📄 {model_file.relative_to(self.base_dir)}")
            self.migrate_file(model_file, module_name)

    def migrate_file(self, file_path, module_name):
        """Migrate a single file"""
        try:
            with open(file_path, 'r') as f:
                original_content = f.read()

            # Check if already migrated
            if 'TenantOwnedModel' in original_content:
                print(f"    ✅ Already migrated")
                self.changes.append({
                    'file': str(file_path),
                    'status': 'already_migrated'
                })
                return

            # Backup original file
            if self.backup and not self.dry_run:
                backup_path = f"{file_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                shutil.copy2(file_path, backup_path)
                print(f"    💾 Backup created: {Path(backup_path).name}")

            # Perform migrations
            modified_content = original_content

            # Step 1: Update imports
            modified_content = self.update_imports(modified_content)

            # Step 2: Replace TenantModel with TenantOwnedModel
            modified_content = self.replace_base_model(modified_content, module_name)

            # Step 3: Update constraints (organization → tenant)
            modified_content = self.update_constraints(modified_content)

            # Step 4: Update indexes (organization → tenant)
            modified_content = self.update_indexes(modified_content)

            # Step 5: Update unique_together
            modified_content = self.update_unique_together(modified_content)

            # Count changes
            if modified_content != original_content:
                changes_count = len([line for line in original_content.splitlines()
                                   if line not in modified_content.splitlines()])
                print(f"    ✏️  Modified: ~{changes_count} changes")

                if not self.dry_run:
                    with open(file_path, 'w') as f:
                        f.write(modified_content)
                    print(f"    ✅ Saved")

                self.changes.append({
                    'file': str(file_path),
                    'status': 'migrated',
                    'changes': changes_count
                })
            else:
                print(f"    ℹ️  No changes needed")
                self.changes.append({
                    'file': str(file_path),
                    'status': 'no_changes'
                })

        except Exception as e:
            print(f"    ❌ Error: {e}")
            self.changes.append({
                'file': str(file_path),
                'status': 'error',
                'error': str(e)
            })

    def update_imports(self, content):
        """Update imports to use Kernel OS"""
        # Replace old imports
        patterns = [
            (
                r'from erp\.models import TenantModel',
                'from kernel.tenancy.models import TenantOwnedModel\nfrom kernel.audit.mixins import AuditLogMixin\nfrom kernel.events import emit_event'
            ),
            (
                r'from erp\.models import TenantModel,',
                'from kernel.tenancy.models import TenantOwnedModel\nfrom kernel.audit.mixins import AuditLogMixin\nfrom kernel.events import emit_event\nfrom erp.models import'
            ),
        ]

        for pattern, replacement in patterns:
            content = re.sub(pattern, replacement, content)

        return content

    def replace_base_model(self, content, module_name):
        """Replace TenantModel with TenantOwnedModel"""
        # Models that should have audit logging
        audit_models = [
            'Product', 'Invoice', 'Order', 'Contact', 'Employee',
            'Warehouse', 'Inventory', 'Payment', 'Transaction'
        ]

        lines = content.splitlines()
        new_lines = []

        for i, line in enumerate(lines):
            # Check if this is a model definition
            if re.match(r'^class (\w+)\(TenantModel\):', line):
                model_name = re.match(r'^class (\w+)\(TenantModel\):', line).group(1)

                # Determine if this model should have audit logging
                if model_name in audit_models:
                    # Add audit logging
                    new_line = line.replace('(TenantModel)', '(AuditLogMixin, TenantOwnedModel)')
                else:
                    # Just use TenantOwnedModel
                    new_line = line.replace('(TenantModel)', '(TenantOwnedModel)')

                new_lines.append(new_line)
            else:
                new_lines.append(line)

        return '\n'.join(new_lines)

    def update_constraints(self, content):
        """Update constraints to use 'tenant' instead of 'organization'"""
        # Update UniqueConstraint fields
        content = re.sub(
            r"fields=\['(\w+)', 'organization'\]",
            r"fields=['\1', 'tenant']",
            content
        )

        # Update constraint names
        content = re.sub(
            r"name='unique_(\w+)_org'",
            r"name='unique_\1_tenant'",
            content
        )
        content = re.sub(
            r"name='unique_(\w+)_(\w+)_org'",
            r"name='unique_\1_\2_tenant'",
            content
        )

        # Update fields with organization
        content = re.sub(
            r"fields=\['organization',",
            r"fields=['tenant',",
            content
        )

        return content

    def update_indexes(self, content):
        """Update indexes to use 'tenant' instead of 'organization'"""
        # Update index fields
        content = re.sub(
            r"fields=\['organization',",
            r"fields=['tenant',",
            content
        )

        # Update index names
        content = re.sub(
            r"name='(\w+)_org_",
            r"name='\1_tenant_",
            content
        )

        return content

    def update_unique_together(self, content):
        """Update unique_together tuples"""
        content = re.sub(
            r"unique_together = \(['\"](\w+)['\"], ['\"]organization['\"]\)",
            r"unique_together = ('\1', 'tenant')",
            content
        )
        content = re.sub(
            r"unique_together = \(\(['\"](\w+)['\"], ['\"]organization['\"]\)\)",
            r"unique_together = (('\1', 'tenant'),)",
            content
        )
        content = re.sub(
            r"unique_together = \(['\"](\w+)['\"], ['\"](\w+)['\"], ['\"]organization['\"]\)",
            r"unique_together = ('\1', '\2', 'tenant')",
            content
        )

        return content

    def print_summary(self):
        """Print migration summary"""
        print(f"\n{'='*70}")
        print(f"📊 Migration Summary")
        print(f"{'='*70}\n")

        migrated = [c for c in self.changes if c['status'] == 'migrated']
        already_migrated = [c for c in self.changes if c['status'] == 'already_migrated']
        no_changes = [c for c in self.changes if c['status'] == 'no_changes']
        errors = [c for c in self.changes if c['status'] == 'error']

        print(f"✅ Migrated:          {len(migrated)}")
        print(f"✓  Already migrated:  {len(already_migrated)}")
        print(f"ℹ️  No changes:        {len(no_changes)}")
        print(f"❌ Errors:            {len(errors)}")
        print(f"\n📁 Total files:       {len(self.changes)}")

        if errors:
            print(f"\n❌ Errors:")
            for error in errors:
                print(f"  - {error['file']}: {error['error']}")

        if self.dry_run:
            print(f"\n⚠️  DRY RUN MODE - No files were modified")
        else:
            print(f"\n✅ Migration complete!")

        print(f"\n{'='*70}\n")


def main():
    parser = argparse.ArgumentParser(description='Migrate modules to Kernel OS v2.0')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without modifying files')
    parser.add_argument('--no-backup', action='store_true', help='Skip backup creation')
    parser.add_argument('--module', type=str, help='Migrate specific module only')

    args = parser.parse_args()

    migrator = KernelMigrator(
        dry_run=args.dry_run,
        backup=not args.no_backup
    )

    if args.module:
        module_path = migrator.base_dir / args.module
        if module_path.exists():
            print(f"Migrating module: {args.module}")
            migrator.migrate_module(module_path, args.module)
            migrator.print_summary()
        else:
            print(f"❌ Module not found: {args.module}")
    else:
        migrator.migrate_all_modules()


if __name__ == '__main__':
    main()
