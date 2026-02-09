from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from .models import BusinessType, GlobalCurrency, Organization, SaaSClient, User, Role
from .serializers.auth import LoginSerializer, UserSerializer, BusinessRegistrationSerializer
from .serializers.core import BusinessTypeSerializer, GlobalCurrencySerializer, OrganizationSerializer
from .services import ProvisioningService
from django.db import transaction

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

@api_view(['POST'])
@permission_classes([AllowAny])
def business_registration_view(request):
    serializer = BusinessRegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    
    with transaction.atomic():
        # 1. Provision Organization
        org = ProvisioningService.provision_organization(
            name=data['business_name'],
            slug=data['business_slug']
        )
        
        # 2. Create SaaSClient (Billing Contact)
        client, created = SaaSClient.objects.get_or_create(
            email=data['admin_email'],
            defaults={
                'first_name': data['admin_first_name'],
                'last_name': data['admin_last_name'],
                'company_name': data['business_name'],
                'phone': data.get('phone', ''),
                'city': data.get('city', ''),
                'country': data.get('country', ''),
                'address': data.get('address', ''),
            }
        )
        org.client = client
        org.save(update_fields=['client'])
        
        # 3. Create Admin User
        user = User(
            username=data['admin_username'],
            email=data['admin_email'],
            first_name=data['admin_first_name'],
            last_name=data['admin_last_name'],
            organization=org,
            is_active=True,
            registration_status='APPROVED'
        )
        user.set_password(data['admin_password'])
        user.save()
        
        # 4. Sync client to CRM
        client.sync_to_crm_contact()
        
    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'user': UserSerializer(user).data,
        'organization': OrganizationSerializer(org).data
    }, status=status.HTTP_201_CREATED)
