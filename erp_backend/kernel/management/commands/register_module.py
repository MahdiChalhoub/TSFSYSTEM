"""
Register Module Management Command

Registers a module from its module.json file.

Usage:
    python manage.py register_module apps/inventory/module.json
    python manage.py register_module --scan  # Scan all apps
"""

from django.core.management.base import BaseCommand
from kernel.modules import ModuleLoader
import os
import glob


class Command(BaseCommand):
    help = 'Register module(s) from module.json'

    def add_arguments(self, parser):
        parser.add_argument(
            'manifest_path',
            nargs='?',
            type=str,
            help='Path to module.json file'
        )
        parser.add_argument(
            '--scan',
            action='store_true',
            help='Scan all apps directories for module.json files'
        )

    def handle(self, *args, **options):
        manifest_path = options.get('manifest_path')
        scan_all = options.get('scan')

        if scan_all:
            self.scan_all_modules()
        elif manifest_path:
            self.register_single_module(manifest_path)
        else:
            self.stdout.write(self.style.ERROR(
                'Please provide either a manifest path or use --scan'
            ))

    def register_single_module(self, manifest_path: str):
        """Register a single module."""
        if not os.path.exists(manifest_path):
            self.stdout.write(self.style.ERROR(f"File not found: {manifest_path}"))
            return

        try:
            module = ModuleLoader.register_from_file(manifest_path)
            self.stdout.write(self.style.SUCCESS(
                f"✅ Registered: {module.name} v{module.version}"
            ))

            # Show dependencies
            if module.depends_on:
                self.stdout.write(f"   Dependencies: {', '.join(module.depends_on)}")

            # Show permissions
            if module.permissions:
                self.stdout.write(f"   Permissions: {len(module.permissions)}")

            # Show events
            events = module.events_emitted + module.events_consumed
            if events:
                self.stdout.write(f"   Events: {len(events)}")

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Failed to register: {str(e)}"))

    def scan_all_modules(self):
        """Scan all apps directories for module.json files."""
        self.stdout.write("🔍 Scanning for module.json files...")

        # Look in common locations
        search_paths = [
            'erp_backend/apps/*/module.json',
            'apps/*/module.json',
            '*/module.json',
        ]

        found_modules = []

        for pattern in search_paths:
            manifests = glob.glob(pattern, recursive=False)
            found_modules.extend(manifests)

        if not found_modules:
            self.stdout.write(self.style.WARNING("No module.json files found"))
            return

        self.stdout.write(f"Found {len(found_modules)} module(s)\n")

        registered_count = 0
        failed_count = 0

        for manifest_path in found_modules:
            try:
                module = ModuleLoader.register_from_file(manifest_path)
                self.stdout.write(self.style.SUCCESS(
                    f"  ✅ {module.name} v{module.version}"
                ))
                registered_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f"  ❌ {manifest_path}: {str(e)}"
                ))
                failed_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Registered {registered_count} module(s), {failed_count} failed"
        ))
