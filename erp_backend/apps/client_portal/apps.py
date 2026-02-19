from django.apps import AppConfig

class ClientPortalConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.client_portal'
    verbose_name = 'Client Portal'

    def ready(self):
        try:
            from . import signals  # noqa: F401
        except ImportError:
            pass
