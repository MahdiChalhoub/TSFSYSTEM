"""
Management command to seed workforce configuration values.

Usage:
    python manage.py seed_workforce_config
    python manage.py seed_workforce_config --reset  # Reset to defaults
"""
from django.core.management.base import BaseCommand
from kernel.config import set_config, get_config


class Command(BaseCommand):
    help = 'Seeds workforce module configuration with default values'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Reset configuration to defaults (overwrite existing)',
        )

    def handle(self, *args, **options):
        reset = options.get('reset', False)

        configurations = {
            'workforce.family_weights': {
                'performance_score': 0.30,
                'trust_score': 0.25,
                'compliance_score': 0.20,
                'reliability_score': 0.15,
                'leadership_score': 0.10,
            },
            'workforce.priority_multipliers': {
                'LOW': 0.75,
                'NORMAL': 1.00,
                'HIGH': 1.25,
                'CRITICAL': 1.60,
                'EMERGENCY': 2.00,
            },
            'workforce.severity_multipliers': {
                'MINOR': 0.80,
                'MEDIUM': 1.00,
                'MAJOR': 1.40,
                'CRITICAL': 1.80,
            },
            'workforce.confidence_multipliers': {
                'LOW': 0.60,
                'MEDIUM': 0.80,
                'HIGH': 1.00,
                'VERIFIED': 1.10,
            },
            'workforce.score_curve_steepness': 0.008,
            'workforce.badge_thresholds': {
                'platinum': 90,
                'gold': 80,
                'silver': 70,
                'bronze': 60,
            },
            'workforce.risk_thresholds': {
                'critical_count_threshold_high': 5,
                'critical_count_threshold_medium': 2,
                'score_threshold_critical': 40,
                'score_threshold_high': 60,
                'score_threshold_medium': 75,
            },
        }

        created_count = 0
        updated_count = 0
        skipped_count = 0

        for key, value in configurations.items():
            existing = get_config(key)

            if existing and not reset:
                self.stdout.write(
                    self.style.WARNING(f'  ⏭️  Skipped: {key} (already exists, use --reset to overwrite)')
                )
                skipped_count += 1
                continue

            try:
                set_config(key, value)
                if existing:
                    self.stdout.write(
                        self.style.SUCCESS(f'  ✅ Updated: {key}')
                    )
                    updated_count += 1
                else:
                    self.stdout.write(
                        self.style.SUCCESS(f'  ✅ Created: {key}')
                    )
                    created_count += 1
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  ❌ Failed: {key} - {str(e)}')
                )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Workforce Configuration Seeding Complete'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f'  Created: {created_count}')
        self.stdout.write(f'  Updated: {updated_count}')
        self.stdout.write(f'  Skipped: {skipped_count}')
        self.stdout.write(f'  Total:   {len(configurations)}')
        self.stdout.write('')

        if skipped_count > 0 and not reset:
            self.stdout.write(
                self.style.WARNING(
                    'Tip: Use --reset flag to overwrite existing configurations'
                )
            )
