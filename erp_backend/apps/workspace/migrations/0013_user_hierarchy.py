import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0012_taskcategory_leader'),
        ('erp', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='UserHierarchy',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='hierarchy',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('parent_user', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='hierarchy_children',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('organization', models.ForeignKey(
                    db_column='tenant_id',
                    on_delete=django.db.models.deletion.CASCADE, to='erp.organization',
                )),
            ],
            options={
                'db_table': 'workspace_user_hierarchy',
            },
        ),
        migrations.AddConstraint(
            model_name='userhierarchy',
            constraint=models.UniqueConstraint(
                fields=('organization', 'user'),
                name='unique_user_hierarchy_per_org',
            ),
        ),
    ]
