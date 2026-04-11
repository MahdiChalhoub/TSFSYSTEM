"""
Entity Mappers — Translate UltimatePOS rows → TSF model field dictionaries.
Each mapper handles one entity type with a map_row() method.
"""
from decimal import Decimal, InvalidOperation
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)




def safe_decimal(value, default='0.00'):
    """Convert a value to Decimal safely."""
    if value is None:
        return Decimal(default)
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return Decimal(default)


def safe_int(value, default=None):
    """Convert a value to int safely."""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def safe_str(value, max_length=None, default=''):
    """Convert a value to string safely with optional truncation."""
    if value is None:
        return default  # Return '' not None — '' or None evaluates to None!
    s = str(value)
    if max_length and len(s) > max_length:
        s = s[:max_length]
    return s


def safe_bool(value, default=False):
    """Convert a value to boolean safely."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.lower() in ('1', 'true', 'yes')
    return default
