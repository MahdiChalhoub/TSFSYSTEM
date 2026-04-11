"""
Reference Module Admin Registration
=====================================
Registers global reference tables with Django Admin for SaaS-level management.
"""
from django.contrib import admin
from .models import Country, Currency, CountryCurrencyMap, OrgCountry, OrgCurrency


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('iso2', 'iso3', 'name', 'region', 'phone_code', 'default_currency', 'is_active')
    list_filter = ('region', 'is_active')
    search_fields = ('iso2', 'iso3', 'name', 'official_name', 'phone_code')
    ordering = ('name',)


@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'symbol', 'minor_unit', 'is_active')
    list_filter = ('is_active', 'minor_unit')
    search_fields = ('code', 'name')
    ordering = ('code',)


@admin.register(CountryCurrencyMap)
class CountryCurrencyMapAdmin(admin.ModelAdmin):
    list_display = ('country', 'currency', 'is_primary', 'is_active')
    list_filter = ('is_primary', 'is_active')
    raw_id_fields = ('country', 'currency')


@admin.register(OrgCountry)
class OrgCountryAdmin(admin.ModelAdmin):
    list_display = ('organization', 'country', 'is_enabled', 'is_default', 'display_order')
    list_filter = ('is_enabled', 'is_default')
    raw_id_fields = ('country',)


@admin.register(OrgCurrency)
class OrgCurrencyAdmin(admin.ModelAdmin):
    list_display = ('organization', 'currency', 'is_enabled', 'is_default', 'exchange_rate_source')
    list_filter = ('is_enabled', 'is_default', 'exchange_rate_source')
    raw_id_fields = ('currency',)
