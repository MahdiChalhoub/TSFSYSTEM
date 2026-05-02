from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0015_task_proof_of_work'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='completion_checklist',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
