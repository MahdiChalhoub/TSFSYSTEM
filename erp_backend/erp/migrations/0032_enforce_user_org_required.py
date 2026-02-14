# Hand-written migration: Only makes User.organization non-nullable.
# Django's auto-detector incorrectly tries to delete models that were
# moved to sub-apps (finance, inventory, etc.) — this targeted migration avoids that.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0031_organization_settings'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='organization',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='users',
                to='erp.organization',
            ),
        ),
    ]
