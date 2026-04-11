"""
Supplier Gate — Registration & Authentication Views

Supplier self-registration creates a PortalApprovalRequest.
Access is NOT granted until admin approves and links to a Contact.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle


class RegisterThrottle(AnonRateThrottle):
    rate = '3/minute'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterThrottle])
def supplier_register(request):
    """
    Public supplier self-registration.
    Creates User + PortalApprovalRequest (NOT direct access).

    POST /api/supplier-gate/register/
    {
        "email": "...",
        "password": "...",
        "first_name": "...",
        "last_name": "...",
        "company_name": "...",
        "phone": "...",
        "tax_id": "...",      (optional)
        "website": "..."      (optional)
    }
    """
    from apps.iam.services.registration import register_supplier
    from erp.models import Organization, User

    email = request.data.get('email', '').strip()
    password = request.data.get('password', '')
    first_name = request.data.get('first_name', '').strip()
    last_name = request.data.get('last_name', '').strip()
    company_name = request.data.get('company_name', '').strip()
    phone = request.data.get('phone', '').strip()

    if not email or not password or not company_name:
        return Response(
            {'error': 'Email, password, and company name are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(password) < 8:
        return Response({'error': 'Password must be at least 8 characters'},
                        status=status.HTTP_400_BAD_REQUEST)

    org_id = getattr(request, 'tenant_id', None) or request.headers.get('X-Tenant-Id')
    if not org_id:
        return Response({'error': 'Organization context required'},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        return Response({'error': 'Invalid organization'},
                        status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(organization=organization, email__iexact=email).exists():
        return Response({'error': 'A user with this email already exists'},
                        status=status.HTTP_409_CONFLICT)

    # Collect extra supplier details for admin review
    submitted_data = {
        'tax_id': request.data.get('tax_id', ''),
        'website': request.data.get('website', ''),
    }

    try:
        user, approval_request = register_supplier(
            organization=organization,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            company_name=company_name,
            phone=phone,
            submitted_data=submitted_data,
        )
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({
        'message': 'Registration submitted. Your account is pending admin approval.',
        'request_id': approval_request.id,
        'status': approval_request.status,
    }, status=status.HTTP_201_CREATED)
