import logging
from django.db import transaction
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from .throttles import LoginRateThrottle, RegisterRateThrottle
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from .models import BusinessType, GlobalCurrency, Organization, User, SaaSClient, Role
from .serializers.auth import LoginSerializer, UserSerializer, BusinessRegistrationSerializer
from .serializers.core import BusinessTypeSerializer, GlobalCurrencySerializer, OrganizationSerializer
from .services import ProvisioningService

logger = logging.getLogger('erp')

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_view(request):
    try:
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        scope_access = serializer.validated_data.get('scope_access', 'internal')
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data,
            'scope_access': scope_access,  # 'official' or 'internal'
        })
    except Exception as e:
        # DRF's raise_exception=True handles ValidationError → 400 JSON automatically.
        # This outer catch is for truly unexpected errors (DB issues, serializer crashes, etc.)
        # that would otherwise produce an HTML 500 page when DEBUG=False.
        from rest_framework.exceptions import APIException, ValidationError as DRFValidationError
        if isinstance(e, (APIException, DRFValidationError)):
            raise  # Let DRF handle its own exceptions (returns JSON)
        import traceback
        logger.error(f"[LOGIN] Unhandled error: {e}\n{traceback.format_exc()}")
        return Response(
            {"error": "Login failed due to a server error. Please try again."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

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
@throttle_classes([RegisterRateThrottle])
def register_business_view(request):
    """
    Public endpoint for self-service business registration.
    Creates: Organization, Admin User, SaaSClient, CRM Contact.
    """
    serializer = BusinessRegistrationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    data = serializer.validated_data
    slug = data['business_slug']

    try:
        with transaction.atomic():
            # ── 1. Provision Organization ──
            org = ProvisioningService.provision_organization(
                name=data['business_name'],
                slug=slug
            )

            # Update org fields from registration form
            org.country = data.get('country', '')
            org.city = data.get('city', '')
            org.address = data.get('address', '')
            org.state = data.get('state', '')
            org.zip_code = data.get('zip_code', '')
            org.phone = data.get('phone', '')
            org.business_email = data.get('email', '')
            org.website = data.get('website', '')
            org.timezone = data.get('timezone', 'UTC')

            # Set Industry Vector (BusinessType)
            bt_id = data.get('business_type_id')
            if bt_id:
                from erp.models import BusinessType
                try:
                    org.business_type = BusinessType.objects.get(pk=bt_id)
                except BusinessType.DoesNotExist:
                    pass

            # Set Monetary Standard (Currency)
            cur_id = data.get('currency_id')
            if cur_id:
                from erp.models import GlobalCurrency
                try:
                    org.base_currency = GlobalCurrency.objects.get(pk=cur_id)
                except GlobalCurrency.DoesNotExist:
                    pass

            org.save()

            # ── 2. Create SaaSClient (account owner) ──
            client, _ = SaaSClient.objects.get_or_create(
                email=data['admin_email'],
                defaults={
                    'first_name': data['admin_first_name'],
                    'last_name': data['admin_last_name'],
                    'company_name': data['business_name'],
                    'phone': data.get('phone', ''),
                    'city': data.get('city', ''),
                    'country': data.get('country', ''),
                }
            )
            org.client = client
            org.save(update_fields=['client'])

            # ── 3. Create Admin User ──
            # Get or create "Admin" role for the new org
            admin_role, _ = Role.objects.get_or_create(
                name='Admin',
                organization=org,
                defaults={'description': 'Full access administrator'}
            )

            admin_user = User(
                username=data['admin_username'],
                email=data['admin_email'],
                first_name=data['admin_first_name'],
                last_name=data['admin_last_name'],
                organization=org,
                role=admin_role,
                is_active=True,
                registration_status='APPROVED',
            )
            admin_user.set_password(data['admin_password'])
            admin_user.save()

        # ── 4. Post-transaction: CRM Sync (best-effort) ──
        try:
            client.sync_to_crm_contact()
        except Exception as e:
            logger.warning(f"CRM sync failed for new business '{slug}': {e}")

        logger.info(f"✅ Business registered: '{data['business_name']}' [{slug}] by {data['admin_username']}")

        token, _ = Token.objects.get_or_create(user=admin_user)
        login_url = f"/{slug}/login"
        return Response({
            "message": f"Workspace '{slug}' created successfully!",
            "login_url": login_url,
            "token": token.key,
            "user": UserSerializer(admin_user).data,
            "organization": OrganizationSerializer(org).data
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"Business registration failed for '{slug}': {e}\n{error_traceback}")
        return Response(
            {"error": str(e), "traceback": error_traceback if settings.DEBUG else None},
            status=status.HTTP_400_BAD_REQUEST
        )
