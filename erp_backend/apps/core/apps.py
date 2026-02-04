from django.apps import AppConfig

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    label = 'apps_core'

    def ready(self):
        from .services.system import CoreService
        try:
            CoreService.verify_system_integrity()
            print("Platform Integrity Verified: PostgreSQL Engine Active.")
        except Exception as e:
            print(f"PLATFORM SHUTDOWN: {str(e)}")
            import sys
            sys.exit(1)
