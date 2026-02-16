from django.apps import AppConfig


class MigrationAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.migration'
    label = 'data_migration'
    verbose_name = 'Data Migration (UltimatePOS → TSF)'
