"""
Enhanced Auto-Detect Engine
============================
Deterministically infers GL account mappings for each posting event using
a prioritized matching cascade with explainable confidence scores.

Each match includes:
    - confidence: 0-100 score
    - strategy: human-readable explanation of how the match was found
    - tier: the matching tier (1=exact code, 2=system_role, 3=sub_type, etc.)

Uses COAIndexCache for O(1) lookups — no N+1 queries.

Usage:
    from apps.finance.services.auto_detect_engine import AutoDetectEngine

    results = AutoDetectEngine.detect_all(organization)
    # results = {
    #     'sales.invoice.receivable': {
    #         'account_id': 42,
    #         'account_code': '411',
    #         'account_name': 'Clients',
    #         'confidence': 95,
    #         'strategy': 'Matched by system_role=RECEIVABLE',
    #         'tier': 2,
    #     },
    #     ...
    # }
"""
import logging
from apps.finance.services.coa_index_cache import COAIndexCache, get_coa_cache

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# Detection Rules — maps event codes to matching cascades
# Each cascade is tried in order; first match wins.
# ═══════════════════════════════════════════════════════════════

class MatchStrategy:
    """A single matching attempt with confidence and explanation."""

    def __init__(self, tier, confidence, strategy_label, finder):
        self.tier = tier
        self.confidence = confidence
        self.strategy_label = strategy_label
        self.finder = finder  # callable(cache) → account dict or None


def by_code(*codes):
    """Match by exact account code. Tier 1, confidence 98."""
    def finder(cache):
        for code in codes:
            acc = cache.find_by_code(code)
            if acc:
                return acc
        return None
    code_str = '/'.join(codes[:3]) + ('...' if len(codes) > 3 else '')
    return MatchStrategy(1, 98, f"Exact code match ({code_str})", finder)


def by_role(role):
    """Match by system_role. Tier 2, confidence 95."""
    def finder(cache):
        return cache.find_by_role(role)
    return MatchStrategy(2, 95, f"Matched by system_role={role}", finder)


def by_subtype(sub_type):
    """Match by sub_type. Tier 3, confidence 85."""
    def finder(cache):
        return cache.find_by_subtype(sub_type)
    return MatchStrategy(3, 85, f"Matched by sub_type={sub_type}", finder)


def by_type_name(acc_type, *name_fragments):
    """Match by type + name keyword. Tier 4, confidence 70."""
    def finder(cache):
        for frag in name_fragments:
            acc = cache.find_by_type_and_name(acc_type, frag)
            if acc:
                return acc
        return None
    return MatchStrategy(4, 70, f"Matched by type={acc_type} + name", finder)


def by_first_type(acc_type):
    """Fallback: first account of type. Tier 5, confidence 40."""
    def finder(cache):
        return cache.first_of_type(acc_type)
    return MatchStrategy(5, 40, f"Fallback: first {acc_type} account", finder)


# ═══════════════════════════════════════════════════════════════
# Event → Matching cascade definitions
# ═══════════════════════════════════════════════════════════════

