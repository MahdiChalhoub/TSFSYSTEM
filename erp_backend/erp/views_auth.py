import logging
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from .models import BusinessType, GlobalCurrency, Organization, User, SaaSClient, Role
from .serializers.auth import LoginSerializer, UserSerializer
from .serializers.core import BusinessTypeSerializer, GlobalCurrencySerializer, OrganizationSerializer
from .services import ProvisioningService

logger = logging.getLogger('erp')

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    token, created = Token.objects.get_or_create(user=user)
    
    return Response({
        'token': token.key,
        'user': UserSerializer(user).data
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    # Simply delete the token to force a login
    try:
        request.user.auth_token.delete()
    except (AttributeError, Token.DoesNotExist):
        pass
    return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

class PublicConfigView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        business_types = BusinessType.objects.all()
        currencies = GlobalCurrency.objects.all()
        
        # Optionally get tenant config if slug provided
        tenant_data = {}
        slug = request.query_params.get('tenant')
        if slug:
            try:
                org = Organization.objects.get(slug=slug)
                tenant_data = OrganizationSerializer(org).data
            except Organization.DoesNotExist:
                pass

        return Response({
            "business_types": BusinessTypeSerializer(business_types, many=True).data,
            "currencies": GlobalCurrencySerializer(currencies, many=True).data,
            "tenant": tenant_data
        })


# ── Business Registration (Public) ──────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def register_business_view(request):
    """
    Public endpoint for self-service business registration.
    Creates: Organization, Admin User, SaaSClient, CRM Contact.
    
    Expects FormData with:
      - business_name, slug (required)
      - business_type_id, currency_id
      - email, phone, address, city, state, zip_code, country, website, timezone
      - admin_first_name, admin_last_name, admin_username, admin_email, admin_password (required)
    """
    data = request.data

    # ── Validate required fields ──
    required = {
        'business_name': data.get('business_name', '').strip(),
        'slug': data.get('slug', '').strip().lower(),
        'admin_username': data.get('admin_username', '').strip(),
        'admin_email': data.get('admin_email', '').strip(),
        'admin_password': data.get('admin_password', ''),
    }

    errors = {}
    for field, val in required.items():
        if not val:
            errors[field] = [f"{field.replace('_', ' ').title()} is required."]
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    slug = required['slug']

    # ── Validate slug format ──
    import re
    if not re.match(r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?$', slug):
        return Response(
            {"slug": ["Slug must contain only lowercase letters, numbers, and hyphens."]},
            status=status.HTTP_400_BAD_REQUEST
        )

    if slug in ('saas', 'admin', 'api', 'www', 'app', 'mail', 'smtp', 'ftp'):
        return Response(
            {"slug": ["This slug is reserved and cannot be used."]},
            status=status.HTTP_400_BAD_REQUEST
        )

    # ── Check slug availability ──
    if Organization.objects.filter(slug=slug).exists():
        return Response(
            {"slug": [f"The workspace '{slug}' is already taken."]},
            status=status.HTTP_400_BAD_REQUEST
        )

    # ── Password validation ──
    password = required['admin_password']
    if len(password) < 8:
        return Response(
            {"admin_password": ["Password must be at least 8 characters."]},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        with transaction.atomic():
            # ── 1. Provision Organization ──
            org = ProvisioningService.provision_organization(
                name=required['business_name'],
                slug=slug
            )

            # Update optional org fields
            optional_fields = {}
            field_map = {
                'email': 'business_email',
                'phone': 'phone',
                'address': 'address',
                'city': 'city',
                'country': 'country',
                'timezone': 'timezone',
            }
            for form_field, model_field in field_map.items():
                val = data.get(form_field, '').strip()
                if val:
                    optional_fields[model_field] = val

            if optional_fields:
                for k, v in optional_fields.items():
                    setattr(org, k, v)
                org.save(update_fields=list(optional_fields.keys()))

            # Set business type if provided
            bt_id = data.get('business_type_id')
            if bt_id:
                try:
                    bt = BusinessType.objects.get(id=bt_id)
                    org.business_type = bt
                    org.save(update_fields=['business_type'])
                except BusinessType.DoesNotExist:
                    pass

            # ── 2. Create Admin User ──
            admin_first = data.get('admin_first_name', '').strip() or 'Admin'
            admin_last = data.get('admin_last_name', '').strip() or slug.title()

            # Get or create "Admin" role for the new org
            admin_role, _ = Role.objects.get_or_create(
                name='Admin',
                organization=org,
                defaults={'description': 'Full access administrator'}
            )

            admin_user = User(
                username=required['admin_username'],
                email=required['admin_email'],
                first_name=admin_first,
                last_name=admin_last,
                organization=org,
                role=admin_role,
                is_staff=False,
                is_active=True,
                registration_status='APPROVED',
            )
            admin_user.set_password(password)
            admin_user.save()

            # ── 3. Create SaaSClient (account owner) ──
            client_email = optional_fields.get('business_email', required['admin_email'])
            client_phone = optional_fields.get('phone', '')
            client_country = optional_fields.get('country', '')
            client_city = optional_fields.get('city', '')

            client, _ = SaaSClient.objects.get_or_create(
                email=client_email,
                defaults={
                    'first_name': admin_first,
                    'last_name': admin_last,
                    'company_name': required['business_name'],
                    'phone': client_phone,
                    'city': client_city,
                    'country': client_country,
                }
            )
            org.client = client
            org.save(update_fields=['client'])

        # ── 4. Post-transaction: CRM Sync (best-effort) ──
        try:
            client.sync_to_crm_contact()
        except Exception as e:
            logger.warning(f"CRM sync failed for new business '{slug}': {e}")

        logger.info(f"✅ Business registered: '{required['business_name']}' [{slug}] by {required['admin_username']}")

        return Response({
            "message": f"Workspace '{slug}' created successfully!",
            "login_url": f"/{slug}/login",
            "organization": {
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
            }
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"Business registration failed for '{slug}': {e}")
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
