from django.apps import AppConfig


class PosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.pos'
    verbose_name = 'POS / Sales Module'

    def ready(self):
        import apps.pos.signals  # noqa: F401
        import apps.pos.events  # noqa: F401 - registers @subscribe_to_event handlers

