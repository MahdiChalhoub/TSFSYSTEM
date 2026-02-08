"""
Management Command: replay_buffered_events
===========================================
Replay buffered events/requests that couldn't be delivered to target modules.

Usage:
    python manage.py replay_buffered_events              # Replay all pending
    python manage.py replay_buffered_events --stats      # Show buffer stats only
    python manage.py replay_buffered_events --cleanup    # Expire old buffers
    python manage.py replay_buffered_events --module finance  # Replay for specific module
"""

from django.core.management.base import BaseCommand
from erp.connector_engine import connector_engine


class Command(BaseCommand):
    help = 'Replay buffered events and requests that failed to deliver'

    def add_arguments(self, parser):
        parser.add_argument(
            '--stats', action='store_true',
            help='Show buffer queue statistics without replaying'
        )
        parser.add_argument(
            '--cleanup', action='store_true',
            help='Mark expired buffered requests and exit'
        )
        parser.add_argument(
            '--module', type=str, default=None,
            help='Replay only for a specific target module (e.g., finance)'
        )
        parser.add_argument(
            '--org', type=int, default=None,
            help='Replay only for a specific organization ID'
        )

    def handle(self, *args, **options):
        # ── Stats mode ────────────────────────────────────────
        if options.get('stats'):
            stats = connector_engine.get_buffer_stats()
            self.stdout.write(self.style.MIGRATE_HEADING('Buffer Queue Stats'))
            self.stdout.write(f"  Total records:    {stats['total']}")
            
            if stats['by_status']:
                self.stdout.write('  By status:')
                for status, count in stats['by_status'].items():
                    self.stdout.write(f"    {status:12s}  {count}")
            else:
                self.stdout.write('  By status:        (empty)')
            
            if stats['pending_by_module']:
                self.stdout.write('  Pending by module:')
                for module, count in stats['pending_by_module'].items():
                    self.stdout.write(f"    {module:12s}  {count}")
            else:
                self.stdout.write('  Pending by module: (none)')
            return

        # ── Cleanup mode ──────────────────────────────────────
        if options.get('cleanup'):
            expired = connector_engine.cleanup_expired_buffers()
            self.stdout.write(self.style.SUCCESS(
                f'Cleaned up {expired} expired buffered requests'
            ))
            return

        # ── Replay mode ───────────────────────────────────────
        module = options.get('module')
        org_id = options.get('org')

        if module and org_id:
            # Targeted replay
            self.stdout.write(self.style.MIGRATE_HEADING(
                f'Replaying buffered requests for {module} (org={org_id})...'
            ))
            replayed, failed = connector_engine.replay_buffered(module, org_id)
            self._print_result(module, org_id, replayed, failed)
        
        elif module:
            # Replay all orgs for a specific module
            self.stdout.write(self.style.MIGRATE_HEADING(
                f'Replaying all buffered requests for module: {module}...'
            ))
            from erp.connector_models import BufferedRequest
            from django.utils import timezone
            org_ids = (
                BufferedRequest.objects
                .filter(target_module=module, status='pending', expires_at__gt=timezone.now())
                .values_list('organization_id', flat=True)
                .distinct()
            )
            total_replayed = 0
            total_failed = 0
            for oid in org_ids:
                replayed, failed = connector_engine.replay_buffered(module, oid)
                self._print_result(module, oid, replayed, failed)
                total_replayed += replayed
                total_failed += failed
            self.stdout.write(self.style.SUCCESS(
                f'\nTotal: {total_replayed} replayed, {total_failed} failed'
            ))
        
        else:
            # Replay all
            self.stdout.write(self.style.MIGRATE_HEADING(
                'Replaying ALL pending buffered requests...'
            ))
            
            # First cleanup expired
            expired = connector_engine.cleanup_expired_buffers()
            if expired:
                self.stdout.write(f'  Cleaned up {expired} expired requests first')
            
            results = connector_engine.replay_all_pending()
            
            if not results:
                self.stdout.write(self.style.SUCCESS('No pending buffered requests'))
                return
            
            total_replayed = 0
            total_failed = 0
            for key, (replayed, failed) in results.items():
                module_name, org = key.split(':', 1)
                self._print_result(module_name, org, replayed, failed)
                total_replayed += replayed
                total_failed += failed
            
            self.stdout.write(self.style.SUCCESS(
                f'\nTotal: {total_replayed} replayed, {total_failed} failed'
            ))

    def _print_result(self, module, org_id, replayed, failed):
        status = self.style.SUCCESS('✅') if failed == 0 else self.style.WARNING('⚠️')
        self.stdout.write(
            f'  {status} {module} (org={org_id}): '
            f'{replayed} replayed, {failed} failed'
        )
