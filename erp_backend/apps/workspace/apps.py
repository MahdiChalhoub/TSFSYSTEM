from django.apps import AppConfig


class WorkspaceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.workspace'
    verbose_name = 'Workspace & Tasks'

    def ready(self):
        import apps.workspace.signals  # noqa: F401
        import apps.workspace.events   # noqa: F401
