"""
Completeness Transition Report — shows products affected by tighter rules
before enforcement.

Usage:
    from apps.inventory.services.completeness_report import CompletenessTransitionReport
    report = CompletenessTransitionReport.generate(organization)
    # report = {
    #     'total_products': 1500,
    #     'affected_by_l5': 42,
    #     'affected_products': [...],
    #     'summary': 'L5 tightening would downgrade 42 products...'
    # }
"""
import logging
from django.db.models import Q

logger = logging.getLogger(__name__)


class CompletenessTransitionReport:
    """
    Generate a report showing which products would be downgraded
    by the tightened completeness rules before enforcement.
    """

    @classmethod
    def generate(cls, organization):
        """
        Generate transition report for an organization.
        Returns dict with affected products and summary stats.
        """
        from apps.inventory.models import Product, ProductPackaging

        products = Product.objects.filter(
            organization=organization, is_active=True
        )
        total = products.count()

        # ── L5: Products with packaging that would fail tighter check ──
        # Old rule: name + barcode (any packaging)
        # New rule: is_active=True + name + barcode + ratio > 0
        products_with_old_l5 = set()
        products_with_new_l5 = set()

        packagings = ProductPackaging.objects.filter(
            product__organization=organization,
            product__is_active=True,
        ).values_list('product_id', 'is_active', 'name', 'barcode', 'ratio')

        for pid, is_active, name, barcode, ratio in packagings:
            # Old rule passes
            if name and barcode:
                products_with_old_l5.add(pid)
            # New rule passes
            if is_active and name and barcode and ratio and ratio > 0:
                products_with_new_l5.add(pid)

        # Products that pass old but fail new
        downgraded_pids = products_with_old_l5 - products_with_new_l5

        affected = []
        if downgraded_pids:
            affected_products = Product.objects.filter(
                pk__in=downgraded_pids
            ).values('pk', 'sku', 'name', 'barcode')[:100]  # Cap at 100

            for p in affected_products:
                # Find the failing packaging
                failing_pkgs = ProductPackaging.objects.filter(
                    product_id=p['pk']
                ).filter(
                    Q(is_active=False) | Q(ratio__lte=0) | Q(ratio__isnull=True)
                ).values('pk', 'name', 'barcode', 'is_active', 'ratio')

                affected.append({
                    'product_id': p['pk'],
                    'sku': p['sku'],
                    'name': p['name'],
                    'issues': [
                        {
                            'packaging_id': pkg['pk'],
                            'packaging_name': pkg['name'],
                            'is_active': pkg['is_active'],
                            'ratio': float(pkg['ratio']) if pkg['ratio'] else 0,
                            'reason': cls._classify_issue(pkg),
                        }
                        for pkg in failing_pkgs
                    ],
                })

        # ── Barcode coverage ──
        from apps.inventory.models import ProductBarcode
        products_with_barcode_record = ProductBarcode.objects.filter(
            organization=organization, is_active=True
        ).values_list('product_id', flat=True).distinct().count()

        products_with_legacy_barcode = products.exclude(
            barcode__isnull=True
        ).exclude(barcode='').count()

        products_missing_barcode_record = products_with_legacy_barcode - products_with_barcode_record

        report = {
            'total_products': total,
            'l5_affected_count': len(downgraded_pids),
            'l5_affected_products': affected,
            'barcode_coverage': {
                'total_with_legacy_barcode': products_with_legacy_barcode,
                'total_with_barcode_record': products_with_barcode_record,
                'missing_barcode_record': max(0, products_missing_barcode_record),
            },
            'summary': (
                f"L5 tightening would downgrade {len(downgraded_pids)} of {total} products. "
                f"Barcode registry coverage: {products_with_barcode_record}/{products_with_legacy_barcode} products."
            ),
        }

        logger.info(f"CompletenessTransitionReport: {report['summary']}")
        return report

    @staticmethod
    def _classify_issue(pkg):
        """Classify why a packaging record fails the new L5 check."""
        issues = []
        if not pkg['is_active']:
            issues.append('inactive')
        if not pkg['ratio'] or pkg['ratio'] <= 0:
            issues.append('missing_ratio')
        if not pkg['name']:
            issues.append('missing_name')
        if not pkg['barcode']:
            issues.append('missing_barcode')
        return ', '.join(issues) if issues else 'unknown'
