from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
import json

class ProvisioningService:
    @staticmethod
    def provision_organization(name, slug):
        from .models import Organization, Site
        """
        Creates a new organization and a minimal core skeleton.
        """
        with transaction.atomic():
            # 1. Organization
            org = Organization.objects.create(name=name, slug=slug)
            
            # 2. Main Site
            site = Site.objects.create(
                organization=org,
                name="Main Branch",
                code="MAIN"
            )

            # 3. SaaS Financial Integration (Client Linking)
            # Find SaaS Provider Org (slug='saas') 
            if slug != 'saas':
                try:
                    saas_org = Organization.objects.filter(slug='saas').first()
                    if saas_org:
                        # Client linking logic for SaaS
                        pass
                except Exception as e:
                    print(f"Warning: Failed to link SaaS billing: {e}")

            return org

class ConfigurationService:
    @staticmethod
    def get_setting(organization, key, default=None):
        from .models import SystemSettings
        setting = SystemSettings.objects.filter(organization=organization, key=key).first()
        if not setting: return default
        try: return json.loads(setting.value)
        except: return default

    @staticmethod
    def save_setting(organization, key, value):
        from .models import SystemSettings
        SystemSettings.objects.update_or_create(
            organization=organization, 
            key=key, 
            defaults={'value': json.dumps(value)}
        )
        return True

    @staticmethod
    def get_global_settings(organization):
        return ConfigurationService.get_setting(organization, 'global_financial_settings', {})

    @staticmethod
    def save_global_settings(organization, config):
        return ConfigurationService.save_setting(organization, 'global_financial_settings', config)

class ModuleDiscoveryService:
    """
    Service to handle discovery and indexing of optional modules.
    """
    @staticmethod
    def discover_modules():
        pass
