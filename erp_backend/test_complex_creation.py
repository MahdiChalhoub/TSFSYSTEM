import sys
import os
import django
import json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "erp.settings")
django.setup()

from apps.inventory.models import Product, ProductGroup, SupplierProductInfo
from django.db import transaction

print('Models Loaded.')
