from django.apps import AppConfig


class HrConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.hr'
    verbose_name = 'HR Module'

    def ready(self):
        import apps.hr.events  # noqa: F401 - registers @subscribe_to_event handlers
