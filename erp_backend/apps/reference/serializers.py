"""
Reference Module Serializers
==============================
Read/write serializers for global reference data and org activation tables.
"""
from rest_framework import serializers
from .models import (
    Country, Currency, CountryCurrencyMap, CountryLanguageMap,
    OrgCountry, OrgCurrency,
    SourcingCountry, City, PaymentGateway, OrgPaymentGateway,
)


# =============================================================================
# GLOBAL REFERENCE SERIALIZERS (Read-only for regular users)
# =============================================================================

class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = [
            'id', 'code', 'numeric_code', 'name', 'symbol',
            'minor_unit', 'is_active',
        ]


class CurrencyListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dropdowns and selection lists."""
    class Meta:
        model = Currency
        fields = ['id', 'code', 'name', 'symbol', 'minor_unit']


class CountrySerializer(serializers.ModelSerializer):
    default_currency_code = serializers.CharField(
        source='default_currency.code', read_only=True, default=None
    )
    default_currency_symbol = serializers.CharField(
        source='default_currency.symbol', read_only=True, default=None
    )

    class Meta:
        model = Country
        fields = [
            'id', 'iso2', 'iso3', 'numeric_code', 'name', 'official_name',
            'phone_code', 'region', 'subregion',
            'default_currency', 'default_currency_code', 'default_currency_symbol',
            'is_active',
        ]


class CountryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dropdowns and selection lists."""
    default_currency_code = serializers.CharField(
        source='default_currency.code', read_only=True, default=None
    )

    class Meta:
        model = Country
        fields = [
            'id', 'iso2', 'name', 'phone_code',
            'default_currency', 'default_currency_code',
        ]


