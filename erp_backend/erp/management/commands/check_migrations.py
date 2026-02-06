"""
Migration Health Check - Verifies all migration files are applied to the database.
Run on startup to catch migration gaps before the backend starts.
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django.db.migrations.loader import MigrationLoader
import sys


class Command(BaseCommand):
    help = 'Check if all migrations are applied to the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fail-on-gap',
            action='store_true',
            help='Exit with error code 1 if there are unapplied migrations',
        )
        parser.add_argument(
            '--app',
            type=str,
            default='erp',
            help='App to check migrations for (default: erp)',
        )

    def handle(self, *args, **options):
        app_label = options['app']
        fail_on_gap = options['fail_on_gap']
        
        self.stdout.write(self.style.HTTP_INFO(f'🔍 Checking migration health for "{app_label}"...'))
        
        loader = MigrationLoader(connection)
        
        # Get all migration files for the app
        disk_migrations = set()
        applied_migrations = set()
        
        for (app, name), migration in loader.disk_migrations.items():
            if app == app_label:
                disk_migrations.add(name)
        
        for (app, name) in loader.applied_migrations:
            if app == app_label:
                applied_migrations.add(name)
        
        # Find unapplied migrations
        unapplied = disk_migrations - applied_migrations
        
        # Find orphaned (applied but no file) migrations
        orphaned = applied_migrations - disk_migrations
        
        # Check for gaps in migration sequence
        migration_numbers = []
        for name in disk_migrations:
            try:
                num = int(name.split('_')[0])
                migration_numbers.append(num)
            except (ValueError, IndexError):
                pass
        
        migration_numbers.sort()
        gaps = []
        for i in range(len(migration_numbers) - 1):
            if migration_numbers[i + 1] - migration_numbers[i] > 1:
                gaps.append((migration_numbers[i], migration_numbers[i + 1]))
        
        # Report results
        has_issues = False
        
        if unapplied:
            has_issues = True
            self.stdout.write(self.style.WARNING(f'⚠️  UNAPPLIED MIGRATIONS ({len(unapplied)}):'))
            for name in sorted(unapplied):
                self.stdout.write(f'   - {name}')
        
        if orphaned:
            has_issues = True
            self.stdout.write(self.style.WARNING(f'⚠️  ORPHANED MIGRATIONS (applied but file missing) ({len(orphaned)}):'))
            for name in sorted(orphaned):
                self.stdout.write(f'   - {name}')
        
        if gaps:
            has_issues = True
            self.stdout.write(self.style.WARNING(f'⚠️  MIGRATION GAPS DETECTED:'))
            for start, end in gaps:
                self.stdout.write(f'   - Gap between {start:04d} and {end:04d} (missing {end - start - 1} migrations)')
        
        if not has_issues:
            self.stdout.write(self.style.SUCCESS(f'✅ Migration health OK: {len(applied_migrations)} migrations applied'))
            return
        
        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO(f'📊 Summary:'))
        self.stdout.write(f'   - Disk migrations: {len(disk_migrations)}')
        self.stdout.write(f'   - Applied migrations: {len(applied_migrations)}')
        self.stdout.write(f'   - Unapplied: {len(unapplied)}')
        self.stdout.write(f'   - Orphaned: {len(orphaned)}')
        self.stdout.write(f'   - Gaps: {len(gaps)}')
        
        if fail_on_gap:
            self.stdout.write(self.style.ERROR('❌ Migration health check FAILED'))
            sys.exit(1)
        else:
            self.stdout.write(self.style.WARNING('⚠️  Migration issues detected. Run "python manage.py migrate" to fix.'))
