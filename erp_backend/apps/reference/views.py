"""
Reference Module Views
========================
REST API ViewSets for global reference data and org activation tables.

Endpoints:
  - /api/reference/countries/       → Global country list (read-only for users, CRUD for staff)
  - /api/reference/currencies/      → Global currency list (read-only for users, CRUD for staff)
  - /api/reference/country-currency-map/ → Country-currency mappings
  - /api/reference/org-countries/   → Org-scoped country activation
  - /api/reference/org-currencies/  → Org-scoped currency activation
"""
from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from erp.middleware import get_current_tenant_id

from .models import Country, Currency, CountryCurrencyMap, OrgCountry, OrgCurrency, SourcingCountry, City
from .serializers import (
    CountrySerializer, CountryListSerializer,
    CurrencySerializer, CurrencyListSerializer,
    CountryCurrencyMapSerializer,
    OrgCountrySerializer, OrgCountryWriteSerializer,
    OrgCurrencySerializer, OrgCurrencyWriteSerializer,
    SourcingCountrySerializer, SourcingCountryWriteSerializer,
    CitySerializer, CityListSerializer,
)


# =============================================================================
# GLOBAL REFERENCE VIEWSETS (SaaS-level)
# =============================================================================

class RefCountryViewSet(viewsets.ModelViewSet):
    """
    Global country master list.
    All authenticated users can read. Staff/Superuser can write.

    Supports:
      - ?search= (name, iso2, iso3)
      - ?region= (filter by region)
      - ?is_active= (filter by active status)
      - ?format=list (lightweight list serializer)
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Return flat list — countries are small dataset

    def get_queryset(self):
        qs = Country.objects.select_related('default_currency').all()

        # Filters
        region = self.request.query_params.get('region')
        if region:
            qs = qs.filter(region__iexact=region)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))

        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(iso2__iexact=search) |
                Q(iso3__iexact=search) |
                Q(phone_code__icontains=search)
            )

        return qs

    def get_serializer_class(self):
        if self.request.query_params.get('format') == 'list' or self.action == 'list':
            return CountryListSerializer
        return CountrySerializer

    def create(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)
        country = self.get_object()
        if OrgCountry.all_objects.filter(country=country).exists():
            return Response(
                {'error': 'Cannot delete country: it is enabled by one or more organizations.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='regions')
    def regions(self, request):
        """Return distinct regions for filter dropdowns."""
        regions = Country.objects.values_list('region', flat=True).distinct().order_by('region')
        return Response([r for r in regions if r])

    @action(detail=True, methods=['get'], url_path='detail')
    def full_detail(self, request, pk=None):
        """Return full country detail with CountrySerializer."""
        country = self.get_object()
        return Response(CountrySerializer(country).data)


class RefCurrencyViewSet(viewsets.ModelViewSet):
    """
    Global currency master list.
    All authenticated users can read. Staff/Superuser can write.

    Supports:
      - ?search= (code, name)
      - ?is_active= (filter by active status)
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = Currency.objects.all()

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))

        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(code__icontains=search) |
                Q(name__icontains=search)
            )

        return qs

    def get_serializer_class(self):
        if self.request.query_params.get('format') == 'list' or self.action == 'list':
            return CurrencyListSerializer
        return CurrencySerializer

    def create(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)
        currency = self.get_object()
        if OrgCurrency.all_objects.filter(currency=currency).exists():
            return Response(
                {'error': 'Cannot delete currency: it is enabled by one or more organizations.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class RefCountryCurrencyMapViewSet(viewsets.ModelViewSet):
    """
    Country-currency mapping list.
    Read-only for regular users. CRUD for staff.
    """
    queryset = CountryCurrencyMap.objects.select_related('country', 'currency').all()
    serializer_class = CountryCurrencyMapSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        country_id = self.request.query_params.get('country_id')
        if country_id:
            qs = qs.filter(country_id=country_id)
        currency_id = self.request.query_params.get('currency_id')
        if currency_id:
            qs = qs.filter(currency_id=currency_id)
        return qs

    def create(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


# =============================================================================
# ORGANIZATION ACTIVATION VIEWSETS (Tenant-scoped)
# =============================================================================

class OrgCountryViewSet(viewsets.ModelViewSet):
    """
    Organization country activation.
    Tenant-scoped: shows only the current org's enabled countries.

    Actions:
      - POST /set-default/ → set a country as org default
      - POST /bulk-enable/ → enable multiple countries at once
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return OrgCountry.objects.none()
        return OrgCountry.all_objects.select_related(
            'country', 'country__default_currency'
        ).filter(
            organization_id=organization_id
        )

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return OrgCountryWriteSerializer
        return OrgCountrySerializer

    def perform_create(self, serializer):
        organization_id = get_current_tenant_id()
        serializer.save(organization_id=organization_id)

    @action(detail=False, methods=['post'], url_path='set-default')
    def set_default(self, request):
        """Set a country as the org's default. Unsets all others."""
        organization_id = get_current_tenant_id()
        country_id = request.data.get('country_id')
        if not country_id:
            return Response({'error': 'country_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            org_country = OrgCountry.all_objects.get(
                organization_id=organization_id,
                country_id=country_id,
            )
        except OrgCountry.DoesNotExist:
            return Response({'error': 'Country is not enabled for this organization'}, status=status.HTTP_404_NOT_FOUND)

        org_country.is_default = True
        org_country.is_enabled = True
        org_country.save()  # save() handles unsetting other defaults

        return Response(OrgCountrySerializer(org_country).data)

    @action(detail=False, methods=['post'], url_path='bulk-enable')
    def bulk_enable(self, request):
        """Enable multiple countries at once. Expects: { country_ids: [1, 2, 3] }"""
        organization_id = get_current_tenant_id()
        country_ids = request.data.get('country_ids', [])

        if not country_ids or not isinstance(country_ids, list):
            return Response({'error': 'country_ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        countries = Country.objects.filter(id__in=country_ids, is_active=True)
        created = []
        for country in countries:
            org_country, was_created = OrgCountry.all_objects.get_or_create(
                organization_id=organization_id,
                country=country,
                defaults={'is_enabled': True, 'display_order': 0}
            )
            if was_created:
                created.append(org_country)
            elif not org_country.is_enabled:
                org_country.is_enabled = True
                org_country.save(update_fields=['is_enabled'])

        return Response({
            'message': f'{len(created)} countries enabled',
            'enabled': OrgCountrySerializer(created, many=True).data,
        })


class OrgCurrencyViewSet(viewsets.ModelViewSet):
    """
    Organization currency activation.
    Tenant-scoped: shows only the current org's enabled currencies.

    Actions:
      - POST /set-default/ → set a currency as org base/default
      - POST /bulk-enable/ → enable multiple currencies at once
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return OrgCurrency.objects.none()
        return OrgCurrency.all_objects.select_related('currency').filter(
            organization_id=organization_id
        )

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return OrgCurrencyWriteSerializer
        return OrgCurrencySerializer

    def perform_create(self, serializer):
        organization_id = get_current_tenant_id()
        serializer.save(organization_id=organization_id)

    def destroy(self, request, *args, **kwargs):
        """Prevent deleting the default currency."""
        org_currency = self.get_object()
        if org_currency.is_default:
            return Response(
                {'error': 'Cannot disable the base currency. Change the default first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'], url_path='set-default')
    def set_default(self, request):
        """Set a currency as the org's base/default. Unsets all others."""
        organization_id = get_current_tenant_id()
        currency_id = request.data.get('currency_id')
        if not currency_id:
            return Response({'error': 'currency_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            org_currency = OrgCurrency.all_objects.get(
                organization_id=organization_id,
                currency_id=currency_id,
            )
        except OrgCurrency.DoesNotExist:
            return Response({'error': 'Currency is not enabled for this organization'}, status=status.HTTP_404_NOT_FOUND)

        org_currency.is_default = True
        org_currency.is_enabled = True
        org_currency.save()  # save() handles unsetting other defaults

        return Response(OrgCurrencySerializer(org_currency).data)

    @action(detail=False, methods=['post'], url_path='bulk-enable')
    def bulk_enable(self, request):
        """Enable multiple currencies at once. Expects: { currency_ids: [1, 2, 3] }"""
        organization_id = get_current_tenant_id()
        currency_ids = request.data.get('currency_ids', [])

        if not currency_ids or not isinstance(currency_ids, list):
            return Response({'error': 'currency_ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        currencies = Currency.objects.filter(id__in=currency_ids, is_active=True)
        created = []
        for currency in currencies:
            org_currency, was_created = OrgCurrency.all_objects.get_or_create(
                organization_id=organization_id,
                currency=currency,
                defaults={
                    'is_enabled': True,
                    'is_transaction_currency': True,
                    'display_order': 0,
                }
            )
            if was_created:
                created.append(org_currency)
            elif not org_currency.is_enabled:
                org_currency.is_enabled = True
                org_currency.save(update_fields=['is_enabled'])

        return Response({
            'message': f'{len(created)} currencies enabled',
            'enabled': OrgCurrencySerializer(created, many=True).data,
        })


class SourcingCountryViewSet(viewsets.ModelViewSet):
    """
    Sourcing country management — countries the org imports/sources products from.
    Tenant-scoped. Separate from OrgCountry (operational countries).

    Actions:
      - POST /bulk-enable/ → enable multiple sourcing countries at once
      - DELETE /{id}/ → remove a sourcing country
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return SourcingCountry.objects.none()
        return SourcingCountry.all_objects.select_related(
            'country', 'country__default_currency'
        ).filter(
            organization_id=organization_id
        )

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return SourcingCountryWriteSerializer
        return SourcingCountrySerializer

    def perform_create(self, serializer):
        organization_id = get_current_tenant_id()
        serializer.save(organization_id=organization_id)

    @action(detail=False, methods=['post'], url_path='bulk-enable')
    def bulk_enable(self, request):
        """Enable multiple sourcing countries at once. Expects: { country_ids: [1, 2, 3] }"""
        organization_id = get_current_tenant_id()
        country_ids = request.data.get('country_ids', [])

        if not country_ids or not isinstance(country_ids, list):
            return Response({'error': 'country_ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        countries = Country.objects.filter(id__in=country_ids, is_active=True)
        created = []
        for country in countries:
            sc, was_created = SourcingCountry.all_objects.get_or_create(
                organization_id=organization_id,
                country=country,
                defaults={'is_enabled': True, 'display_order': 0}
            )
            if was_created:
                created.append(sc)
            elif not sc.is_enabled:
                sc.is_enabled = True
                sc.save(update_fields=['is_enabled'])

        return Response({
            'message': f'{len(created)} sourcing countries enabled',
            'enabled': SourcingCountrySerializer(created, many=True).data,
        })

    @action(detail=False, methods=['post'], url_path='bulk-disable')
    def bulk_disable(self, request):
        """Disable multiple sourcing countries at once. Expects: { country_ids: [1, 2, 3] }"""
        organization_id = get_current_tenant_id()
        country_ids = request.data.get('country_ids', [])

        if not country_ids or not isinstance(country_ids, list):
            return Response({'error': 'country_ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        deleted, _ = SourcingCountry.all_objects.filter(
            organization_id=organization_id,
            country_id__in=country_ids,
        ).delete()

        return Response({'message': f'{deleted} sourcing countries removed'})


class RefCityViewSet(viewsets.ModelViewSet):
    """
    Global city reference list.
    All authenticated users can read. Staff/Superuser can write.

    Supports:
      - ?country= (filter by country ID — required for dropdown usage)
      - ?search= (filter by city name)
      - ?active_only= (default true)
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = City.objects.select_related('country').all()

        country_id = self.request.query_params.get('country')
        if country_id:
            qs = qs.filter(country_id=country_id)

        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(state_province__icontains=search)
            )

        active_only = self.request.query_params.get('active_only', 'true')
        if active_only.lower() in ('true', '1'):
            qs = qs.filter(is_active=True)

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return CityListSerializer
        return CitySerializer

    def create(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

