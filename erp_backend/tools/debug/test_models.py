import sys
import os
import django
import json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.apps import apps
from apps.inventory.models import Product, Unit
print(Unit._meta.get_fields())
