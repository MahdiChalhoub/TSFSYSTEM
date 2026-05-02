"""Merge migration to unify the two branches:
- 0039_grouping_and_pricing_modes (from 0038_print_session_models)
- 0042_add_timestamps_to_printsession (from 0040 → 0039_harden_print_session_models → 0038)
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0039_grouping_and_pricing_modes'),
        ('inventory', '0042_add_timestamps_to_printsession'),
    ]

    operations = []
