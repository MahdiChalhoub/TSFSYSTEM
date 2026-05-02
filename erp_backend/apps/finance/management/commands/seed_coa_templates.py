"""
Management Command: seed_coa_templates
Loads COA templates from JSON seed files into the COATemplate database table.
Usage: python manage.py seed_coa_templates
"""
import json
import os
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Load COA templates from JSON seed files into the database'

    SEEDS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'seeds')

    def _count_accounts(self, items):
        """Recursively count all accounts in a nested tree."""
        total = 0
        for item in items:
            total += 1
            if 'children' in item:
                total += self._count_accounts(item['children'])
        return total

    # Mirrors ChartOfAccount.scope_mode @property — kept in sync so the
    # loader and the live derivation always agree. We resolve here ONCE at
    # import time and store the result on COATemplateAccount.default_scope_mode
    # so the frontend doesn't have to re-derive when reading template data.
    SCOPE_LOCATED_ROLES = {'INVENTORY', 'INVENTORY_ASSET', 'WIP', 'GOODS_IN_TRANSIT'}
    SCOPE_TENANT_ROLES = {
        'AR_CONTROL', 'AP_CONTROL', 'CASH_ACCOUNT', 'BANK_ACCOUNT',
        'TAX_PAYABLE', 'TAX_RECEIVABLE',
        'RETAINED_EARNINGS', 'P_L_SUMMARY', 'OPENING_BALANCE_OFFSET',
        'RECEIVABLE', 'PAYABLE', 'CAPITAL', 'WITHDRAWAL',
        'LOAN', 'LOAN_SHORT', 'LOAN_LONG',
        'WITHHOLDING', 'WHT_PAYABLE', 'ACCUM_DEPRECIATION',
    }
    SCOPE_SPLIT_ROLES = {
        'REVENUE', 'REVENUE_CONTROL', 'COGS', 'COGS_CONTROL',
        'EXPENSE', 'DISCOUNT_GIVEN', 'DISCOUNT_RECEIVED',
        'FX_GAIN', 'FX_LOSS', 'DEPRECIATION_EXP',
        'BAD_DEBT', 'DELIVERY_FEES', 'VAT_INPUT', 'VAT_OUTPUT',
        'GRNI', 'SALARY_EXPENSE',
    }
    INVENTORY_NAME_KEYWORDS = (
        'stock', 'inventory', 'inventaire', 'marchandise',
        'matiere', 'matière', 'wip', 'work in progress', 'en cours',
        # Common GAAP/IFRS inventory line items by English name.
        'raw material', 'raw materials',
        'finished good', 'finished goods',
        'goods in transit', 'in transit',
        'work-in-process', 'work in process',
    )

    # PCG-family templates use SYSCOHADA-style code classes where digit 3 =
    # stocks (inventory), 6 = charges, 7 = produits. IFRS/GAAP use 3xxx for
    # Equity, 6xxx for various, 7xxx for income — completely different
    # semantics. The code-class heuristic must only fire for PCG-family.
    PCG_FAMILY_TEMPLATES = {'SYSCOHADA_REVISED', 'FRENCH_PCG', 'LEBANESE_PCN'}

    def _derive_scope_mode(self, account, template_key=None):
        """Resolve scope_mode for a template account by the same rules the
        live ChartOfAccount.scope_mode @property uses. Honors an explicit
        `scope_mode` key in the JSON when present (template author override).
        """
        explicit = (account.get('scope_mode') or '').strip().lower()
        if explicit in {'tenant_wide', 'branch_split', 'branch_located'}:
            return explicit
        role = (account.get('system_role') or '').upper()
        if role in self.SCOPE_LOCATED_ROLES:
            return 'branch_located'
        if role in self.SCOPE_TENANT_ROLES:
            return 'tenant_wide'
        if role in self.SCOPE_SPLIT_ROLES:
            return 'branch_split'
        # SYSCOHADA / code-prefix signals — only for PCG-family templates.
        # IFRS/GAAP use 3xxx for Equity, so the class-digit rule is wrong.
        if template_key in self.PCG_FAMILY_TEMPLATES:
            code = (account.get('code') or '').strip()
            if code:
                first = code[0]
                if first == '3':
                    return 'branch_located'
                if first in ('6', '7'):
                    return 'branch_split'
        # Name-keyword sniff for inventory-shaped accounts (template-agnostic)
        atype = (account.get('type') or '').upper()
        name = (account.get('name') or '').lower()
        if atype == 'ASSET' and any(kw in name for kw in self.INVENTORY_NAME_KEYWORDS):
            return 'branch_located'
        # Type fallback
        if atype in ('INCOME', 'EXPENSE'):
            return 'branch_split'
        if atype in ('LIABILITY', 'EQUITY'):
            return 'tenant_wide'
        return 'tenant_wide'

    def _flatten(self, items, parent_code=None, out=None):
        """Walk the nested JSON tree → flat list of dicts with parent_code."""
        if out is None:
            out = []
        for item in items:
            row = {k: v for k, v in item.items() if k != 'children'}
            if parent_code:
                row['parent_code'] = parent_code
            out.append(row)
            if 'children' in item:
                self._flatten(item['children'], item.get('code'), out)
        return out

    def _sync_template_accounts(self, template, accounts_tree):
        """Create/update normalized COATemplateAccount rows for this template.

        Wipes prior rows for the template and re-inserts (small templates
        ≤ 256 rows; reseed is rare, so the simpler implementation wins).
        """
        from apps.finance.models import COATemplateAccount
        flat = self._flatten(accounts_tree)
        # Drop existing rows so we don't accumulate stale codes when a seed
        # is edited to remove an account.
        COATemplateAccount.objects.filter(template=template).delete()
        rows = []
        for a in flat:
            scope = self._derive_scope_mode(a, template_key=template.key)
            rows.append(COATemplateAccount(
                template=template,
                code=a.get('code', '')[:20],
                name=(a.get('name') or '')[:200],
                type=(a.get('type') or 'ASSET').upper(),
                sub_type=(a.get('subType') or a.get('sub_type') or '')[:50],
                parent_code=a.get('parent_code'),
                system_role=a.get('system_role') or None,
                default_scope_mode=scope,
            ))
        COATemplateAccount.objects.bulk_create(rows, batch_size=200)
        return len(rows)

    def handle(self, *args, **options):
        from apps.finance.models import COATemplate

        seeds_dir = os.path.normpath(self.SEEDS_DIR)
        if not os.path.isdir(seeds_dir):
            self.stderr.write(self.style.ERROR(f"Seeds directory not found: {seeds_dir}"))
            return

        json_files = [f for f in os.listdir(seeds_dir) if f.endswith('.json')]
        if not json_files:
            self.stderr.write(self.style.WARNING("No JSON seed files found."))
            return

        self.stdout.write(f"\n📦 Loading {len(json_files)} COA template(s) from {seeds_dir}\n")

        for filename in sorted(json_files):
            filepath = os.path.join(seeds_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            key = data['key']
            account_count = self._count_accounts(data['accounts'])
            root_count = len(data['accounts'])

            template, created = COATemplate.objects.update_or_create(
                key=key,
                defaults={
                    'name': data['name'],
                    'description': data.get('description', ''),
                    'accounts': data['accounts'],
                    # Per-template code-numbering convention (drives the
                    # AccountForm's child-code suggestion). Empty dict when
                    # the seed didn't specify a rule — UI falls back to a
                    # placeholder hint only.
                    'numbering_rules': data.get('numbering_rules', {}),
                }
            )

            # Normalize the nested JSON tree into COATemplateAccount rows.
            # This populates default_scope_mode (tenant/split/located) so the
            # frontend AccountForm can default the Branch Scope dropdown
            # correctly when the user adds children under a template parent.
            normalized_count = self._sync_template_accounts(template, data['accounts'])

            status = 'Created' if created else 'Updated'
            self.stdout.write(
                f"  {'✅' if created else '🔄'} {status}: {template.name} "
                f"({account_count} accounts, {root_count} root classes, "
                f"{normalized_count} normalized)"
            )

        self.stdout.write(self.style.SUCCESS(f"\n✅ All templates loaded successfully.\n"))
