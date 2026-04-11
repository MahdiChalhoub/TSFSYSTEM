"""
Seed test journal entries for ALL journal types so the Ledger page
shows rich, realistic data with different statuses, types, and sources.
Usage:  python manage.py seed_ledger_test_data
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta
import random

class Command(BaseCommand):
    help = 'Seed realistic test journal entries for the General Ledger'

    def handle(self, *args, **options):
        from erp.models import Organization
        from apps.finance.models import JournalEntry, JournalEntryLine, ChartOfAccount

        orgs = Organization.objects.all()
        if not orgs.exists():
            self.stderr.write("No organizations found. Create one first.")
            return

        for org in orgs:
            accounts = list(ChartOfAccount.objects.filter(organization=org, is_active=True)[:20])
            if len(accounts) < 2:
                self.stderr.write(f"[{org}] Less than 2 active COA accounts. Skipping.")
                continue

            now = timezone.now()
            created = 0

            ENTRIES = [
                # ── GENERAL (Manual) ──
                {'desc': 'Monthly rent accrual', 'ref': 'OFF-JV-001', 'jtype': 'GENERAL', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': None, 'debit': 3500, 'credit': 3500, 'days_ago': 2},
                {'desc': 'Office supplies adjustment', 'ref': 'OFF-JV-002', 'jtype': 'GENERAL', 'status': 'DRAFT', 'scope': 'OFFICIAL', 'src_mod': None, 'debit': 480, 'credit': 480, 'days_ago': 1},
                {'desc': 'Year-end depreciation', 'ref': 'INT-JV-003', 'jtype': 'GENERAL', 'status': 'POSTED', 'scope': 'INTERNAL', 'src_mod': None, 'debit': 12000, 'credit': 12000, 'days_ago': 30},

                # ── SALES (Auto from invoices) ──
                {'desc': 'Sales Invoice INV-2026-0412 — Client ABC Corp', 'ref': 'INV-2026-0412', 'jtype': 'SALES', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': 'sales', 'src_model': 'Invoice', 'debit': 15000, 'credit': 15000, 'days_ago': 5},
                {'desc': 'Sales Invoice INV-2026-0413 — Client XYZ Ltd', 'ref': 'INV-2026-0413', 'jtype': 'SALES', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': 'sales', 'src_model': 'Invoice', 'debit': 8750, 'credit': 8750, 'days_ago': 3},
                {'desc': 'Sales Invoice INV-2026-0414 — Client DEF SA', 'ref': 'INV-2026-0414', 'jtype': 'SALES', 'status': 'DRAFT', 'scope': 'OFFICIAL', 'src_mod': 'sales', 'src_model': 'Invoice', 'debit': 22000, 'credit': 22000, 'days_ago': 1},

                # ── PURCHASE (Auto from purchase invoices) ──
                {'desc': 'Purchase Invoice PO-2026-0088 — Supplier MegaParts', 'ref': 'PUR-2026-0088', 'jtype': 'PURCHASE', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': 'purchases', 'src_model': 'PurchaseOrder', 'debit': 45000, 'credit': 45000, 'days_ago': 7},
                {'desc': 'Purchase Invoice PO-2026-0089 — Supplier TechSource', 'ref': 'PUR-2026-0089', 'jtype': 'PURCHASE', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': 'purchases', 'src_model': 'PurchaseOrder', 'debit': 6200, 'credit': 6200, 'days_ago': 4},

                # ── CASH (Auto from payments) ──
                {'desc': 'Customer payment — Cash sale #412', 'ref': 'CUS-PAY-0412', 'jtype': 'CASH', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': 'sales', 'src_model': 'Payment', 'debit': 15000, 'credit': 15000, 'days_ago': 4},
                {'desc': 'Supplier payment — Wire transfer #088', 'ref': 'SUP-PAY-0088', 'jtype': 'CASH', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': 'purchases', 'src_model': 'Payment', 'debit': 45000, 'credit': 45000, 'days_ago': 6},

                # ── BANK ──
                {'desc': 'Bank deposit — daily till reconciliation', 'ref': 'BANK-DEP-001', 'jtype': 'BANK', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': None, 'debit': 25000, 'credit': 25000, 'days_ago': 3},
                {'desc': 'Bank charges — Q1 2026', 'ref': 'BANK-CHG-Q1', 'jtype': 'BANK', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': None, 'debit': 350, 'credit': 350, 'days_ago': 15},

                # ── INVENTORY (Auto from stock moves) ──
                {'desc': 'COGS — Stock adjustment for damaged goods', 'ref': 'INV-ADJ-001', 'jtype': 'INVENTORY', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': 'inventory', 'src_model': 'StockAdjustment', 'debit': 1800, 'credit': 1800, 'days_ago': 8},
                {'desc': 'Inventory receipt — PO-0089 warehouse intake', 'ref': 'INV-RCV-0089', 'jtype': 'INVENTORY', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': 'inventory', 'src_model': 'StockMove', 'debit': 6200, 'credit': 6200, 'days_ago': 4},

                # ── TAX ──
                {'desc': 'TVA collected — March 2026', 'ref': 'TAX-TVA-MAR', 'jtype': 'TAX', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': 'finance', 'src_model': 'VATSettlement', 'debit': 4125, 'credit': 4125, 'days_ago': 10},
                {'desc': 'TVA deductible — March 2026', 'ref': 'TAX-DED-MAR', 'jtype': 'TAX', 'status': 'DRAFT', 'scope': 'OFFICIAL', 'src_mod': 'finance', 'src_model': 'VATSettlement', 'debit': 2950, 'credit': 2950, 'days_ago': 10},

                # ── PAYROLL ──
                {'desc': 'Payroll — March 2026 salaries', 'ref': 'PRL-2026-03', 'jtype': 'PAYROLL', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': 'hr', 'src_model': 'PayrollRun', 'debit': 85000, 'credit': 85000, 'days_ago': 5},

                # ── CLOSING ──
                {'desc': 'Period close — FY2025 income summary transfer', 'ref': 'CLOSE-FY2025', 'jtype': 'CLOSING', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': None, 'debit': 125000, 'credit': 125000, 'days_ago': 90, 'locked': True, 'verified': True},

                # ── OPENING ──
                {'desc': 'Opening balance — FY2026 brought forward', 'ref': 'OPEN-FY2026', 'jtype': 'OPENING', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': None, 'debit': 340000, 'credit': 340000, 'days_ago': 89, 'locked': True, 'verified': True},

                # ── ADJUSTMENT ──
                {'desc': 'FX revaluation — USD receivables', 'ref': 'ADJ-FX-001', 'jtype': 'ADJUSTMENT', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': None, 'debit': 2100, 'credit': 2100, 'days_ago': 12, 'currency': 'USD', 'rate': '1.0842'},
                {'desc': 'Provision for doubtful debts — Q1', 'ref': 'ADJ-PROV-Q1', 'jtype': 'ADJUSTMENT', 'status': 'DRAFT', 'scope': 'OFFICIAL', 'src_mod': None, 'debit': 7500, 'credit': 7500, 'days_ago': 2},

                # ── POS (Auto from sales terminal) ──
                {'desc': 'POS Terminal #1 — Daily close batch', 'ref': 'POS-CLOSE-001', 'jtype': 'SALES', 'status': 'POSTED', 'scope': 'OFFICIAL', 'src_mod': 'pos', 'src_model': 'POSSession', 'debit': 32500, 'credit': 32500, 'days_ago': 1},

                # ── REVERSED entries ──
                {'desc': 'REVERSED: Duplicate invoice INV-0410', 'ref': 'REV-INV-0410', 'jtype': 'SALES', 'status': 'REVERSED', 'scope': 'OFFICIAL', 'src_mod': 'sales', 'src_model': 'Invoice', 'debit': 9800, 'credit': 9800, 'days_ago': 6},

                # ── INTERNAL scope entries ──
                {'desc': 'Internal transfer — Inter-branch settlement', 'ref': 'INT-TRF-001', 'jtype': 'GENERAL', 'status': 'POSTED', 'scope': 'INTERNAL', 'src_mod': None, 'debit': 55000, 'credit': 55000, 'days_ago': 3},
                {'desc': 'Internal provision — Bonus accrual Q1', 'ref': 'INT-PROV-Q1', 'jtype': 'GENERAL', 'status': 'DRAFT', 'scope': 'INTERNAL', 'src_mod': None, 'debit': 18000, 'credit': 18000, 'days_ago': 1},
            ]

            for e in ENTRIES:
                ref = e['ref']
                if JournalEntry.objects.filter(organization=org, reference=ref).exists():
                    continue

                acc_dr = random.choice(accounts)
                acc_cr = random.choice([a for a in accounts if a.id != acc_dr.id])

                je = JournalEntry(
                    organization=org,
                    description=e['desc'],
                    reference=ref,
                    journal_type=e['jtype'],
                    status=e['status'],
                    scope=e['scope'],
                    source_module=e.get('src_mod'),
                    source_model=e.get('src_model'),
                    source_id=random.randint(1, 9999) if e.get('src_mod') else None,
                    transaction_date=now - timedelta(days=e['days_ago']),
                    total_debit=Decimal(str(e['debit'])),
                    total_credit=Decimal(str(e['credit'])),
                    is_locked=e.get('locked', False),
                    is_verified=e.get('verified', False),
                    currency=e.get('currency'),
                    exchange_rate=Decimal(e['rate']) if e.get('rate') else None,
                )
                if e['status'] == 'POSTED':
                    je.posted_at = now - timedelta(days=e['days_ago'])
                je.save(force_audit_bypass=True)

                # Create 2 lines (debit + credit) — bypass immutable ledger check
                line_dr = JournalEntryLine(
                    organization=org,
                    journal_entry=je,
                    account=acc_dr,
                    debit=Decimal(str(e['debit'])),
                    credit=Decimal('0.00'),
                    description=f"Dr: {e['desc'][:50]}",
                )
                line_dr.save(force_audit_bypass=True)
                line_cr = JournalEntryLine(
                    organization=org,
                    journal_entry=je,
                    account=acc_cr,
                    debit=Decimal('0.00'),
                    credit=Decimal(str(e['credit'])),
                    description=f"Cr: {e['desc'][:50]}",
                )
                line_cr.save(force_audit_bypass=True)
                created += 1

            self.stdout.write(self.style.SUCCESS(f"[{org}] Seeded {created} journal entries"))