class CountryCurrencyMapSerializer(serializers.ModelSerializer):
    country_iso2 = serializers.CharField(source='country.iso2', read_only=True)
    country_name = serializers.CharField(source='country.name', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    currency_name = serializers.CharField(source='currency.name', read_only=True)

    class Meta:
        model = CountryCurrencyMap
        fields = [
            'id', 'country', 'currency',
            'country_iso2', 'country_name',
            'currency_code', 'currency_name',
            'is_primary', 'is_active',
        ]


class CountryLanguageMapSerializer(serializers.ModelSerializer):
    """Read+write serializer for the country↔language association.
    `language_code` is a free-form ISO 639-1 string — no FK to a Language
    master table since the catalogue lives on the frontend (LOCALES)."""
    country_iso2 = serializers.CharField(source='country.iso2', read_only=True)
    country_name = serializers.CharField(source='country.name', read_only=True)

    class Meta:
        model = CountryLanguageMap
        fields = [
            'id', 'country', 'language_code',
            'country_iso2', 'country_name',
            'is_default', 'is_active',
        ]
        read_only_fields = ['id']


# =============================================================================
# ORGANIZATION ACTIVATION SERIALIZERS (Tenant-scoped)
# =============================================================================

class OrgCountrySerializer(serializers.ModelSerializer):
    """Read serializer with nested country details."""
    country_iso2 = serializers.CharField(source='country.iso2', read_only=True)
    country_iso3 = serializers.CharField(source='country.iso3', read_only=True)
    country_name = serializers.CharField(source='country.name', read_only=True)
    country_phone_code = serializers.CharField(source='country.phone_code', read_only=True)
    country_region = serializers.CharField(source='country.region', read_only=True)
    default_currency_code = serializers.CharField(
        source='country.default_currency.code', read_only=True, default=None
    )

    class Meta:
        model = OrgCountry
        fields = [
            'id', 'country', 'is_enabled', 'is_default', 'display_order',
            'country_iso2', 'country_iso3', 'country_name',
            'country_phone_code', 'country_region', 'default_currency_code',
        ]
        read_only_fields = ['id']


class OrgCountryWriteSerializer(serializers.ModelSerializer):
    """Write serializer for enabling/disabling countries."""
    class Meta:
        model = OrgCountry
        fields = ['country', 'is_enabled', 'is_default', 'display_order']


class OrgCurrencySerializer(serializers.ModelSerializer):
    """Read serializer with nested currency details."""
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    currency_name = serializers.CharField(source='currency.name', read_only=True)
    currency_symbol = serializers.CharField(source='currency.symbol', read_only=True)
    currency_minor_unit = serializers.IntegerField(source='currency.minor_unit', read_only=True)

    class Meta:
        model = OrgCurrency
        fields = [
            'id', 'currency', 'is_enabled', 'is_default', 'display_order',
            'exchange_rate_source', 'is_reporting_currency', 'is_transaction_currency',
            'enabled_in_country_ids',
            'currency_code', 'currency_name', 'currency_symbol', 'currency_minor_unit',
        ]
        read_only_fields = ['id']


class OrgCurrencyWriteSerializer(serializers.ModelSerializer):
    """Write serializer for enabling/disabling currencies."""
    class Meta:
        model = OrgCurrency
        fields = [
            'currency', 'is_enabled', 'is_default', 'display_order',
            'exchange_rate_source', 'is_reporting_currency', 'is_transaction_currency',
            'enabled_in_country_ids',
        ]


# =============================================================================
# SOURCING COUNTRY SERIALIZERS (Tenant-scoped)
# =============================================================================

class SourcingCountrySerializer(serializers.ModelSerializer):
    """Read serializer with nested country details."""
    country_iso2 = serializers.CharField(source='country.iso2', read_only=True)
    country_iso3 = serializers.CharField(source='country.iso3', read_only=True)
    country_name = serializers.CharField(source='country.name', read_only=True)
    country_region = serializers.CharField(source='country.region', read_only=True)
    default_currency_code = serializers.CharField(
        source='country.default_currency.code', read_only=True, default=None
    )

    class Meta:
        model = SourcingCountry
        fields = [
            'id', 'country', 'is_enabled', 'notes', 'display_order',
            'country_iso2', 'country_iso3', 'country_name',
            'country_region', 'default_currency_code',
        ]
        read_only_fields = ['id']


class SourcingCountryWriteSerializer(serializers.ModelSerializer):
    """Write serializer for enabling/disabling sourcing countries."""
    class Meta:
        model = SourcingCountry
        fields = ['country', 'is_enabled', 'notes', 'display_order']


# =============================================================================
# CITY SERIALIZERS (Global reference, filterable by country)
# =============================================================================

class CitySerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.name', read_only=True, default=None)
    country_iso2 = serializers.CharField(source='country.iso2', read_only=True, default=None)

    class Meta:
        model = City
        fields = [
            'id', 'country', 'name', 'state_province',
            'is_capital', 'is_active',
            'country_name', 'country_iso2',
        ]


class CityListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dropdowns."""
    class Meta:
        model = City
        fields = ['id', 'name', 'state_province', 'is_capital']


# =============================================================================
# PAYMENT GATEWAY SERIALIZERS
# =============================================================================

class PaymentGatewaySerializer(serializers.ModelSerializer):
    """SaaS-admin serializer for the global payment gateway catalog.

    Reads/writes the catalog. `country_codes` is the wire format for the
    `countries` M2M — a list of ISO2 strings ('CI', 'SN', ...) — so the
    frontend never needs to know Country PKs.
    """
    country_codes = serializers.ListField(
        child=serializers.CharField(max_length=2),
        required=False, allow_empty=True,
    )

    class Meta:
        model = PaymentGateway
        fields = [
            'id', 'code', 'name', 'provider_family', 'logo_emoji', 'color',
            'description', 'is_global', 'country_codes', 'config_schema',
            'website_url', 'is_active', 'sort_order',
        ]

    def to_representation(self, obj):
        rep = super().to_representation(obj)
        rep['country_codes'] = list(obj.countries.values_list('iso2', flat=True))
        return rep

    def _set_countries(self, instance, codes):
        if codes is None:
            return
        codes_upper = [c.strip().upper() for c in codes if c and c.strip()]
        if not codes_upper:
            instance.countries.clear()
            return
        countries = list(Country.objects.filter(iso2__in=codes_upper))
        instance.countries.set(countries)

    def create(self, validated_data):
        codes = validated_data.pop('country_codes', None)
        instance = super().create(validated_data)
        self._set_countries(instance, codes)
        return instance

    def update(self, instance, validated_data):
        codes = validated_data.pop('country_codes', None)
        instance = super().update(instance, validated_data)
        if codes is not None:
            self._set_countries(instance, codes)
        return instance


class OrgPaymentGatewaySerializer(serializers.ModelSerializer):
    """Tenant-scoped serializer for activated payment gateways."""
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    gateway_code = serializers.CharField(source='gateway.code', read_only=True)
    gateway_name = serializers.CharField(source='gateway.name', read_only=True)
    gateway_emoji = serializers.CharField(source='gateway.logo_emoji', read_only=True)
    gateway_color = serializers.CharField(source='gateway.color', read_only=True)
    gateway_description = serializers.CharField(source='gateway.description', read_only=True)
    gateway_family = serializers.CharField(source='gateway.provider_family', read_only=True)
    config_schema = serializers.JSONField(source='gateway.config_schema', read_only=True)
    website_url = serializers.URLField(source='gateway.website_url', read_only=True)

    class Meta:
        model = OrgPaymentGateway
        fields = [
            'id', 'gateway', 'gateway_code', 'gateway_name', 'gateway_emoji',
            'gateway_color', 'gateway_description', 'gateway_family',
            'config_schema', 'website_url',
            'is_enabled', 'display_order', 'default_config',
            'organization',
        ]
        read_only_fields = ['organization']

