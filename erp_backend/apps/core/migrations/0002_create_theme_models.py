# Generated manually for theme models
from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        ('apps_core', '0001_initial'),
        ('erp', '0012_transactionstatuslog_meta_transactiontype_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrganizationTheme',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text="Display name (e.g., 'Finance Pro', 'My Custom Theme')", max_length=100)),
                ('slug', models.SlugField(help_text='URL-safe identifier (auto-generated from name)', max_length=100)),
                ('description', models.TextField(blank=True, help_text='User-friendly description of the theme')),
                ('preset_data', models.JSONField(help_text='Complete theme configuration JSON')),
                ('category', models.CharField(choices=[('professional', 'Professional'), ('creative', 'Creative'), ('efficiency', 'Efficiency'), ('specialized', 'Specialized'), ('custom', 'Custom')], default='custom', help_text='Theme category for organization', max_length=50)),
                ('is_system', models.BooleanField(default=False, help_text='System preset (built-in, cannot be edited/deleted)')),
                ('is_active', models.BooleanField(default=True, help_text='Active themes appear in selector')),
                ('is_default', models.BooleanField(default=False, help_text='Default theme for new users in this organization')),
                ('usage_count', models.IntegerField(default=0, help_text='Number of users currently using this theme')),
                ('base_theme', models.ForeignKey(blank=True, help_text='Parent theme if this is a customized variant', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='variants', to='apps_core.organizationtheme')),
                ('organization', models.ForeignKey(blank=True, db_column='tenant_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='apps_core_organizationtheme_v2_set', to='erp.organization')),
            ],
            options={
                'verbose_name': 'Organization Theme',
                'verbose_name_plural': 'Organization Themes',
                'db_table': 'core_organization_theme',
                'ordering': ['-id'],
            },
        ),
        migrations.CreateModel(
            name='UserThemePreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('color_mode', models.CharField(choices=[('light', 'Light'), ('dark', 'Dark'), ('auto', 'Auto (System)')], default='dark', max_length=10)),
                ('active_theme', models.ForeignKey(blank=True, help_text='Currently active theme (NULL = default theme)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='users', to='apps_core.organizationtheme')),
                ('organization', models.ForeignKey(blank=True, db_column='tenant_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='apps_core_userthemepreference_v2_set', to='erp.organization')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='theme_preferences', to='erp.user')),
            ],
            options={
                'verbose_name': 'User Theme Preference',
                'verbose_name_plural': 'User Theme Preferences',
                'db_table': 'core_user_theme_preference',
                'ordering': ['-id'],
            },
        ),
        migrations.AddIndex(
            model_name='organizationtheme',
            index=models.Index(fields=['organization', 'is_system', 'is_active'], name='apps_core_o_organiz_idx'),
        ),
        migrations.AddIndex(
            model_name='userthemepreference',
            index=models.Index(fields=['user', 'organization'], name='apps_core_u_user_id_idx'),
        ),
        migrations.AddConstraint(
            model_name='userthemepreference',
            constraint=models.UniqueConstraint(fields=('user', 'organization'), name='unique_user_org_theme_pref'),
        ),
    ]
