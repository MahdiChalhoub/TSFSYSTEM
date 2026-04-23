"""
Add shared `reference_code` to Category (ReferenceCodeMixin).

- Adds the ``reference_code`` column (indexed, nullable).
- Backfills existing rows by pulling sequential values from the shared
  ``TransactionSequence`` pool under the ``CATEGORY`` key, per
  organization. Uses the same SequenceService the UI edits at
  /finance/sequences so counters stay consistent.
"""
from django.db import migrations, models


def _backfill_reference_codes(apps, schema_editor):
    Category = apps.get_model('inventory', 'Category')
    TransactionSequence = apps.get_model('finance', 'TransactionSequence')

    # Group by organization so the counter advances per tenant.
    orgs = Category.objects.order_by('organization_id', 'level', 'code', 'id') \
        .values_list('organization_id', flat=True).distinct()

    for org_id in orgs:
        if org_id is None:
            continue
        seq, _ = TransactionSequence.objects.get_or_create(
            organization_id=org_id,
            type='CATEGORY',
            defaults={'prefix': 'CAT-', 'padding': 5, 'next_number': 1},
        )
        qs = Category.objects.filter(organization_id=org_id, reference_code__isnull=True) \
            .order_by('level', 'code', 'id')
        for cat in qs:
            number = str(seq.next_number).zfill(seq.padding or 5)
            cat.reference_code = f"{seq.prefix or ''}{number}{seq.suffix or ''}"
            cat.save(update_fields=['reference_code'])
            seq.next_number += 1
        seq.save(update_fields=['next_number'])


def _noop_reverse(apps, schema_editor):
    # Reversing the column drop is enough; the backfilled values vanish
    # with the column, so no data work needed here.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0058_unitpackage_safety'),
        ('finance', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='reference_code',
            field=models.CharField(
                max_length=40, null=True, blank=True, db_index=True,
                help_text='Auto-generated global reference (one counter per entity type).',
            ),
        ),
        migrations.RunPython(_backfill_reference_codes, _noop_reverse),
    ]
