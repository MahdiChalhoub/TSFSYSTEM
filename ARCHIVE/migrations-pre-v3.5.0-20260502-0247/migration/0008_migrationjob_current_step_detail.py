# Generated manually on 2026-02-27

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('data_migration', '0007_migrationjob_completed_steps_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='migrationjob',
            name='current_step_detail',
            field=models.CharField(
                blank=True, max_length=200, null=True,
                help_text='Sub-step progress detail e.g. "35,000/53,752 transactions"'
            ),
        ),
    ]
