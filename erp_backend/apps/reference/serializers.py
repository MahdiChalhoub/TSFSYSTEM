"""
Reference Module Serializers
==============================
Read/write serializers for global reference data and org activation tables.
"""
from rest_framework import serializers
from .models import Country, Currency, CountryCurrencyMap, OrgCountry, OrgCurrency, SourcingCountry, City


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

