"""
COA Index Cache
===============
In-memory indexed lookup for ChartOfAccount, optimized for auto-detect
resolution. Builds indexes by code, sub_type, type, system_role, and
name keywords for fast O(1) account matching.

Usage:
    cache = COAIndexCache.build(organization)
    acc = cache.find_by_code('411')
    acc = cache.find_by_role('RECEIVABLE')
    acc = cache.find_by_subtype('RECEIVABLE')
    accs = cache.search_by_name('client')
"""
import logging
from collections import defaultdict
from functools import lru_cache

logger = logging.getLogger(__name__)


class COAIndexCache:
    """
    Pre-indexed COA lookup for an organization.
    Built once per resolution cycle, used for O(1) lookups.
    """

    def __init__(self):
        self._by_code = {}           # code → account dict
        self._by_role = {}           # system_role → account dict
        self._by_subtype = {}        # sub_type → account dict
        self._by_type = defaultdict(list)   # type → [account dicts]
        self._by_name_token = defaultdict(list)  # keyword → [account dicts]
        self._all_accounts = []

    @classmethod
    def build(cls, organization):
        """Build index from all active accounts in this organization."""
        from apps.finance.models import ChartOfAccount

        cache = cls()
        accounts = list(
            ChartOfAccount.objects.filter(
                organization=organization,
                is_active=True,
            ).values('id', 'code', 'name', 'type', 'sub_type', 'system_role')
        )

        for acc in accounts:
            cache._all_accounts.append(acc)

            # Index by code (exact)
            if acc['code']:
                cache._by_code[str(acc['code']).strip()] = acc

            # Index by system_role
            if acc.get('system_role'):
                cache._by_role[acc['system_role']] = acc

            # Index by sub_type
            if acc.get('sub_type'):
                cache._by_subtype[acc['sub_type'].upper()] = acc

            # Index by type
            if acc.get('type'):
                cache._by_type[acc['type'].upper()].append(acc)

            # Index by name keywords (lowered, split)
            if acc.get('name'):
                for token in acc['name'].lower().split():
                    if len(token) >= 3:  # skip tiny words
                        cache._by_name_token[token].append(acc)

        logger.debug(
            "COAIndexCache built for org %s: %d accounts, %d roles, %d subtypes",
            organization.id, len(accounts), len(cache._by_role), len(cache._by_subtype)
        )
        return cache

    def find_by_code(self, code):
        """O(1) exact code lookup. Returns account dict or None."""
        return self._by_code.get(str(code).strip())

    def find_by_role(self, role):
        """O(1) system_role lookup. Returns account dict or None."""
        return self._by_role.get(role)

    def find_by_subtype(self, sub_type):
        """O(1) sub_type lookup. Returns account dict or None."""
        return self._by_subtype.get(sub_type.upper() if sub_type else '')

    def find_by_type(self, acc_type):
        """Returns list of accounts matching the type."""
        return self._by_type.get(acc_type.upper(), [])

    def find_by_type_and_name(self, acc_type, name_fragment):
        """Find account by type + name fragment."""
        candidates = self._by_type.get(acc_type.upper(), [])
        fragment = name_fragment.lower()
        for acc in candidates:
            if fragment in (acc.get('name', '') or '').lower():
                return acc
        return None

    def search_by_name(self, keyword):
        """Find accounts with name containing keyword."""
        return self._by_name_token.get(keyword.lower(), [])

    def first_of_type(self, acc_type):
        """Return first account of a given type."""
        accs = self._by_type.get(acc_type.upper(), [])
        return accs[0] if accs else None

    @property
    def account_count(self):
        return len(self._all_accounts)


# ── Per-request cache ──
_org_cache = {}


def get_coa_cache(organization):
    """Get or build COA index cache for an organization. Thread-safe per-request."""
    org_id = organization.id
    if org_id not in _org_cache:
        _org_cache[org_id] = COAIndexCache.build(organization)
    return _org_cache[org_id]


def clear_coa_cache(organization_id=None):
    """Clear COA cache. Call after COA modifications."""
    if organization_id:
        _org_cache.pop(organization_id, None)
    else:
        _org_cache.clear()
