from django.apps import AppConfig


class MigrationV2Config(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.migration_v2'
    verbose_name = 'Migration System v2.0'
