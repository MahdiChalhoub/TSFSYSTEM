"""
Client Gate — Registration & Authentication Views

Public endpoints for client self-registration and login.
These are UNAUTHENTICATED endpoints (for signup) or use portal guards (for data).
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from apps.iam.services import audit


class RegisterThrottle(AnonRateThrottle):
    rate = '3/minute'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterThrottle])
def client_register(request):
    """
    Public client self-registration.
    Auto-creates User + Contact + ContactPortalAccess.

    POST /api/client-gate/register/
    {
        "email": "...",
        "password": "...",
        "first_name": "...",
        "last_name": "...",
        "phone": "..."  (optional)
    }
    """
    from apps.iam.services.registration import register_client
    from erp.models import Organization

    email = request.data.get('email', '').strip()
    password = request.data.get('password', '')
    first_name = request.data.get('first_name', '').strip()
    last_name = request.data.get('last_name', '').strip()
    phone = request.data.get('phone', '').strip()

    if not email or not password:
        return Response({'error': 'Email and password are required'},
                        status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 8:
        return Response({'error': 'Password must be at least 8 characters'},
                        status=status.HTTP_400_BAD_REQUEST)

    # Resolve organization from tenant middleware
    org_id = getattr(request, 'tenant_id', None) or request.headers.get('X-Tenant-Id')
    if not org_id:
        return Response({'error': 'Organization context required'},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        return Response({'error': 'Invalid organization'},
                        status=status.HTTP_400_BAD_REQUEST)

    # Check duplicate email in this org
    from erp.models import User
    if User.objects.filter(organization=organization, email__iexact=email).exists():
        return Response({'error': 'A user with this email already exists'},
                        status=status.HTTP_409_CONFLICT)

    try:
        user, contact, access = register_client(
            organization=organization,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
        )
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Generate auth token
    from rest_framework.authtoken.models import Token
    token, _ = Token.objects.get_or_create(user=user)

    return Response({
        'token': token.key,
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
        },
        'contact': {
            'id': contact.id,
            'name': contact.name,
        },
        'portal_access': {
            'id': access.id,
            'status': access.status,
            'portal_type': access.portal_type,
        },
    }, status=status.HTTP_201_CREATED)