DETECTION_RULES = {
    # ── Sales ──
    'sales.invoice.receivable': [
        by_role('RECEIVABLE'), by_code('1110', '1200', '411', '41'),
        by_subtype('RECEIVABLE'), by_type_name('ASSET', 'receivable', 'client')
    ],
    'sales.invoice.revenue': [
        by_role('REVENUE'), by_code('4100', '4101', '701', '70'),
        by_type_name('INCOME', 'sales', 'vente', 'revenue'), by_first_type('INCOME')
    ],
    'sales.invoice.discount': [
        by_role('DISCOUNT_GIVEN'), by_code('6190', '709', '4201'),
        by_type_name('EXPENSE', 'discount', 'remise')
    ],
    'sales.invoice.vat_output': [
        by_role('VAT_OUTPUT'), by_code('2111', '4457', '443'),
        by_type_name('LIABILITY', 'vat collected', 'tva collectée', 'vat payable')
    ],
    'sales.invoice.rounding': [
        by_role('ROUNDING_DIFF'), by_code('9002', '6589', '7589', '758'),
        by_type_name('INCOME', 'rounding'), by_type_name('EXPENSE', 'rounding')
    ],
    'sales.credit_note.receivable_reversal': [
        by_role('RECEIVABLE'), by_code('411', '1110'),
        by_subtype('RECEIVABLE')
    ],
    'sales.credit_note.revenue_reversal': [
        by_role('REVENUE'), by_code('701', '4100'),
        by_type_name('INCOME', 'sales', 'revenue')
    ],
    'sales.writeoff.bad_debt_expense': [
        by_role('BAD_DEBT'), by_code('654', '6541'),
        by_type_name('EXPENSE', 'bad debt', 'créance')
    ],

    # ── Purchases ──
    'purchases.invoice.payable': [
        by_role('PAYABLE'), by_code('2101', '2100', '401', '40'),
        by_subtype('PAYABLE'), by_type_name('LIABILITY', 'payable', 'fournisseur')
    ],
    'purchases.invoice.expense': [
        by_role('COGS'), by_code('5101', '6011', '601', '60'),
        by_type_name('EXPENSE', 'purchase', 'achat'), by_first_type('EXPENSE')
    ],
    'purchases.invoice.inventory': [
        by_role('INVENTORY'), by_code('1120', '1300', '31', '37'),
        by_subtype('INVENTORY'), by_type_name('ASSET', 'inventory', 'stock', 'marchandise')
    ],
    'purchases.invoice.vat_input': [
        by_role('VAT_INPUT'), by_code('2115', '2112', '4456', '445'),
        by_type_name('ASSET', 'vat', 'tva')
    ],
    'purchases.invoice.discount': [
        by_role('DISCOUNT_RECEIVED'), by_code('4201', '7190', '609'),
        by_type_name('INCOME', 'discount', 'escompte')
    ],
    'purchases.invoice.freight': [
        by_role('DELIVERY_FEES'), by_code('5102', '6241', '624', '61'),
        by_type_name('EXPENSE', 'freight', 'transport', 'livraison')
    ],

    # ── Inventory ──
    'inventory.receipt.inventory': [
        by_role('INVENTORY'), by_code('1120', '31', '37'),
        by_subtype('INVENTORY'), by_type_name('ASSET', 'inventory', 'stock')
    ],
    'inventory.receipt.grni': [
        by_role('GRNI'), by_code('408', '380', '2102'),
        by_type_name('LIABILITY', 'goods received', 'reception', 'transit')
    ],
    'inventory.issue.cogs': [
        by_role('COGS'), by_code('5100', '601', '60'),
        by_type_name('EXPENSE', 'cost of goods', 'cogs', 'achat')
    ],
    'inventory.issue.inventory': [
        by_role('INVENTORY'), by_code('31', '37', '1120'),
        by_subtype('INVENTORY')
    ],
    'inventory.adjustment.loss': [
        by_code('659', '708', '9001'),
        by_type_name('EXPENSE', 'adjustment', 'variation', 'loss')
    ],
    'inventory.adjustment.gain': [
        by_code('759', '708'),
        by_type_name('INCOME', 'adjustment', 'gain')
    ],

    # ── Payments ──
    'payments.customer.cash': [
        by_role('CASH_ACCOUNT'), by_code('1000', '530', '57'),
        by_subtype('CASH'), by_type_name('ASSET', 'cash', 'caisse')
    ],
    'payments.customer.bank': [
        by_role('BANK_ACCOUNT'), by_code('1010', '512', '52'),
        by_subtype('BANK'), by_type_name('ASSET', 'bank', 'banque')
    ],
    'payments.customer.receivable': [
        by_role('RECEIVABLE'), by_code('411', '1110'),
        by_subtype('RECEIVABLE')
    ],
    'payments.supplier.cash': [
        by_role('CASH_ACCOUNT'), by_code('1000', '530', '57'),
        by_subtype('CASH')
    ],
    'payments.supplier.bank': [
        by_role('BANK_ACCOUNT'), by_code('1010', '512', '52'),
        by_subtype('BANK')
    ],
    'payments.supplier.payable': [
        by_role('PAYABLE'), by_code('401', '2100'),
        by_subtype('PAYABLE')
    ],

    # ── Tax ──
    'tax.vat.output': [
        by_role('VAT_OUTPUT'), by_code('4457', '443'),
        by_type_name('LIABILITY', 'vat collected', 'tva collectée')
    ],
    'tax.vat.input': [
        by_role('VAT_INPUT'), by_code('4456', '445'),
        by_type_name('ASSET', 'vat deductible', 'tva déductible')
    ],
    'tax.vat.payable': [
        by_code('4455', '443'), by_type_name('LIABILITY', 'vat payable', 'tva à payer')
    ],
    'tax.vat.recoverable': [
        by_code('4458', '445'), by_type_name('ASSET', 'vat refund', 'credit tva')
    ],
    'tax.airsi.payable': [
        by_role('WITHHOLDING'), by_code('4471', '447'),
        by_type_name('LIABILITY', 'withholding', 'airsi', 'retenue')
    ],
    'tax.airsi.purchases': [
        by_role('WITHHOLDING'), by_code('4471', '447'),
        by_type_name('LIABILITY', 'airsi', 'retenue')
    ],

    # ── Treasury ──
    'treasury.fx.gain': [
        by_role('FX_GAIN'), by_code('766', '756'),
        by_type_name('INCOME', 'exchange gain', 'gain de change')
    ],
    'treasury.fx.loss': [
        by_role('FX_LOSS'), by_code('666', '656'),
        by_type_name('EXPENSE', 'exchange loss', 'perte de change')
    ],

    # ── Assets ──
    'assets.depreciation.expense': [
        by_role('DEPRECIATION_EXP'), by_code('6303', '681', '68'),
        by_type_name('EXPENSE', 'depreciation', 'amortis')
    ],
    'assets.depreciation.accumulated': [
        by_role('ACCUM_DEPRECIATION'), by_code('1210', '281', '28'),
        by_type_name('ASSET', 'accumulated depreciation', 'amortis')
    ],

    # ── Equity ──
    'equity.capital.contribution': [
        by_role('CAPITAL'), by_code('3001', '3100', '101', '10'),
        by_type_name('EQUITY', 'capital'), by_first_type('EQUITY')
    ],
    'equity.capital.withdrawal': [
        by_role('WITHDRAWAL'), by_code('3005', '3200', '108', '12'),
        by_type_name('EQUITY', 'draw', 'retrait', 'withdrawal')
    ],
    'equity.retained_earnings.transfer': [
        by_role('RETAINED_EARNINGS'), by_code('3003', '120', '12'),
        by_type_name('EQUITY', 'retained', 'résultat')
    ],
}


