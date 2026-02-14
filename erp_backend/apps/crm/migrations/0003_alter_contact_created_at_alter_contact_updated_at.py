# Stub migration to restore broken chain.
# The original 0003 was deleted from the repo but is still recorded in the database.
# The DB already has the changes applied, so operations is empty.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0002_initial'),
    ]

    operations = [
        # All changes from the original 0003 are already applied in the database.
        # This stub exists solely to satisfy the dependency chain for 0004.
    ]
