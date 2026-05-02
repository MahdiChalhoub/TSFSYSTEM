from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0045_merge_0022_restrict_cash_0044_generated_document'),
        ('finance', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='posregister',
            name='account_book',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='register_account_book',
                to='finance.financialaccount',
                help_text='Cashier Account Book (Livre de Caisse) linked to this register. REQUIRED to open.'
            ),
        ),
        migrations.AddField(
            model_name='posregister',
            name='register_rules_override',
            field=models.JSONField(
                blank=True, default=dict,
                help_text='Per-register overrides for global POS security rules'
            ),
        ),
    ]
