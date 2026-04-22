"""
PackagingSuggestionRule — Smart Suggestion Engine
=================================================
Rules match (category, brand, attribute, attribute_value) → packaging
template (UnitPackage). Priority auto-computes from specificity. User
acceptance bumps usage_count for tie-breaking.

Depends on:
  - UnitPackage (inventory 0055)
  - Category, Brand, ProductAttribute (already in tree)
  - TenantOwnedModel via erp.User → organization
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0055_alter_unit_type_unitpackage'),
    ]

    operations = [
        migrations.CreateModel(
            name='PackagingSuggestionRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('attribute_value', models.CharField(blank=True, help_text='Free-text attribute value when attribute is set (e.g. "Big")', max_length=100, null=True)),
                ('priority', models.PositiveIntegerField(default=0, help_text='Manual priority — 0 = auto-compute from specificity')),
                ('usage_count', models.PositiveIntegerField(default=0, help_text='Incremented every time this suggestion is accepted')),
                ('notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(
                    db_column='tenant_id',
                    help_text='Tenant/organization this record belongs to',
                    null=True, blank=True,
                    on_delete=models.deletion.CASCADE,
                    to='erp.organization',
                )),
                ('attribute', models.ForeignKey(
                    blank=True, null=True,
                    help_text='Optional attribute (e.g. "Size: Big") this rule applies to',
                    on_delete=models.deletion.CASCADE,
                    related_name='packaging_suggestions',
                    to='inventory.productattribute',
                )),
                ('brand', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=models.deletion.CASCADE,
                    related_name='packaging_suggestions',
                    to='inventory.brand',
                )),
                ('category', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=models.deletion.CASCADE,
                    related_name='packaging_suggestions',
                    to='inventory.category',
                )),
                ('packaging', models.ForeignKey(
                    help_text='The packaging template this rule suggests',
                    on_delete=models.deletion.CASCADE,
                    related_name='suggestion_rules',
                    to='inventory.unitpackage',
                )),
            ],
            options={
                'db_table': 'packaging_suggestion_rule',
                'ordering': ['-priority', '-usage_count', '-created_at'],
                'indexes': [
                    models.Index(fields=['organization', 'category'], name='pkg_sug_org_cat_idx'),
                    models.Index(fields=['organization', 'brand'],    name='pkg_sug_org_brd_idx'),
                    models.Index(fields=['organization', 'attribute'],name='pkg_sug_org_att_idx'),
                    models.Index(fields=['organization', 'packaging'],name='pkg_sug_org_pkg_idx'),
                ],
            },
        ),
    ]
