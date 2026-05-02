"""
Management Command: seed_coa_templates
Loads COA templates from JSON seed files into the COATemplate database table.
Usage: python manage.py seed_coa_templates
"""
import json
import os
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Load COA templates from JSON seed files into the database'

    SEEDS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'seeds')

    def _count_accounts(self, items):
        """Recursively count all accounts in a nested tree."""
        total = 0
        for item in items:
            total += 1
            if 'children' in item:
                total += self._count_accounts(item['children'])
        return total

    def handle(self, *args, **options):
        from apps.finance.models import COATemplate

        seeds_dir = os.path.normpath(self.SEEDS_DIR)
        if not os.path.isdir(seeds_dir):
            self.stderr.write(self.style.ERROR(f"Seeds directory not found: {seeds_dir}"))
            return

        json_files = [f for f in os.listdir(seeds_dir) if f.endswith('.json')]
        if not json_files:
            self.stderr.write(self.style.WARNING("No JSON seed files found."))
            return

        self.stdout.write(f"\n📦 Loading {len(json_files)} COA template(s) from {seeds_dir}\n")

        for filename in sorted(json_files):
            filepath = os.path.join(seeds_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            key = data['key']
            account_count = self._count_accounts(data['accounts'])
            root_count = len(data['accounts'])

            template, created = COATemplate.objects.update_or_create(
                key=key,
                defaults={
                    'name': data['name'],
                    'description': data.get('description', ''),
                    'accounts': data['accounts'],
                    # Per-template code-numbering convention (drives the
                    # AccountForm's child-code suggestion). Empty dict when
                    # the seed didn't specify a rule — UI falls back to a
                    # placeholder hint only.
                    'numbering_rules': data.get('numbering_rules', {}),
                }
            )

            status = 'Created' if created else 'Updated'
            self.stdout.write(
                f"  {'✅' if created else '🔄'} {status}: {template.name} "
                f"({account_count} accounts, {root_count} root classes)"
            )

        self.stdout.write(self.style.SUCCESS(f"\n✅ All templates loaded successfully.\n"))
