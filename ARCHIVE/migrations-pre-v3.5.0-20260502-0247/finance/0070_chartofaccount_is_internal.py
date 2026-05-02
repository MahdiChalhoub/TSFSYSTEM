from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0069_dunningreminder'),
    ]

    operations = [
        migrations.AddField(
            model_name='chartofaccount',
            name='is_internal',
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
