from django.db import migrations, models


class Migration(migrations.Migration):
    """Adds per-task reminder controls:
        • remind_until_done  — when True, the reminder popup cannot be
          permanently dismissed; it keeps returning while the task is open.
        • remind_interval_min — how many minutes to wait between re-firings
          after a snooze. Default 10.
    """

    dependencies = [
        ('workspace', '0016_task_completion_checklist'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='remind_until_done',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='task',
            name='remind_interval_min',
            field=models.IntegerField(default=10),
        ),
    ]
