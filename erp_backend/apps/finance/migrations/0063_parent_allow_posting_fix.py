"""
Data fix — flip allow_posting=False on every ChartOfAccount that has
children. Parent/header accounts are pure aggregations of their
descendants and must never accept direct postings. 9 accounts in live
data were found with the stale flag value allow_posting=True despite
having children (e.g. 1110 Accounts Receivable).

This migration does not touch historical JE lines that were previously
posted to those parents — that's a separate data-cleanup task (see the
`finance_detect_parent_postings` management command). Only the metadata
is corrected here so the model-level posting guard starts rejecting
NEW offending lines.

Reverse: no-op. If a user flips a parent back to a leaf (removes all its
children), they can manually toggle allow_posting=True.
"""
from django.db import migrations
from django.db.models import Count


def forwards(apps, schema_editor):
    COA = apps.get_model('finance', 'ChartOfAccount')
    parents_wrong = (
        COA.objects
        .annotate(n_children=Count('children'))
        .filter(n_children__gt=0, allow_posting=True)
    )
    parents_wrong.update(allow_posting=False)


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0062_fiscalyearclosesnapshot_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
