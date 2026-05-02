"""
Per-user tour completion tracking.
Replaces browser-localStorage-only persistence.
"""
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('apps_core', '0004_kernelpermission_resourcepermission_role_userrole_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserTourCompletion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tour_id', models.CharField(help_text='e.g. finance-chart-of-accounts', max_length=128)),
                ('completed_version', models.IntegerField(default=1, help_text='Tour version at completion; bump to force re-show')),
                ('completed_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='tour_completions',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'user_tour_completions',
                'unique_together': {('user', 'tour_id')},
                'indexes': [models.Index(fields=['user', 'tour_id'], name='usr_tour_idx')],
            },
        ),
    ]
