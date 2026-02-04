from django.apps import AppConfig

class FinanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.finance'
    label = 'apps_finance'

    def ready(self):
        # Implicitly confirm module activation
        print("💰 Finance & Accounting Module: Ledger ready for balance sheet operations.")
