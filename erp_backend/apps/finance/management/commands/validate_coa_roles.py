"""
validate_coa_roles — Audit management command

Validates that every COA template has the required system roles assigned
exactly once. Reports missing roles, duplicates, and optionally fixes
common issues.

Usage:
    python manage.py validate_coa_roles                    # All templates
    python manage.py validate_coa_roles --template IFRS    # Specific template
    python manage.py validate_coa_roles --fix              # Auto-fix duplicates
"""
from django.core.management.base import BaseCommand, CommandError
from apps.finance.models.coa_template import (
    COATemplate, COATemplateAccount, REQUIRED_SYSTEM_ROLES
)


class Command(BaseCommand):
    help = 'Validate that COA templates have all required system roles assigned correctly'

    def add_arguments(self, parser):
        parser.add_argument(
            '--template', '-t',
            type=str, default=None,
            help='Validate a specific template by key (e.g. IFRS_COA)'
        )
        parser.add_argument(
            '--fix', action='store_true',
            help='Auto-fix: remove duplicate role assignments (keep first)'
        )
        parser.add_argument(
            '--all', action='store_true',
            help='Include inactive templates'
        )

    def handle(self, *args, **options):
        template_key = options.get('template')
        fix_mode = options.get('fix', False)
        include_all = options.get('all', False)

        qs = COATemplate.objects.all()
        if template_key:
            qs = qs.filter(key=template_key)
        if not include_all:
            qs = qs.filter(is_active=True)

        templates = list(qs)
        if not templates:
            self.stderr.write(self.style.WARNING('No templates found.'))
            return

        total_issues = 0
        total_fixed = 0

        self.stdout.write(self.style.MIGRATE_HEADING(
            f'\n{"="*70}\n  COA Role Governance Audit\n{"="*70}\n'
        ))

        for tpl in templates:
            result = COATemplateAccount.validate_required_roles(tpl.id)
            account_count = tpl.template_accounts.count()

            if result['valid']:
                self.stdout.write(
                    f'  ✅ {tpl.key:<25s} v{tpl.version:<6s} '
                    f'{account_count:>4d} accounts  |  All {len(REQUIRED_SYSTEM_ROLES)} required roles present'
                )
            else:
                self.stdout.write(self.style.ERROR(
                    f'\n  ❌ {tpl.key} (v{tpl.version}) — {account_count} accounts'
                ))

                if result['missing']:
                    total_issues += len(result['missing'])
                    self.stdout.write(self.style.WARNING(
                        f'     MISSING ({len(result["missing"])}): {", ".join(result["missing"])}'
                    ))

                if result['duplicates']:
                    total_issues += len(result['duplicates'])
                    self.stdout.write(self.style.WARNING(
                        f'     DUPLICATES ({len(result["duplicates"])}): {", ".join(result["duplicates"])}'
                    ))

                    if fix_mode:
                        fixed = self._fix_duplicates(tpl, result['duplicates'])
                        total_fixed += fixed

                # Show role coverage
                covered = len(result['role_counts'])
                total = len(REQUIRED_SYSTEM_ROLES)
                pct = round(covered / total * 100) if total else 0
                self.stdout.write(
                    f'     Coverage: {covered}/{total} required roles ({pct}%)'
                )

        # Summary
        self.stdout.write(self.style.MIGRATE_HEADING(f'\n{"="*70}'))
        self.stdout.write(f'  Templates audited: {len(templates)}')
        self.stdout.write(f'  Total issues:      {total_issues}')
        if fix_mode:
            self.stdout.write(f'  Auto-fixed:        {total_fixed}')
        if total_issues == 0:
            self.stdout.write(self.style.SUCCESS('\n  ✅ All templates pass governance audit.\n'))
        else:
            self.stdout.write(self.style.ERROR(
                f'\n  ⚠️  {total_issues} issue(s) found. '
                f'Run with --fix to auto-resolve duplicates.\n'
            ))

    def _fix_duplicates(self, template, duplicate_roles):
        """Remove duplicate system_role assignments, keeping the first one."""
        fixed = 0
        for role in duplicate_roles:
            accounts = list(
                COATemplateAccount.objects
                .filter(template=template, system_role=role)
                .order_by('code')
            )
            if len(accounts) <= 1:
                continue

            # Keep the first, clear role from the rest
            for acct in accounts[1:]:
                self.stdout.write(self.style.WARNING(
                    f'     → Clearing role {role} from {acct.code} ({acct.name})'
                ))
                acct.system_role = None
                acct.save(update_fields=['system_role'])
                fixed += 1

        return fixed
""", "Complexity": 6, "Description": "Created management command for auditing system role governance across all COA templates.", "EmptyFile": false, "IsArtifact": false, "Overwrite": false, "TargetFile": "/root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend/apps/finance/management/commands/validate_coa_roles.py"}
"""
<br>Now let me create the posting rules alignment service:
