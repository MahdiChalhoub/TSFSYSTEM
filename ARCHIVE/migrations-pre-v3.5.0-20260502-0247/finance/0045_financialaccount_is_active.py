from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0044_link_categories_to_coa'),
    ]

    operations = [
        migrations.AddField(
            model_name='financialaccount',
            name='is_active',
            field=models.BooleanField(default=True, help_text='Inactive accounts cannot be used in new transactions'),
        ),
    ]
