"""Find which applied migration has unapplied dependencies."""
from django.core.management.base import BaseCommand
from django.db.migrations.loader import MigrationLoader
from django.db import connection


class Command(BaseCommand):
    help = 'Diagnose migration inconsistencies'

    def handle(self, *args, **options):
        loader = MigrationLoader(connection, ignore_no_migrations=True)
        applied = loader.applied_migrations

        self.stdout.write(f"Total applied: {len(applied)}")

        found = False
        for key in sorted(applied):
            if key in loader.graph.node_map:
                node = loader.graph.node_map[key]
                for parent in node.parents:
                    if parent not in applied and parent[0] != "__setting__":
                        self.stdout.write(
                            f"INCONSISTENCY: {key[0]}.{key[1]} applied, "
                            f"but dependency {parent[0]}.{parent[1]} NOT applied"
                        )
                        found = True

        if not found:
            self.stdout.write("No inconsistencies found!")
