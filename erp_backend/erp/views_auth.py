from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.throttling import AnonRateThrottle
from .serializers_auth import LoginSerializer, UserSerializer


class LoginThrottle(AnonRateThrottle):
    """Custom throttle for login attempts - 5/minute."""
    rate = '5/minute'
    scope = 'login'


class RegisterThrottle(AnonRateThrottle):
    """Custom throttle for registration attempts - 3/minute."""
    rate = '3/minute'
    scope = 'register'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login_view(request):
    """
    Authenticate user and return token.
    Rate limited: 5 attempts per minute.
    """
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

