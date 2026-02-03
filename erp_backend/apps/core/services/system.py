import os
import sys
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

class CoreService:
    @staticmethod
    def verify_system_integrity():
        """
        Ensures the system meets the philosophy requirements.
        """
        # 1. PostgreSQL Check
        db_engine = settings.DATABASES.get('default', {}).get('ENGINE', '')
        if 'postgresql' not in db_engine.lower():
            raise ImproperlyConfigured("SYSTEM PHILOSOPHY VIOLATION: Only PostgreSQL is allowed.")

        # 2. Environment Detection
        env = os.getenv('APP_ENV', 'development')
        return {
            'environment': env,
            'engine': 'PostgreSQL',
            'status': 'HEALTHY'
        }

    @staticmethod
    def get_system_info():
        import django
        return {
            'platform': 'TSF Modular ERP',
            'django_version': django.get_version(),
            'python_version': sys.version,
        }
