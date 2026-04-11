# Generated manually — Django makemigrations cannot run due to remote DB connection timeout
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0038_print_session_models'),
    ]

    operations = [
        # ── Fix pre-existing PrintSession ordering + index errors ──────
        migrations.AlterModelOptions(
            name='printsession',
            options={'ordering': ['-id']},
        ),
        migrations.RunSQL(
            sql='DROP INDEX IF EXISTS ps_org_created_idx;',
            reverse_sql='SELECT 1;',  # No-op reverse
        ),

        # ═══════════════════════════════════════════════════════════════
        # NEW MODEL: InventoryGroup
        # ═══════════════════════════════════════════════════════════════
        migrations.CreateModel(
            name='InventoryGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, help_text='e.g. "Persil Small", "Rice 5kg Equivalent"')),
                ('group_type', models.CharField(choices=[('EXACT', 'Exact Twins'), ('SIMILAR', 'Similar Substitute'), ('FAMILY', 'Product Family')], default='EXACT', max_length=10)),
                ('commercial_size_label', models.CharField(blank=True, help_text='Commercial size tier: Small / Medium / Large / etc.', max_length=50, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True, null=True)),
                ('brand', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inventory_groups', to='inventory.brand')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='+', to='erp.organization')),
            ],
            options={
                'db_table': 'inventory_group',
                'ordering': ['name'],
            },
        ),
        migrations.AddConstraint(
            model_name='inventorygroup',
            constraint=models.UniqueConstraint(fields=('name', 'organization'), name='unique_invgroup_name_tenant'),
        ),

        # ═══════════════════════════════════════════════════════════════
        # NEW MODEL: InventoryGroupMember
        # ═══════════════════════════════════════════════════════════════
        migrations.CreateModel(
            name='InventoryGroupMember',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('substitution_role', models.CharField(choices=[('PRIMARY', 'Primary Reference'), ('TWIN', 'Exact Twin'), ('SUBSTITUTE', 'Acceptable Substitute'), ('NOT_SUB', 'Not Substitutable')], default='TWIN', max_length=10)),
                ('substitution_priority', models.PositiveIntegerField(default=10, help_text='Lower = more preferred substitute. Primary reference should be 1.')),
                ('origin_label', models.CharField(blank=True, help_text='Display label: "Turkey 180ml", "France 200ml". Auto-generated if blank.', max_length=100, null=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='members', to='inventory.inventorygroup')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inventory_group_memberships', to='inventory.product')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='+', to='erp.organization')),
            ],
            options={
                'db_table': 'inventory_group_member',
                'ordering': ['substitution_priority', 'substitution_role'],
            },
        ),
        migrations.AddConstraint(
            model_name='inventorygroupmember',
            constraint=models.UniqueConstraint(fields=('group', 'product', 'organization'), name='unique_invgroup_member_tenant'),
        ),

        # ═══════════════════════════════════════════════════════════════
        # EVOLVE ProductGroup: Pricing Modes + Governance
        # ═══════════════════════════════════════════════════════════════
        migrations.AddField(
            model_name='productgroup',
            name='pricing_mode',
            field=models.CharField(choices=[('FIXED', 'Fixed Price'), ('MARGIN_RULE', 'Margin Rule'), ('CEILING', 'Ceiling'), ('BAND', 'Price Band'), ('MANUAL', 'Manual Override')], default='FIXED', max_length=15, help_text='How the group price is applied to members'),
        ),
        migrations.AddField(
            model_name='productgroup',
            name='margin_floor_pct',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Minimum allowed margin %', max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name='productgroup',
            name='max_discount_pct',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Maximum discount allowed for group members', max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name='productgroup',
            name='rounding_rule',
            field=models.CharField(choices=[('NONE', 'No rounding'), ('NEAREST_5', 'Round to nearest 5'), ('NEAREST_10', 'Round to nearest 10'), ('NEAREST_25', 'Round to nearest 25'), ('NEAREST_50', 'Round to nearest 50'), ('NEAREST_100', 'Round to nearest 100')], default='NONE', max_length=15),
        ),
        migrations.AddField(
            model_name='productgroup',
            name='price_band_values',
            field=models.JSONField(blank=True, default=list, help_text='Allowed price tiers for BAND mode'),
        ),
        migrations.AddField(
            model_name='productgroup',
            name='override_policy',
            field=models.CharField(choices=[('INHERIT', 'Members inherit group price'), ('ALLOW_LOCAL', 'Members can override locally'), ('LOCK_LOCAL', 'Members locked to group price')], default='INHERIT', max_length=15),
        ),
        migrations.AddField(
            model_name='productgroup',
            name='margin_rule_pct',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='For MARGIN_RULE mode: target margin %', max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name='productgroup',
            name='last_synced_at',
            field=models.DateTimeField(blank=True, help_text='When group prices were last synced to members', null=True),
        ),

        # ═══════════════════════════════════════════════════════════════
        # EVOLVE Product: Pricing Source + Group Sync Status
        # ═══════════════════════════════════════════════════════════════
        migrations.AddField(
            model_name='product',
            name='pricing_source',
            field=models.CharField(choices=[('LOCAL', 'Local'), ('GROUP', 'Group')], default='LOCAL', max_length=5),
        ),
        migrations.AddField(
            model_name='product',
            name='group_sync_status',
            field=models.CharField(choices=[('SYNCED', 'Synced'), ('BROKEN', 'Broken'), ('LOCAL_OVERRIDE', 'Local override'), ('PENDING', 'Pending'), ('N/A', 'Not in group')], default='N/A', max_length=15),
        ),
        migrations.AddField(
            model_name='product',
            name='group_broken_since',
            field=models.DateTimeField(blank=True, help_text='When group price divergence was detected', null=True),
        ),
        migrations.AddField(
            model_name='product',
            name='group_expected_price',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Expected group price', max_digits=15, null=True),
        ),

        # ═══════════════════════════════════════════════════════════════
        # EVOLVE PriceChangeRequest: Group Scope + Auto-Approval
        # ═══════════════════════════════════════════════════════════════
        migrations.AddField(
            model_name='pricechangerequest',
            name='price_group',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='price_change_requests', to='inventory.productgroup'),
        ),
        migrations.AddField(
            model_name='pricechangerequest',
            name='change_scope',
            field=models.CharField(choices=[('PRODUCT', 'Single Product'), ('GROUP', 'Price Group')], default='PRODUCT', max_length=10),
        ),
        migrations.AddField(
            model_name='pricechangerequest',
            name='is_auto_approved',
            field=models.BooleanField(default=False, help_text='Auto-approved by policy'),
        ),
        migrations.AddField(
            model_name='pricechangerequest',
            name='auto_approval_reason',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='pricechangerequest',
            name='verified_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='price_changes_verified', to='erp.user'),
        ),
        migrations.AddField(
            model_name='pricechangerequest',
            name='verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='pricechangerequest',
            name='affected_count',
            field=models.PositiveIntegerField(default=0, help_text='Number of products affected'),
        ),
        migrations.AlterField(
            model_name='pricechangerequest',
            name='product',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='price_change_requests', to='inventory.product'),
        ),

        # ═══════════════════════════════════════════════════════════════
        # NEW MODEL: PriceApprovalPolicy
        # ═══════════════════════════════════════════════════════════════
        migrations.CreateModel(
            name='PriceApprovalPolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('priority', models.PositiveIntegerField(default=10, help_text='Lower = evaluated first')),
                ('applies_to_role', models.CharField(blank=True, max_length=50, null=True)),
                ('applies_to_user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='price_approval_policies', to='erp.user')),
                ('max_delta_pct', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('min_margin_pct', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('max_amount', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('allow_group_changes', models.BooleanField(default=False)),
                ('action', models.CharField(choices=[('AUTO_APPROVE', 'Auto-approve and apply'), ('AUTO_APPROVE_PENDING_VERIFY', 'Auto-approve, require verification'), ('BLOCK', 'Block')], default='BLOCK', max_length=30)),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='+', to='erp.organization')),
            ],
            options={
                'db_table': 'price_approval_policy',
                'ordering': ['priority'],
            },
        ),
        migrations.AddConstraint(
            model_name='priceapprovalpolicy',
            constraint=models.UniqueConstraint(fields=('name', 'organization'), name='unique_price_policy_name_tenant'),
        ),
    ]
