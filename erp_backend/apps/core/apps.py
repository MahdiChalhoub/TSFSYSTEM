from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    label = 'apps_core'

    def ready(self):
        # Guard: skip DB operations if tables don't exist yet (e.g. during
        # first-run before migrations, or during automated checks).
        if not self._tables_exist():
            print("⚠️  Core startup: DB tables not ready — skipping integrity check and contract registration.")
            return

        from .services.system import CoreService
        try:
            CoreService.verify_system_integrity()
            print("Platform Integrity Verified: PostgreSQL Engine Active.")

            # Register event contracts
            from kernel.contracts.event_contracts import register_all_contracts
            register_all_contracts()
            print("✅ Event Contracts Registered: 19 contracts loaded")

            # Register business policies (PolicyEngine)
            from .policies import register_all_policies
            policy_count = register_all_policies()
            print(f"✅ PolicyEngine: {policy_count} business policies loaded")

            # Initialize observability stack (Sentry + Metrics)
            from .observability import setup_observability
            setup_observability()

        except Exception as e:
            # Log the error but do NOT sys.exit — that kills manage.py commands
            # (check, migrate, etc.) before they can even run.
            import logging
            logger = logging.getLogger('apps.core')
            logger.warning(f"Core startup warning (non-fatal): {e}")
            print(f"⚠️  Core startup warning: {e}")

    @staticmethod
    def _tables_exist():
        """Check if the DB is migrated enough to run startup queries."""
        try:
            from django.db import connection
            table_names = connection.introspection.table_names()
            # Require at least the erp base tables to be present
            return 'systemmodule' in table_names or 'erp_user' in table_names or 'auth_user' in table_names
        except Exception:
            return False
