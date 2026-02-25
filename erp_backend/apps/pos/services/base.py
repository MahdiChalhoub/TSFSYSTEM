import logging
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

def _safe_import(module_path, names):
    """
    Safely import names from a module. Returns None for each
    name if the module is not installed.
    """
    try:
        mod = __import__(module_path, fromlist=names)
        return tuple(getattr(mod, n) for n in names)
    except ImportError:
        logger.warning(f"Module '{module_path}' not installed — import skipped")
        return tuple(None for _ in names)
