from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from .models import BusinessType, GlobalCurrency, Organization
from .serializers.auth import LoginSerializer, UserSerializer
from .serializers.core import BusinessTypeSerializer, GlobalCurrencySerializer, OrganizationSerializer

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
