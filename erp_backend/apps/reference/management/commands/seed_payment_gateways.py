"""
Management command to seed the PaymentGateway catalog.
Idempotent — uses get_or_create on gateway code.

Usage:
    python manage.py seed_payment_gateways
"""
from django.core.management.base import BaseCommand
from apps.reference.models import PaymentGateway, Country


GATEWAYS = [
    # ── Global providers ──
    {
        'code': 'stripe', 'name': 'Stripe', 'provider_family': 'stripe',
        'logo_emoji': '💳', 'color': '#635bff', 'is_global': True, 'sort_order': 1,
        'description': 'Accept cards, wallets, and bank transfers worldwide',
        'website_url': 'https://stripe.com',
        'config_schema': [
            {'key': 'api_key', 'label': 'Secret Key', 'type': 'password', 'placeholder': 'sk_live_...', 'required': True},
            {'key': 'publishable_key', 'label': 'Publishable Key', 'type': 'text', 'placeholder': 'pk_live_...'},
            {'key': 'webhook_secret', 'label': 'Webhook Secret', 'type': 'password', 'placeholder': 'whsec_...'},
        ],
    },
    {
        'code': 'paypal', 'name': 'PayPal', 'provider_family': 'paypal',
        'logo_emoji': '🅿️', 'color': '#003087', 'is_global': True, 'sort_order': 2,
        'description': 'PayPal checkout and payment processing',
        'website_url': 'https://developer.paypal.com',
        'config_schema': [
            {'key': 'client_id', 'label': 'Client ID', 'type': 'text', 'required': True},
            {'key': 'client_secret', 'label': 'Client Secret', 'type': 'password', 'required': True},
            {'key': 'mode', 'label': 'Mode', 'type': 'select', 'options': [
                {'value': 'sandbox', 'label': 'Sandbox'}, {'value': 'live', 'label': 'Live'},
            ]},
        ],
    },
    {
        'code': 'square', 'name': 'Square', 'provider_family': 'square',
        'logo_emoji': '⬜', 'color': '#006aff', 'is_global': True, 'sort_order': 3,
        'description': 'Square POS and online payments',
        'website_url': 'https://squareup.com',
        'config_schema': [
            {'key': 'access_token', 'label': 'Access Token', 'type': 'password', 'required': True},
            {'key': 'location_id', 'label': 'Location ID', 'type': 'text'},
            {'key': 'environment', 'label': 'Environment', 'type': 'select', 'options': [
                {'value': 'sandbox', 'label': 'Sandbox'}, {'value': 'production', 'label': 'Production'},
            ]},
        ],
    },
    {
        'code': 'wise', 'name': 'Wise (TransferWise)', 'provider_family': 'wise',
        'logo_emoji': '🌐', 'color': '#9fe870', 'is_global': True, 'sort_order': 4,
        'description': 'International transfers at real exchange rates',
        'website_url': 'https://wise.com',
        'config_schema': [
            {'key': 'api_key', 'label': 'API Token', 'type': 'password', 'required': True},
            {'key': 'profile_id', 'label': 'Profile ID', 'type': 'text'},
        ],
    },

    # ── West Africa ──
    {
        'code': 'wave_ci', 'name': 'Wave (Côte d\'Ivoire)', 'provider_family': 'wave',
        'logo_emoji': '🌊', 'color': '#1dc7ea', 'sort_order': 10,
        'description': 'Wave mobile money — Côte d\'Ivoire',
        'website_url': 'https://wave.com',
        'countries_iso2': ['CI'],
        'config_schema': [
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
            {'key': 'business_id', 'label': 'Business ID', 'type': 'text'},
            {'key': 'webhook_url', 'label': 'Webhook URL', 'type': 'text', 'placeholder': 'https://...'},
        ],
    },
    {
        'code': 'wave_sn', 'name': 'Wave (Sénégal)', 'provider_family': 'wave',
        'logo_emoji': '🌊', 'color': '#1dc7ea', 'sort_order': 11,
        'description': 'Wave mobile money — Sénégal',
        'countries_iso2': ['SN'],
        'config_schema': [
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
            {'key': 'business_id', 'label': 'Business ID', 'type': 'text'},
        ],
    },
    {
        'code': 'wave_ml', 'name': 'Wave (Mali)', 'provider_family': 'wave',
        'logo_emoji': '🌊', 'color': '#1dc7ea', 'sort_order': 12,
        'description': 'Wave mobile money — Mali',
        'countries_iso2': ['ML'],
        'config_schema': [
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
            {'key': 'business_id', 'label': 'Business ID', 'type': 'text'},
        ],
    },
    {
        'code': 'orange_money_ci', 'name': 'Orange Money (Côte d\'Ivoire)', 'provider_family': 'orange_money',
        'logo_emoji': '🍊', 'color': '#ff6600', 'sort_order': 15,
        'description': 'Orange Money mobile payments — Côte d\'Ivoire',
        'countries_iso2': ['CI'],
        'config_schema': [
            {'key': 'merchant_id', 'label': 'Merchant ID', 'type': 'text', 'required': True},
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
        ],
    },
    {
        'code': 'orange_money_sn', 'name': 'Orange Money (Sénégal)', 'provider_family': 'orange_money',
        'logo_emoji': '🍊', 'color': '#ff6600', 'sort_order': 16,
        'description': 'Orange Money mobile payments — Sénégal',
        'countries_iso2': ['SN'],
        'config_schema': [
            {'key': 'merchant_id', 'label': 'Merchant ID', 'type': 'text', 'required': True},
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
        ],
    },
    {
        'code': 'orange_money_cm', 'name': 'Orange Money (Cameroun)', 'provider_family': 'orange_money',
        'logo_emoji': '🍊', 'color': '#ff6600', 'sort_order': 17,
        'description': 'Orange Money mobile payments — Cameroun',
        'countries_iso2': ['CM'],
        'config_schema': [
            {'key': 'merchant_id', 'label': 'Merchant ID', 'type': 'text', 'required': True},
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
        ],
    },
    {
        'code': 'mtn_momo_ci', 'name': 'MTN MoMo (Côte d\'Ivoire)', 'provider_family': 'mtn_momo',
        'logo_emoji': '📱', 'color': '#ffcc00', 'sort_order': 20,
        'description': 'MTN Mobile Money — Côte d\'Ivoire',
        'countries_iso2': ['CI'],
        'config_schema': [
            {'key': 'subscription_key', 'label': 'Subscription Key', 'type': 'password', 'required': True},
            {'key': 'api_user', 'label': 'API User', 'type': 'text', 'required': True},
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
        ],
    },
    {
        'code': 'mtn_momo_gh', 'name': 'MTN MoMo (Ghana)', 'provider_family': 'mtn_momo',
        'logo_emoji': '📱', 'color': '#ffcc00', 'sort_order': 21,
        'description': 'MTN Mobile Money — Ghana',
        'countries_iso2': ['GH'],
        'config_schema': [
            {'key': 'subscription_key', 'label': 'Subscription Key', 'type': 'password', 'required': True},
            {'key': 'api_user', 'label': 'API User', 'type': 'text', 'required': True},
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
        ],
    },
    {
        'code': 'mtn_momo_ug', 'name': 'MTN MoMo (Uganda)', 'provider_family': 'mtn_momo',
        'logo_emoji': '📱', 'color': '#ffcc00', 'sort_order': 22,
        'description': 'MTN Mobile Money — Uganda',
        'countries_iso2': ['UG'],
        'config_schema': [
            {'key': 'subscription_key', 'label': 'Subscription Key', 'type': 'password', 'required': True},
            {'key': 'api_user', 'label': 'API User', 'type': 'text', 'required': True},
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
        ],
    },
    {
        'code': 'moov_money_ci', 'name': 'Moov Money (Côte d\'Ivoire)', 'provider_family': 'moov_money',
        'logo_emoji': '📲', 'color': '#0066cc', 'sort_order': 25,
        'description': 'Moov Africa mobile money — Côte d\'Ivoire',
        'countries_iso2': ['CI'],
        'config_schema': [
            {'key': 'merchant_id', 'label': 'Merchant ID', 'type': 'text', 'required': True},
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
        ],
    },

    # ── East Africa ──
    {
        'code': 'mpesa_ke', 'name': 'M-Pesa (Kenya)', 'provider_family': 'mpesa',
        'logo_emoji': '📱', 'color': '#4caf50', 'sort_order': 30,
        'description': 'Safaricom M-Pesa — Kenya',
        'countries_iso2': ['KE'],
        'config_schema': [
            {'key': 'consumer_key', 'label': 'Consumer Key', 'type': 'text', 'required': True},
            {'key': 'consumer_secret', 'label': 'Consumer Secret', 'type': 'password', 'required': True},
            {'key': 'shortcode', 'label': 'Business Shortcode', 'type': 'text', 'required': True},
            {'key': 'passkey', 'label': 'Passkey', 'type': 'password'},
        ],
    },
    {
        'code': 'mpesa_tz', 'name': 'M-Pesa (Tanzania)', 'provider_family': 'mpesa',
        'logo_emoji': '📱', 'color': '#4caf50', 'sort_order': 31,
        'description': 'Vodacom M-Pesa — Tanzania',
        'countries_iso2': ['TZ'],
        'config_schema': [
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
            {'key': 'public_key', 'label': 'Public Key', 'type': 'text', 'required': True},
        ],
    },

    # ── North Africa / Middle East ──
    {
        'code': 'flouci_tn', 'name': 'Flouci (Tunisia)', 'provider_family': 'flouci',
        'logo_emoji': '🇹🇳', 'color': '#e63946', 'sort_order': 35,
        'description': 'Flouci online payments — Tunisia',
        'countries_iso2': ['TN'],
        'config_schema': [
            {'key': 'app_token', 'label': 'App Token', 'type': 'password', 'required': True},
            {'key': 'app_secret', 'label': 'App Secret', 'type': 'password', 'required': True},
        ],
    },

    # ── Pan-African aggregators ──
    {
        'code': 'flutterwave', 'name': 'Flutterwave', 'provider_family': 'flutterwave',
        'logo_emoji': '🦋', 'color': '#f5a623', 'sort_order': 40,
        'description': 'Pan-African payments — cards, mobile money, bank transfers',
        'website_url': 'https://flutterwave.com',
        'countries_iso2': ['NG', 'GH', 'KE', 'ZA', 'CI', 'CM', 'TZ', 'UG', 'SN'],
        'config_schema': [
            {'key': 'secret_key', 'label': 'Secret Key', 'type': 'password', 'required': True},
            {'key': 'public_key', 'label': 'Public Key', 'type': 'text'},
            {'key': 'encryption_key', 'label': 'Encryption Key', 'type': 'password'},
        ],
    },
    {
        'code': 'paystack', 'name': 'Paystack', 'provider_family': 'paystack',
        'logo_emoji': '💎', 'color': '#00c3f7', 'sort_order': 41,
        'description': 'Payments for Africa — cards, bank, USSD',
        'website_url': 'https://paystack.com',
        'countries_iso2': ['NG', 'GH', 'ZA', 'KE'],
        'config_schema': [
            {'key': 'secret_key', 'label': 'Secret Key', 'type': 'password', 'required': True},
            {'key': 'public_key', 'label': 'Public Key', 'type': 'text'},
        ],
    },
    {
        'code': 'chipper_cash', 'name': 'Chipper Cash', 'provider_family': 'chipper',
        'logo_emoji': '💸', 'color': '#6c5ce7', 'sort_order': 42,
        'description': 'Cross-border payments across Africa',
        'countries_iso2': ['NG', 'GH', 'KE', 'UG', 'TZ', 'ZA'],
        'config_schema': [
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
            {'key': 'webhook_secret', 'label': 'Webhook Secret', 'type': 'password'},
        ],
    },

    # ── Europe / Americas ──
    {
        'code': 'mollie', 'name': 'Mollie', 'provider_family': 'mollie',
        'logo_emoji': '🐟', 'color': '#0a0b0d', 'sort_order': 50,
        'description': 'European payments — iDEAL, Bancontact, credit cards',
        'website_url': 'https://mollie.com',
        'countries_iso2': ['NL', 'BE', 'DE', 'FR', 'AT'],
        'config_schema': [
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
        ],
    },
    {
        'code': 'adyen', 'name': 'Adyen', 'provider_family': 'adyen',
        'logo_emoji': '🔷', 'color': '#0abf53', 'is_global': True, 'sort_order': 51,
        'description': 'Enterprise payments platform',
        'website_url': 'https://adyen.com',
        'config_schema': [
            {'key': 'api_key', 'label': 'API Key', 'type': 'password', 'required': True},
            {'key': 'merchant_account', 'label': 'Merchant Account', 'type': 'text', 'required': True},
            {'key': 'environment', 'label': 'Environment', 'type': 'select', 'options': [
                {'value': 'test', 'label': 'Test'}, {'value': 'live', 'label': 'Live'},
            ]},
        ],
    },

    # ── Always-available: Custom API ──
    {
        'code': 'custom_api', 'name': 'Custom API', 'provider_family': 'custom',
        'logo_emoji': '🔌', 'color': '#64748b', 'is_global': True, 'sort_order': 999,
        'description': 'Connect any REST API-based payment provider',
        'config_schema': [
            {'key': 'base_url', 'label': 'Base URL', 'type': 'text', 'placeholder': 'https://api.provider.com/v1', 'required': True},
            {'key': 'api_key', 'label': 'API Key', 'type': 'password'},
            {'key': 'headers', 'label': 'Custom Headers (JSON)', 'type': 'text', 'placeholder': '{"Authorization": "Bearer ..."}'},
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed the PaymentGateway global catalog (idempotent)'

    def handle(self, *args, **options):
        created = 0
        updated = 0

        for gw_data in GATEWAYS:
            country_codes = gw_data.pop('countries_iso2', [])
            code = gw_data['code']

            obj, was_created = PaymentGateway.objects.update_or_create(
                code=code,
                defaults={k: v for k, v in gw_data.items() if k != 'code'},
            )

            # Assign country M2M
            if country_codes:
                countries = Country.objects.filter(iso2__in=country_codes)
                obj.countries.set(countries)

            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(
            f'✅ Payment gateways: {created} created, {updated} updated ({len(GATEWAYS)} total)'
        ))
