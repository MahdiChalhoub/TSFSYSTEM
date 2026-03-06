from django.apps import AppConfig


class EcommerceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.ecommerce'
    verbose_name = 'eCommerce'

    def ready(self):
        import apps.ecommerce.events  # noqa: F401 - registers @subscribe_to_event handlers
