from django.apps import AppConfig


class FinanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.finance'
    verbose_name = 'Finance Module'

    def ready(self):
        import apps.finance.signals  # noqa: F401
        import apps.finance.events  # noqa: F401 - registers @subscribe_to_event handlers

        # ── Register lifecycle handlers with the kernel engine ──
        self._register_lifecycle_handlers()

    def _register_lifecycle_handlers(self):
        from kernel.lifecycle.service import LifecycleService
        from apps.finance.services import InvoicePostingService

        LifecycleService.register_handler('SALES_INVOICE', on_post=InvoicePostingService.post_invoice)
        LifecycleService.register_handler('PURCHASE_INVOICE', on_post=InvoicePostingService.post_invoice)
        LifecycleService.register_handler('CREDIT_NOTE')
        LifecycleService.register_handler('DEBIT_NOTE')
        LifecycleService.register_handler('PAYMENT')
        LifecycleService.register_handler('VOUCHER')
        LifecycleService.register_handler('JOURNAL_ENTRY')
        LifecycleService.register_handler('DIRECT_EXPENSE')
