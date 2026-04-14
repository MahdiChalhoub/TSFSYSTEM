"""
Migration 0052: Add tax policy override and product sharing fields to Warehouse.

Phase 2 fields:
  - tax_policy_mode: CharField with INHERIT/CUSTOM choices
  - tax_policy: FK to finance.OrgTaxPolicy (nullable)
  - product_sharing_scope: CharField with NONE/SAME_COUNTRY/SELECTED/ALL choices
  - product_sharing_targets: M2M self-referential (asymmetric)
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0051_product_coa_links'),
        ('finance', '0047_tax_engine_phase1'),
    ]

    operations = [
        # ── Tax Policy Override ──
        migrations.AddField(
            model_name='warehouse',
            name='tax_policy_mode',
            field=models.CharField(
                choices=[('INHERIT', 'Inherit from Organization'), ('CUSTOM', 'Custom Tax Policy')],
                default='INHERIT',
                help_text='Whether this branch uses the org default tax policy or a custom one',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='warehouse',
            name='tax_policy',
            field=models.ForeignKey(
                blank=True,
                help_text='Custom tax policy for this branch. Only used when tax_policy_mode=CUSTOM.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='branch_overrides',
                to='finance.orgtaxpolicy',
            ),
        ),

        # ── Product Sharing Rules ──
        migrations.AddField(
            model_name='warehouse',
            name='product_sharing_scope',
            field=models.CharField(
                choices=[
                    ('NONE', 'No Sharing'),
                    ('SAME_COUNTRY', 'Same Country Branches'),
                    ('SELECTED', 'Selected Branches Only'),
                    ('ALL', 'All Branches in Organization'),
                ],
                default='NONE',
                help_text='Controls which other branches can see/sell products from this location',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='warehouse',
            name='product_sharing_targets',
            field=models.ManyToManyField(
                blank=True,
                help_text="Specific branches that can access this location's products (for SELECTED scope)",
                related_name='shared_product_sources',
                to='inventory.warehouse',
            ),
        ),
    ]
