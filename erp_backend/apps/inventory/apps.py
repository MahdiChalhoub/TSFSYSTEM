from django.apps import AppConfig


class InventoryConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.inventory'
    verbose_name = 'Inventory Module'

    def ready(self):
        import apps.inventory.signals  # noqa: F401
        import apps.inventory.events  # noqa: F401 - registers @subscribe_to_event handlers

        # ── Register lifecycle handlers with the kernel engine ──
        self._register_lifecycle_handlers()

    def _register_lifecycle_handlers(self):
        from kernel.lifecycle.service import LifecycleService

        # Stock operations
        LifecycleService.register_handler('STOCK_ADJUSTMENT')
        LifecycleService.register_handler('STOCK_TRANSFER')
        LifecycleService.register_handler('STOCK_MOVE')

        # Fulfillment workflow
        LifecycleService.register_handler('PICK_LIST')
        LifecycleService.register_handler('PACKING_ORDER')
        LifecycleService.register_handler('SHIPMENT')
