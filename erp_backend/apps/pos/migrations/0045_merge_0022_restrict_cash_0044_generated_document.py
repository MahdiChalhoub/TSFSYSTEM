from django.db import migrations


class Migration(migrations.Migration):
    """
    Merge migration: resolves conflict between
    0022_possettings_restrict_unique_cash (remote-only branch) and
    0044_gap10_generated_document (local main branch).
    """

    dependencies = [
        ('pos', '0022_possettings_restrict_unique_cash'),
        ('pos', '0044_gap10_generated_document'),
    ]

    operations = [
    ]
