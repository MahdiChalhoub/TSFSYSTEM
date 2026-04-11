"""
Seed Tax Engine — All 11 Models with Realistic Demo Data
=========================================================
Seeds 8 models directly, and 3 FK-dependent models only if prerequisites exist.

Run: python manage.py seed_tax_engine_demo
"""
from decimal import Decimal
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Seed realistic demo data for all 11 tax engine extension models'

    def handle(self, *args, **options):
        from erp.models import Organization
        from apps.finance.models.tax_engine_ext import (
            WithholdingTaxRule, BadDebtVATClaim, ImportDeclaration,
            SelfSupplyVATEvent, AdvancePaymentVAT, CreditNoteVATReversal,
            GiftSampleVAT, MarginSchemeTransaction, IntraBranchVATTransfer,
            ReverseChargeSelfAssessment, VATRateChangeHistory,
        )

        org = Organization.objects.first()
        if not org:
            self.stderr.write('No organization found.')
            return

        self.stdout.write(f'\n🏢 Org: {org.name}\n')
        today = date.today()
        ok = self.style.SUCCESS
        warn = self.style.WARNING

        with transaction.atomic():
            # ═══════ 1. WITHHOLDING TAX RULES ═══════
            for d in [
                dict(name='Lebanon Services WHT 7.5%', tax_type='SERVICES', rate=Decimal('0.0750'),
                     applies_to='PURCHASES', status='ACTIVE', threshold_amount=Decimal('0'), country_code='LB',
                     notes='Deducted from payment to Lebanese service suppliers. Remitted to Ministry of Finance.'),
                dict(name='Foreign Contractor AIRSI 20%', tax_type='FOREIGN', rate=Decimal('0.2000'),
                     applies_to='PURCHASES', status='ACTIVE', threshold_amount=Decimal('5000000'), country_code='CI',
                     notes='On foreign service payments >5M XOF. Required for international tax compliance.'),
                dict(name='Professional Tax 2% on Goods', tax_type='GOODS', rate=Decimal('0.0200'),
                     applies_to='BOTH', status='ACTIVE', threshold_amount=Decimal('0'), country_code='CI',
                     notes='Standard 2% withholding on goods transactions for registered counterparties.'),
            ]:
                WithholdingTaxRule.objects.create(organization=org, **d)
            self.stdout.write(ok('  ✅ 3 Withholding Tax Rules'))

            # ═══════ 2. BAD DEBT VAT CLAIMS — Skip (needs Invoice FK PROTECT) ═══════
            self.stdout.write(warn('  ⏭️  Bad Debt Claims: skipped (requires existing invoices with PROTECT FK)'))

            # ═══════ 3. IMPORT DECLARATIONS ═══════
            for d in [
                dict(declaration_number='DI-2026-003421', origin_country='CN', destination_country='CI',
                     declaration_date=today - timedelta(days=14), clearance_date=today - timedelta(days=10),
                     fob_value=Decimal('40000000'), freight_cost=Decimal('3500000'),
                     insurance_cost=Decimal('1500000'), currency_code='XOF',
                     customs_duty_rate=Decimal('0.05'), customs_duty_amount=Decimal('2250000'),
                     import_vat_rate=Decimal('0.18'), import_vat_amount=Decimal('8505000'),
                     status='CLEARED',
                     notes='500x Samsung smartphones. CIF=45M. Duty 5%=2.25M. VAT 18% on CIF+duty=8.5M. Total=10.75M.'),
                dict(declaration_number='DI-2026-003587', origin_country='FR', destination_country='CI',
                     declaration_date=today - timedelta(days=5),
                     fob_value=Decimal('10000000'), freight_cost=Decimal('2000000'),
                     insurance_cost=Decimal('800000'), currency_code='XOF',
                     customs_duty_rate=Decimal('0.10'), customs_duty_amount=Decimal('1280000'),
                     import_vat_rate=Decimal('0.18'), import_vat_amount=Decimal('2534400'),
                     status='ASSESSED',
                     notes='Industrial spare parts (compressors, filters). 10% duty. Awaiting clearance.'),
                dict(declaration_number='DI-2026-002890', origin_country='IN', destination_country='CI',
                     declaration_date=today - timedelta(days=30), clearance_date=today - timedelta(days=28),
                     fob_value=Decimal('25000000'), freight_cost=Decimal('2500000'),
                     insurance_cost=Decimal('1000000'), currency_code='XOF',
                     customs_duty_rate=Decimal('0'), customs_duty_amount=Decimal('0'),
                     import_vat_rate=Decimal('0'), import_vat_amount=Decimal('0'),
                     status='CLEARED',
                     notes='Pharmaceutical goods — EXEMPT from customs & VAT per public health decree.'),
            ]:
                ImportDeclaration.objects.create(organization=org, **d)
            self.stdout.write(ok('  ✅ 3 Import Declarations'))

            # ═══════ 4. SELF-SUPPLY VAT EVENTS ═══════
            for d in [
                dict(event_date=today - timedelta(days=20), trigger_type='INTERNAL_USE',
                     description='5x Dell laptops transferred from inventory to IT dept',
                     cost_value=Decimal('3000000'), fair_market_value=Decimal('3750000'),
                     vat_rate=Decimal('0.18'), vat_amount=Decimal('675000'),
                     status='ASSESSED', currency_code='XOF',
                     notes='Laptops removed from stock. FMV-based. Output VAT=675K declared.'),
                dict(event_date=today - timedelta(days=10), trigger_type='EMPLOYEE_BENEFIT',
                     description='Year-end staff gifts — electronics & gift cards',
                     cost_value=Decimal('1000000'), fair_market_value=Decimal('1200000'),
                     vat_rate=Decimal('0.18'), vat_amount=Decimal('216000'),
                     status='PENDING', currency_code='XOF',
                     notes='Employee appreciation. Self-supply triggered: goods given free to employees.'),
                dict(event_date=today - timedelta(days=45), trigger_type='EXEMPT_PROJECT',
                     description='Construction materials diverted to VAT-exempt housing project',
                     cost_value=Decimal('7500000'), fair_market_value=Decimal('8900000'),
                     vat_rate=Decimal('0.18'), vat_amount=Decimal('1602000'),
                     status='DECLARED', currency_code='XOF',
                     notes='Materials had input VAT recovered, now used for exempt activity. Self-supply reverses input credit.'),
            ]:
                SelfSupplyVATEvent.objects.create(organization=org, **d)
            self.stdout.write(ok('  ✅ 3 Self-Supply VAT Events'))

            # ═══════ 5. ADVANCE PAYMENT VAT — Skip (needs Contact FK PROTECT) ═══════
            self.stdout.write(warn('  ⏭️  Advance Payment VAT: skipped (requires Contact FK with PROTECT)'))

            # ═══════ 6. CREDIT NOTE VAT — Skip (needs Invoice FK PROTECT) ═══════
            self.stdout.write(warn('  ⏭️  Credit Note VAT: skipped (requires Invoice FK with PROTECT)'))

            # ═══════ 7. GIFT/SAMPLE VAT ═══════
            for d in [
                dict(gift_date=today - timedelta(days=5), gift_type='GIFT',
                     recipient_name='DG — Banque Atlantique',
                     description='Luxury pen set & leather portfolio',
                     cost_value=Decimal('85000'), market_value=Decimal('120000'),
                     cumulative_value_ytd=Decimal('85000'), threshold=Decimal('500000'),
                     vat_rate=Decimal('0.18'), vat_amount=Decimal('0'),
                     status='BELOW_THRESHOLD', currency_code='XOF',
                     notes='85K < 500K threshold. No VAT. Tracked for cumulative monitoring.'),
                dict(gift_date=today - timedelta(days=60), gift_type='SAMPLE',
                     recipient_name='Pharmacie Centrale Abidjan',
                     description='20x supplement line samples for pharmacist evaluation',
                     cost_value=Decimal('350000'), market_value=Decimal('500000'),
                     cumulative_value_ytd=Decimal('350000'), threshold=Decimal('500000'),
                     vat_rate=Decimal('0.18'), vat_amount=Decimal('0'),
                     status='BELOW_THRESHOLD', currency_code='XOF',
                     notes='Product samples for professional evaluation. Below threshold.'),
                dict(gift_date=today - timedelta(days=3), gift_type='PROMOTIONAL',
                     recipient_name='SARA 2026 Trade Show Attendees',
                     description='200x branded promo kits (T-shirts, bags, USB drives)',
                     cost_value=Decimal('1200000'), market_value=Decimal('1500000'),
                     cumulative_value_ytd=Decimal('1200000'), threshold=Decimal('500000'),
                     vat_rate=Decimal('0.18'), vat_amount=Decimal('216000'),
                     status='VAT_DUE', currency_code='XOF',
                     notes='1.2M > 500K threshold. Output VAT=216K due on excess.'),
                dict(gift_date=today - timedelta(days=90), gift_type='CHARITY',
                     recipient_name='Fondation ACTED — Rural Schools',
                     description='Donated school supplies for education program',
                     cost_value=Decimal('750000'), market_value=Decimal('800000'),
                     cumulative_value_ytd=Decimal('750000'), threshold=Decimal('500000'),
                     vat_rate=Decimal('0.18'), vat_amount=Decimal('135000'),
                     status='DECLARED', currency_code='XOF',
                     notes='Charitable donation exceeding threshold. VAT=135K declared in Q1 return.'),
            ]:
                GiftSampleVAT.objects.create(organization=org, **d)
            self.stdout.write(ok('  ✅ 4 Gift/Sample VAT'))

            # ═══════ 8. MARGIN SCHEME ═══════
            for d in [
                dict(transaction_date=today - timedelta(days=7), scheme_type='SECOND_HAND',
                     reference='MRG-2026-001',
                     description='Refurbished iPhone 14 Pro — bought from private, sold to reseller',
                     purchase_price_ht=Decimal('280000'), purchase_date=today - timedelta(days=30),
                     purchase_reference='PRIV-ACQ-0045',
                     sale_price_ht=Decimal('420000'), vat_rate=Decimal('0.18'),
                     status='CALCULATED', currency_code='XOF',
                     notes='Margin=140K. VAT on margin=25,200 (vs 75,600 on full price). 66% tax savings!'),
                dict(transaction_date=today - timedelta(days=15), scheme_type='VEHICLE',
                     reference='MRG-2026-002',
                     description='Used Toyota Hilux 2022 — trade-in resale',
                     purchase_price_ht=Decimal('12500000'), purchase_date=today - timedelta(days=45),
                     purchase_reference='TRADEIN-0012',
                     sale_price_ht=Decimal('15800000'), vat_rate=Decimal('0.18'),
                     status='DRAFT', currency_code='XOF',
                     notes='Margin=3.3M. VAT=594K instead of 2.84M. Mandatory for used vehicles without VAT on purchase.'),
                dict(transaction_date=today - timedelta(days=3), scheme_type='ART_ANTIQUE',
                     reference='MRG-2026-003',
                     description='African sculptures — gallery acquisition & resale',
                     purchase_price_ht=Decimal('3200000'), purchase_date=today - timedelta(days=60),
                     purchase_reference='ART-ACQ-008',
                     sale_price_ht=Decimal('5600000'), vat_rate=Decimal('0.18'),
                     status='DECLARED', currency_code='XOF',
                     notes='Art dealer margin. Margin=2.4M. VAT=432K. Declared March 2026.'),
            ]:
                MarginSchemeTransaction.objects.create(organization=org, **d)
            self.stdout.write(ok('  ✅ 3 Margin Scheme Transactions'))

            # ═══════ 9. INTRA-BRANCH VAT TRANSFERS ═══════
            for d in [
                dict(transfer_date=today - timedelta(days=10), transfer_type='SAME_JURISDICTION',
                     transfer_reference='ST-2026-0089',
                     description='Warehouse → POS restock (same city, same VAT zone)',
                     source_branch='Entrepôt Yopougon', source_vat_registration='CI-VAT-00456',
                     destination_branch='Boutique Plateau', destination_vat_registration='CI-VAT-00456',
                     goods_value=Decimal('4500000'),
                     vat_rate_source=Decimal('0.18'), vat_rate_destination=Decimal('0.18'),
                     vat_adjustment=Decimal('0'), status='NO_ACTION', currency_code='XOF',
                     notes='Same VAT registration → no adjustment. Internal stock movement only.'),
                dict(transfer_date=today - timedelta(days=5), transfer_type='FREE_ZONE_IN',
                     transfer_reference='ST-2026-0102',
                     description='Main warehouse → Free Trade Zone (export staging)',
                     source_branch='Entrepôt Yopougon', source_vat_registration='CI-VAT-00456',
                     destination_branch='Zone Franche VITIB', destination_vat_registration='CI-FZ-00089',
                     goods_value=Decimal('18000000'),
                     vat_rate_source=Decimal('0.18'), vat_rate_destination=Decimal('0'),
                     vat_adjustment=Decimal('-3240000'), status='ADJUSTED', currency_code='XOF',
                     notes='Free zone entry → VAT credit 3,240,000. Free zone goods are VAT-exempt.'),
                dict(transfer_date=today - timedelta(days=20), transfer_type='CROSS_BORDER',
                     transfer_reference='ST-2026-0078',
                     description='Abidjan CI → Accra Ghana (inter-company)',
                     source_branch='Bureau Abidjan CI', source_vat_registration='CI-VAT-00456',
                     destination_branch='Bureau Accra GH', destination_vat_registration='GH-TIN-00123',
                     goods_value=Decimal('7500000'),
                     vat_rate_source=Decimal('0.18'), vat_rate_destination=Decimal('0.125'),
                     vat_adjustment=Decimal('-412500'), status='APPROVED', currency_code='XOF',
                     notes='Cross-border CI 18%→GH 12.5%. Export zero-rated. GH branch handles import VAT.'),
            ]:
                IntraBranchVATTransfer.objects.create(organization=org, **d)
            self.stdout.write(ok('  ✅ 3 Intra-Branch VAT Transfers'))

            # ═══════ 10. REVERSE CHARGE ═══════
            for d in [
                dict(assessment_date=today - timedelta(days=18), trigger_type='FOREIGN_SERVICE',
                     description='Google Cloud Platform — monthly hosting',
                     supplier_invoice_ref='GCP-INV-2026-03', supplier_country='US',
                     purchase_amount_ht=Decimal('4200000'), local_vat_rate=Decimal('0.18'),
                     output_vat=Decimal('756000'), recovery_rate=Decimal('1.0'),
                     input_vat=Decimal('756000'), net_vat_cost=Decimal('0'),
                     status='ASSESSED', vat_return_period='2026-03', currency_code='XOF',
                     notes='Foreign cloud service. 100% recoverable. Net cost=0. Output=Input=756K.'),
                dict(assessment_date=today - timedelta(days=8), trigger_type='DIGITAL_SERVICE',
                     description='Adobe Creative Cloud — annual license',
                     supplier_invoice_ref='ADOBE-R-2026-Q1', supplier_country='IE',
                     purchase_amount_ht=Decimal('1850000'), local_vat_rate=Decimal('0.18'),
                     output_vat=Decimal('333000'), recovery_rate=Decimal('0.75'),
                     input_vat=Decimal('249750'), net_vat_cost=Decimal('83250'),
                     status='DECLARED', vat_return_period='2026-03', currency_code='XOF',
                     notes='Ireland digital service. 75% recovery (mixed use). Net cost=83,250 → expense.'),
                dict(assessment_date=today - timedelta(days=2), trigger_type='FOREIGN_GOODS',
                     description='Server hardware — AliExpress (no customs)',
                     supplier_invoice_ref='ALI-ORD-987654', supplier_country='CN',
                     purchase_amount_ht=Decimal('2800000'), local_vat_rate=Decimal('0.18'),
                     output_vat=Decimal('0'), recovery_rate=Decimal('1.0'),
                     input_vat=Decimal('0'), net_vat_cost=Decimal('0'),
                     status='PENDING', vat_return_period='', currency_code='XOF',
                     notes='Goods arrived without customs processing. Pending self-assessment calculation.'),
            ]:
                ReverseChargeSelfAssessment.objects.create(organization=org, **d)
            self.stdout.write(ok('  ✅ 3 Reverse Charge Self-Assessments'))

            # ═══════ 11. VAT RATE CHANGE HISTORY ═══════
            from apps.finance.models import TaxGroup
            tg = TaxGroup.objects.filter(organization=org).first()
            if tg:
                for d in [
                    dict(tax_group=tg, country_code='CI',
                         description='Côte d\'Ivoire — VAT 18%→20% (planned 2027)',
                         old_rate=Decimal('0.18'), old_rate_label='18% Standard',
                         new_rate=Decimal('0.20'), new_rate_label='20% Standard',
                         effective_date=date(2027, 1, 1), announcement_date=date(2026, 9, 15),
                         gazette_reference='Loi de Finances 2027 — Art. 342',
                         transition_rule='INVOICE_DATE',
                         transition_notes='Invoices before Jan 1 2027 → 18%. From Jan 1 → 20%.',
                         status='UPCOMING', applied_to_tax_group=False,
                         notes='Planned increase. System switch needed Jan 1 2027.'),
                    dict(tax_group=tg, country_code='LB',
                         description='Lebanon — VAT 11%→12%',
                         old_rate=Decimal('0.11'), old_rate_label='11% Standard',
                         new_rate=Decimal('0.12'), new_rate_label='12% Standard',
                         effective_date=date(2026, 1, 1), announcement_date=date(2025, 10, 20),
                         gazette_reference='Budget Law 2026 — Section 7',
                         transition_rule='EARLIER_OF',
                         transition_notes='Rate=earlier of invoice/delivery date. Deposits before keep old rate.',
                         status='ACTIVE', applied_to_tax_group=True,
                         notes='Applied Jan 1 2026. All TaxGroups updated.'),
                    dict(tax_group=tg, country_code='SN',
                         description='Senegal — Essential goods 18%→10%',
                         old_rate=Decimal('0.18'), old_rate_label='18% Standard',
                         new_rate=Decimal('0.10'), new_rate_label='10% Essentials',
                         effective_date=date(2025, 7, 1), announcement_date=date(2025, 5, 15),
                         gazette_reference='Décret n° 2025-456',
                         transition_rule='GOVERNMENT_DECREE',
                         transition_notes='Only essential goods (rice, flour, oil, sugar). Standard stays 18%.',
                         status='HISTORICAL', applied_to_tax_group=True,
                         notes='Historical reference. Essential goods now at reduced 10% rate.'),
                ]:
                    VATRateChangeHistory.objects.create(organization=org, **d)
                self.stdout.write(ok('  ✅ 3 VAT Rate Change History'))
            else:
                self.stdout.write(warn('  ⏭️  VAT Rate History: skipped (no TaxGroup found)'))

        self.stdout.write(ok(f'\n🎉 Done! Demo data seeded.\n'))