class AutoDetectResult:
    """Result of a single event detection."""
    __slots__ = ['event_code', 'account_id', 'account_code', 'account_name',
                 'confidence', 'strategy', 'tier', 'matched']

    def __init__(self, event_code, account=None, confidence=0, strategy='', tier=0):
        self.event_code = event_code
        self.matched = account is not None
        self.account_id = account['id'] if account else None
        self.account_code = account.get('code', '') if account else ''
        self.account_name = account.get('name', '') if account else ''
        self.confidence = confidence
        self.strategy = strategy
        self.tier = tier

    def to_dict(self):
        return {
            'event_code': self.event_code,
            'account_id': self.account_id,
            'account_code': self.account_code,
            'account_name': self.account_name,
            'confidence': self.confidence,
            'strategy': self.strategy,
            'tier': self.tier,
            'matched': self.matched,
        }


class AutoDetectEngine:
    """
    Enhanced auto-detect with confidence scores and explainable matching.
    """

    @staticmethod
    def detect_all(organization):
        """
        Run auto-detect for all events in the detection catalog.
        Returns dict: event_code → AutoDetectResult.to_dict()
        """
        cache = get_coa_cache(organization)
        results = {}

        for event_code, strategies in DETECTION_RULES.items():
            result = AutoDetectEngine._detect_one(event_code, strategies, cache)
            results[event_code] = result.to_dict()

        return results

    @staticmethod
    def detect_one(organization, event_code):
        """Detect a single event. Returns AutoDetectResult.to_dict() or None."""
        strategies = DETECTION_RULES.get(event_code)
        if not strategies:
            return AutoDetectResult(event_code).to_dict()

        cache = get_coa_cache(organization)
        return AutoDetectEngine._detect_one(event_code, strategies, cache).to_dict()

    @staticmethod
    def _detect_one(event_code, strategies, cache):
        """Internal: try each strategy in cascade order."""
        for strategy in strategies:
            try:
                account = strategy.finder(cache)
                if account:
                    return AutoDetectResult(
                        event_code=event_code,
                        account=account,
                        confidence=strategy.confidence,
                        strategy=strategy.strategy_label,
                        tier=strategy.tier,
                    )
            except Exception as exc:
                logger.warning("Detection strategy failed for %s: %s", event_code, exc)

        return AutoDetectResult(event_code)

    @staticmethod
    def get_detection_summary(organization):
        """
        Get a summary of auto-detect results for reporting.
        Returns: {
            'total': N,
            'matched': N,
            'avg_confidence': float,
            'by_tier': {1: N, 2: N, ...},
            'unmatched': [event_code, ...],
        }
        """
        results = AutoDetectEngine.detect_all(organization)
        matched = [r for r in results.values() if r['matched']]
        unmatched = [r['event_code'] for r in results.values() if not r['matched']]

        by_tier = {}
        for r in matched:
            tier = r['tier']
            by_tier[tier] = by_tier.get(tier, 0) + 1

        avg_conf = sum(r['confidence'] for r in matched) / len(matched) if matched else 0

        return {
            'total': len(results),
            'matched': len(matched),
            'unmatched_count': len(unmatched),
            'avg_confidence': round(avg_conf, 1),
            'by_tier': by_tier,
            'tier_labels': {
                1: 'Exact Code Match',
                2: 'System Role Match',
                3: 'Sub-Type Match',
                4: 'Type + Name Match',
                5: 'Fallback Type Match',
            },
            'unmatched': unmatched,
        }
