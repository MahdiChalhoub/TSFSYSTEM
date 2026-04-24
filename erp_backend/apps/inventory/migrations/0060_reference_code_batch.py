"""
Roll out ``reference_code`` (ReferenceCodeMixin) to the rest of
inventory's master data: Brand, Parfum, Unit, UnitPackage,
PackagingSuggestionRule, ProductGroup, ProductAttribute, Warehouse.

Each gets its own key in ``TransactionSequence`` (CATEGORY already
handled in migration 0059):

    BRAND                     → BRA-NNNNN
    PARFUM                    → PAR-NNNNN
    UNIT                      → UOM-NNNNN
    UNIT_PACKAGE              → PKG-NNNNN
    PACKAGING_SUGGESTION_RULE → PKR-NNNNN
    PRODUCT_GROUP             → GRP-NNNNN
    PRODUCT_ATTRIBUTE         → ATT-NNNNN
    WAREHOUSE                 → WH-NNNNN

Existing rows are backfilled per organization, draining from the same
shared sequence the app uses at runtime, so manual row creation and
migration-era rows stay in lockstep.
"""
from django.db import migrations, models


TARGETS = [
    # (model_name, seq_key,              prefix,  padding)
    ('Brand',                    'BRAND',                     'BRA-', 5),
    ('Parfum',                   'PARFUM',                    'PAR-', 5),
    ('Unit',                     'UNIT',                      'UOM-', 5),
    ('UnitPackage',              'UNIT_PACKAGE',              'PKG-', 5),
    ('PackagingSuggestionRule',  'PACKAGING_SUGGESTION_RULE', 'PKR-', 5),
    ('ProductGroup',             'PRODUCT_GROUP',             'GRP-', 5),
    ('ProductAttribute',         'PRODUCT_ATTRIBUTE',         'ATT-', 5),
    ('Warehouse',                'WAREHOUSE',                 'WH-',  5),
]


def _backfill(apps, schema_editor):
    TransactionSequence = apps.get_model('finance', 'TransactionSequence')
    for model_name, key, prefix, padding in TARGETS:
        Model = apps.get_model('inventory', model_name)
        org_ids = Model.objects.order_by('organization_id', 'id') \
            .values_list('organization_id', flat=True).distinct()
        for org_id in org_ids:
            if org_id is None:
                continue
            seq, _ = TransactionSequence.objects.get_or_create(
                organization_id=org_id,
                type=key,
                defaults={'prefix': prefix, 'padding': padding, 'next_number': 1},
            )
            qs = Model.objects.filter(
                organization_id=org_id, reference_code__isnull=True,
            ).order_by('id')
            for obj in qs:
                number = str(seq.next_number).zfill(seq.padding or padding)
                obj.reference_code = f"{seq.prefix or ''}{number}{seq.suffix or ''}"
                obj.save(update_fields=['reference_code'])
                seq.next_number += 1
            seq.save(update_fields=['next_number'])


def _noop(apps, schema_editor):
    pass


def _add_field(model_name):
    return migrations.AddField(
        model_name=model_name.lower(),
        name='reference_code',
        field=models.CharField(
            max_length=40, null=True, blank=True, db_index=True,
            help_text='Auto-generated global reference (one counter per entity type).',
        ),
    )


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0059_category_reference_code'),
        ('finance', '0001_initial'),
    ]

    operations = [_add_field(m[0]) for m in TARGETS] + [
        migrations.RunPython(_backfill, _noop),
    ]
