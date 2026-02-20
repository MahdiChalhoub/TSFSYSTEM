from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from erp.models import (
    Organization, Site, Role, Country, GlobalCurrency, BusinessType,
    SystemModule, OrganizationModule
)
from erp.module_manager import ModuleManager
from decimal import Decimal


class Command(BaseCommand):
    help = 'Seeds the core engine with all required bootstrap data (idempotent)'

    def handle(self, *args, **options):
        self.stdout.write("🌱 Starting Core Seed...")

        # ─── 1. Countries ─────────────────────────────────────────────────
        countries = [
            {'code': 'LB', 'name': 'Lebanon'},
            {'code': 'US', 'name': 'United States'},
            {'code': 'FR', 'name': 'France'},
            {'code': 'TR', 'name': 'Turkey'},
            {'code': 'CN', 'name': 'China'},
            {'code': 'GB', 'name': 'United Kingdom'},
            {'code': 'DE', 'name': 'Germany'},
            {'code': 'AE', 'name': 'United Arab Emirates'},
            {'code': 'SA', 'name': 'Saudi Arabia'},
            {'code': 'EG', 'name': 'Egypt'},
            {'code': 'JO', 'name': 'Jordan'},
            {'code': 'IQ', 'name': 'Iraq'},
            {'code': 'KW', 'name': 'Kuwait'},
            {'code': 'QA', 'name': 'Qatar'},
            {'code': 'BH', 'name': 'Bahrain'},
            {'code': 'OM', 'name': 'Oman'},
            {'code': 'CA', 'name': 'Canada'},
            {'code': 'AU', 'name': 'Australia'},
            {'code': 'IN', 'name': 'India'},
            {'code': 'BR', 'name': 'Brazil'},
        ]
        for c in countries:
            Country.objects.get_or_create(
                code=c['code'],
                defaults={'name': c['name']}
            )
        self.stdout.write(f"🌍 Countries: {len(countries)} seeded")

        # ─── 2. Global Currencies ─────────────────────────────────────────
        currencies = [
            {'code': 'USD', 'symbol': '$',    'name': 'US Dollar'},
            {'code': 'EUR', 'symbol': '€',    'name': 'Euro'},
            {'code': 'GBP', 'symbol': '£',    'name': 'British Pound'},
            {'code': 'LBP', 'symbol': 'ل.ل',  'name': 'Lebanese Pound'},
            {'code': 'AED', 'symbol': 'د.إ',  'name': 'UAE Dirham'},
            {'code': 'TRY', 'symbol': '₺',    'name': 'Turkish Lira'},
            {'code': 'SAR', 'symbol': '﷼',    'name': 'Saudi Riyal'},
            {'code': 'CNY', 'symbol': '¥',    'name': 'Chinese Yuan'},
        ]
        for cur in currencies:
            GlobalCurrency.objects.get_or_create(
                code=cur['code'],
                defaults={'name': cur['name'], 'symbol': cur['symbol']}
            )
        self.stdout.write(f"💰 Currencies: {len(currencies)} seeded")

        # ─── 3. Business Types ────────────────────────────────────────────
        business_types = [
            {'slug': 'retail',        'name': 'Retail & E-Commerce'},
            {'slug': 'restaurant',    'name': 'Restaurant & Food Service'},
            {'slug': 'manufacturing', 'name': 'Manufacturing'},
            {'slug': 'wholesale',     'name': 'Wholesale & Distribution'},
            {'slug': 'services',      'name': 'Professional Services'},
            {'slug': 'healthcare',    'name': 'Healthcare'},
            {'slug': 'construction',  'name': 'Construction'},
            {'slug': 'technology',    'name': 'Technology'},
            {'slug': 'education',     'name': 'Education'},
            {'slug': 'other',         'name': 'Other'},
        ]
        for bt in business_types:
            BusinessType.objects.get_or_create(
                slug=bt['slug'],
                defaults={'name': bt['name']}
            )
        self.stdout.write(f"🏭 Business Types: {len(business_types)} seeded")

        # ─── 4. SaaS Root Organization + Default Site ─────────────────────
        saas_org, created = Organization.objects.get_or_create(
            slug='saas',
            defaults={
                'name': 'SAAS',
                'is_active': True,
            }
        )
        self.stdout.write(f"🏢 SaaS Org: {'Created' if created else 'Exists'} (ID: {saas_org.id})")

        # Every org must have at least one site — including SaaS
        Site.objects.get_or_create(
            organization=saas_org,
            code='SAAS-HQ',
            defaults={
                'name': 'SaaS Platform',
                'is_active': True,
            }
        )
        self.stdout.write("📍 SaaS Site: ensured")

        # SaaS Admin Role
        Role.objects.get_or_create(
            name='Super Admin',
            organization=saas_org,
            defaults={'description': 'Full platform administration access'}
        )
        self.stdout.write("🔑 SaaS Admin Role: ensured")

        # ─── 5. Subscription Plans ────────────────────────────────────────
        from erp.models import PlanCategory, SubscriptionPlan

        cat, _ = PlanCategory.objects.get_or_create(
            name='SaaS Plans',
            defaults={'type': 'subscription'}
        )

        plans = [
            {
                'name': 'Starter',
                'description': 'Free tier for small businesses getting started.',
                'monthly_price': Decimal('0.00'),
                'annual_price': Decimal('0.00'),
                'modules': ['core', 'inventory', 'pos'],
                'features': {},
                'limits': {'max_users': 2, 'max_sites': 1, 'max_products': 100},
                'sort_order': 1,
                'trial_days': 0,
            },
            {
                'name': 'Growth',
                'description': 'For growing businesses that need more power.',
                'monthly_price': Decimal('29.00'),
                'annual_price': Decimal('290.00'),
                'modules': ['core', 'inventory', 'pos', 'finance', 'crm'],
                'features': {},
                'limits': {'max_users': 10, 'max_sites': 3, 'max_products': 5000},
                'sort_order': 2,
                'trial_days': 14,
            },
            {
                'name': 'Enterprise',
                'description': 'Unlimited power for large-scale operations.',
                'monthly_price': Decimal('99.00'),
                'annual_price': Decimal('990.00'),
                'modules': ['core', 'inventory', 'pos', 'finance', 'crm', 'hr', 'client_portal', 'supplier_portal'],
                'features': {},
                'limits': {'max_users': -1, 'max_sites': -1, 'max_products': -1},
                'sort_order': 3,
                'trial_days': 14,
            },
        ]
        for p in plans:
            SubscriptionPlan.objects.get_or_create(
                category=cat,
                name=p['name'],
                defaults={
                    'description': p['description'],
                    'monthly_price': p['monthly_price'],
                    'annual_price': p['annual_price'],
                    'modules': p['modules'],
                    'features': p['features'],
                    'limits': p['limits'],
                    'sort_order': p['sort_order'],
                    'trial_days': p['trial_days'],
                    'is_active': True,
                    'is_public': True,
                }
            )
        self.stdout.write(f"📋 Plans: {len(plans)} seeded")

        # ─── 5b. Super Ultimate Plan (private, unlimited — SaaS only) ────
        super_plan, sp_created = SubscriptionPlan.objects.get_or_create(
            category=cat,
            name='Super Ultimate',
            defaults={
                'description': 'Private unlimited plan for the SaaS platform owner. All modules, no limits.',
                'monthly_price': Decimal('0.00'),
                'annual_price': Decimal('0.00'),
                'modules': [],  # Will be filled dynamically below
                'features': {},
                'limits': {
                    'max_users': -1,
                    'max_sites': -1,
                    'max_products': -1,
                    'max_storage_mb': -1,
                    'max_invoices': -1,
                },
                'sort_order': 0,
                'trial_days': 0,
                'is_active': True,
                'is_public': False,  # Private — not shown on pricing page
            }
        )
        self.stdout.write(f"👑 Super Ultimate Plan: {'Created' if sp_created else 'Exists'}")

        # ─── 6. Synchronize Module Registry ───────────────────────────────
        self.stdout.write("📦 Synchronizing Global Module Registry...")
        modules = ModuleManager.sync()
        self.stdout.write(f"✅ Registered {len(modules)} modules from filesystem")

        # ─── 6b. Update Super Ultimate plan with ALL module codes ─────────
        all_module_codes = list(SystemModule.objects.values_list('name', flat=True))
        super_plan.modules = all_module_codes
        super_plan.save(update_fields=['modules'])

        # ─── 6c. Assign Super Ultimate plan to SaaS org ──────────────────
        if not saas_org.current_plan or saas_org.current_plan.name != 'Super Ultimate':
            saas_org.current_plan = super_plan
            saas_org.save(update_fields=['current_plan'])
            self.stdout.write("👑 SaaS Org: assigned Super Ultimate plan")

        # ─── 6d. Grant ALL modules to SaaS org ───────────────────────────
        for sm in SystemModule.objects.all():
            OrganizationModule.objects.get_or_create(
                organization=saas_org,
                module_name=sm.name,
                defaults={'is_enabled': True}
            )
        self.stdout.write(f"🔧 SaaS Org: {SystemModule.objects.count()} modules granted")

        # ─── 7. Auto-Link Orphan Superusers ───────────────────────────────
        User = get_user_model()
        superusers = User.objects.filter(is_superuser=True, organization__isnull=True)
        count = 0
        for su in superusers:
            su.organization = saas_org
            su.save(update_fields=['organization'])
            count += 1
        if count > 0:
            self.stdout.write(f"🔗 Linked {count} orphan superuser(s) to SaaS Org")

        self.stdout.write(self.style.SUCCESS("✅ Seed Complete!"))
