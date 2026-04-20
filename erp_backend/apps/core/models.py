from django.db import models

# Core platform settings or global entities can go here.
# For now, most core logic is in the 'erp' app (Organization, User, etc.)
# As we modularize, we might move them here.

class SystemSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField()
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'system_settings'

    def __str__(self):
        return self.key


# Re-export tour completion model so it's picked up by Django's migration
# autodetector without needing a second app_label registration.
from .models_tours import UserTourCompletion  # noqa: E402, F401
