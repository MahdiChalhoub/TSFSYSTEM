#!/usr/bin/env python
"""Diagnostic: find which applied migration has unapplied dependencies."""
import django, os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "erp.settings")
django.setup()

from django.db.migrations.loader import MigrationLoader
from django.db import connection

loader = MigrationLoader(connection, ignore_no_migrations=True)
applied = loader.applied_migrations

print(f"Total applied migrations: {len(applied)}")
print()

found = False
for key in sorted(applied):
    if hasattr(loader, "graph") and key in loader.graph.node_map:
        node = loader.graph.node_map[key]
        for parent in node.parents:
            if parent not in applied and parent[0] != "__setting__":
                print(f"INCONSISTENCY: {key[0]}.{key[1]} applied, but dependency {parent[0]}.{parent[1]} NOT applied")
                found = True

if not found:
    print("No inconsistencies found!")
