"""
process_periodic_badges — compatibility shim
=============================================
Older version superseded by `award_workforce_badges`.
This command delegates to the newer implementation to avoid breaking
any scheduled tasks or scripts that still reference this command name.
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = '[Deprecated] Use award_workforce_badges instead. This shim delegates to it.'

    def add_arguments(self, parser):
        parser.add_argument('--period', type=str, default=None)
        parser.add_argument('--org', type=int, default=None)
        parser.add_argument('--dry-run', action='store_true', default=False)
        parser.add_argument('--overwrite', action='store_true', default=False)

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING(
            "⚠️  process_periodic_badges is deprecated. Delegating to award_workforce_badges."
        ))
        call_command(
            'award_workforce_badges',
            period=options.get('period'),
            org=options.get('org'),
            dry_run=options['dry_run'],
            overwrite=options['overwrite'],
            verbosity=options.get('verbosity', 1),
        )
