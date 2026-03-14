"""
Management command to seed workforce RBAC permissions.

Usage:
    python manage.py seed_workforce_permissions
"""
from django.core.management.base import BaseCommand
from kernel.rbac.models import Permission


class Command(BaseCommand):
    help = 'Seeds workforce module RBAC permissions'

    def handle(self, *args, **options):
        permissions = [
            {
                'code': 'workforce.manage_rules',
                'name': 'Manage Workforce Scoring Rules',
                'description': 'Create, edit, and delete scoring rules. Configure how employee actions are scored.',
                'category': 'workforce',
                'risk_level': 'HIGH',
            },
            {
                'code': 'workforce.view_events',
                'name': 'View Workforce Score Events',
                'description': 'View detailed history of all scoring events for employees. Includes ability to reverse events.',
                'category': 'workforce',
                'risk_level': 'MEDIUM',
            },
            {
                'code': 'workforce.view_scores',
                'name': 'View Workforce Scores & Rankings',
                'description': 'View employee performance summaries, global scores, rankings, and leaderboards.',
                'category': 'workforce',
                'risk_level': 'MEDIUM',
            },
            {
                'code': 'workforce.adjust_scores',
                'name': 'Manually Adjust Employee Scores',
                'description': 'Create manual score adjustments (bonuses or penalties) for employees.',
                'category': 'workforce',
                'risk_level': 'HIGH',
            },
            {
                'code': 'workforce.award_badges',
                'name': 'Award Employee Badges',
                'description': 'Manually award badges to employees outside of automatic system.',
                'category': 'workforce',
                'risk_level': 'MEDIUM',
            },
            {
                'code': 'workforce.export_data',
                'name': 'Export Workforce Data',
                'description': 'Export employee scores, rankings, and performance data to CSV/Excel.',
                'category': 'workforce',
                'risk_level': 'HIGH',
            },
            {
                'code': 'workforce.view_own_score',
                'name': 'View Own Performance Score',
                'description': 'Employees can view their own performance summary and scoring history.',
                'category': 'workforce',
                'risk_level': 'LOW',
            },
        ]

        created_count = 0
        updated_count = 0
        skipped_count = 0

        for perm_data in permissions:
            code = perm_data['code']

            try:
                permission, created = Permission.objects.update_or_create(
                    code=code,
                    defaults={
                        'name': perm_data['name'],
                        'description': perm_data['description'],
                        'category': perm_data['category'],
                        'risk_level': perm_data.get('risk_level', 'LOW'),
                    }
                )

                if created:
                    self.stdout.write(
                        self.style.SUCCESS(f'  ✅ Created: {code}')
                    )
                    created_count += 1
                else:
                    self.stdout.write(
                        self.style.SUCCESS(f'  ✅ Updated: {code}')
                    )
                    updated_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  ❌ Failed: {code} - {str(e)}')
                )
                skipped_count += 1

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Workforce RBAC Permissions Seeding Complete'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f'  Created: {created_count}')
        self.stdout.write(f'  Updated: {updated_count}')
        self.stdout.write(f'  Failed:  {skipped_count}')
        self.stdout.write(f'  Total:   {len(permissions)}')
        self.stdout.write('')

        if created_count > 0:
            self.stdout.write(
                self.style.SUCCESS(
                    '✅ Permissions created successfully!'
                )
            )
            self.stdout.write('')
            self.stdout.write('Next steps:')
            self.stdout.write('  1. Assign permissions to roles in the admin panel')
            self.stdout.write('  2. Test permissions with different user roles')
            self.stdout.write('  3. Verify RBAC enforcement on API endpoints')
