"""
COA / Financial Account helpers — IAS 21 / ASC 830 monetary classification
defaults. Shared between `account_views` (legacy `_smart_default_for`
import for tests) and the bulk-classify ChartOfAccountViewSet mixin.
"""


def _smart_default_for(acc):
    """Return (monetary_classification, revaluation_required) per IAS 21/ASC 830.

    Heuristics — operators can override per account afterwards:
      * INCOME / EXPENSE accounts → INCOME_EXPENSE (revalued at AVERAGE)
      * EQUITY accounts → NON_MONETARY (Capital, RE; historical cost)
      * ASSET / LIABILITY → MONETARY by default
      * ASSET with system_role tagging fixed-asset / inventory / prepaid → NON_MONETARY
      * Sub-type 'CASH' / 'BANK' / 'RECEIVABLE' / 'PAYABLE' → MONETARY
      * Accounts in base currency: revaluation_required=False (pointless to reval).

    Returns the *recommended* defaults; never enforces them.
    """
    NON_MON_ROLES = {
        'INVENTORY', 'INVENTORY_ASSET', 'WIP',
        'ACCUM_DEPRECIATION',
    }
    MON_SUB_TYPES = {'CASH', 'BANK', 'RECEIVABLE', 'PAYABLE'}

    t = acc.type
    role = acc.system_role or ''
    sub = (acc.sub_type or '').upper()
    has_currency = bool(acc.currency)

    if t in ('INCOME', 'EXPENSE'):
        return ('INCOME_EXPENSE', has_currency)
    if t == 'EQUITY':
        return ('NON_MONETARY', False)
    if role in NON_MON_ROLES:
        return ('NON_MONETARY', False)
    if sub in MON_SUB_TYPES:
        return ('MONETARY', has_currency)
    if t in ('ASSET', 'LIABILITY'):
        return ('MONETARY', has_currency)
    return ('MONETARY', False)
