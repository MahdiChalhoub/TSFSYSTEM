from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0014_task_completed_by'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='completion_note',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='task',
            name='require_completion_note',
            field=models.BooleanField(default=False),
        ),
    ]
