"""
Reference Module URL Configuration
=====================================
Auto-discovered by the kernel URL engine (erp/urls.py dynamic module registration).

Mounted at:
  - /api/reference/countries/         (namespaced)
  - /api/reference/currencies/        (namespaced)
  - /api/reference/country-currency-map/
  - /api/reference/org-countries/
  - /api/reference/org-currencies/
  - /api/countries/                   (flat — backward compat)
  - /api/currencies/                  (flat — backward compat)
"""
from rest_framework.routers import DefaultRouter
from .views import (
    RefCountryViewSet, RefCurrencyViewSet, RefCountryCurrencyMapViewSet,
    OrgCountryViewSet, OrgCurrencyViewSet, SourcingCountryViewSet,
    RefCityViewSet, RefPaymentGatewayViewSet, OrgPaymentGatewayViewSet,
)

router = DefaultRouter()
router.register(r'countries', RefCountryViewSet, basename='ref-countries')
router.register(r'currencies', RefCurrencyViewSet, basename='ref-currencies')
router.register(r'country-currency-map', RefCountryCurrencyMapViewSet, basename='ref-ccmap')
router.register(r'org-countries', OrgCountryViewSet, basename='org-countries')
router.register(r'org-currencies', OrgCurrencyViewSet, basename='org-currencies')
router.register(r'sourcing-countries', SourcingCountryViewSet, basename='sourcing-countries')
router.register(r'cities', RefCityViewSet, basename='ref-cities')
router.register(r'payment-gateways', RefPaymentGatewayViewSet, basename='ref-payment-gateways')
router.register(r'org-payment-gateways', OrgPaymentGatewayViewSet, basename='org-payment-gateways')

urlpatterns = router.urls

