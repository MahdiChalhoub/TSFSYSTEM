import pyotp
import logging
from django.db import transaction
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes, authentication_classes
from .throttles import LoginRateThrottle, RegisterRateThrottle
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from .models import BusinessType, GlobalCurrency, Organization, User, SaaSClient, Role
from .serializers.auth import LoginSerializer, UserSerializer, BusinessRegistrationSerializer
from .serializers.core import BusinessTypeSerializer, GlobalCurrencySerializer, OrganizationSerializer
from .services import ProvisioningService

from django.contrib.auth.forms import PasswordResetForm
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth import get_user_model
from django.core.mail import send_mail

logger = logging.getLogger('erp')

@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])  # No CSRF for public login endpoint
@throttle_classes([LoginRateThrottle])
def login_view(request):
    try:
        # ── 2FA Challenge Resolution (Step 2) ────────────────────────────────────
        challenge_id = request.data.get('challenge_id')
        if challenge_id:
            return _resolve_2fa_challenge(request, challenge_id)

        # ── Normal Login (Step 1) ────────────────────────────────────────────────
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        scope_access = serializer.validated_data.get('scope_access', 'internal')

        # ── 2FA Challenge ────────────────────────────────────────────────────────
        if user.is_2fa_enabled:
            otp_token = request.data.get('otp_token')
            if not otp_token:
                # Store credentials server-side, return only a challenge ID
                import uuid
                from django.core.cache import cache
                cid = str(uuid.uuid4())
                cache.set(f'2fa:{cid}', {
                    'user_id': str(user.pk),
                    'scope_access': scope_access,
                }, timeout=300)  # 5 minute TTL
                return Response({
                    "two_factor_required": True,
                    "challenge_id": cid,
                    "message": "Two-factor authentication is enabled on this account."
                }, status=status.HTTP_200_OK)
            
            totp = pyotp.TOTP(user.two_factor_secret)
            if not totp.verify(otp_token):
                return Response({"error": "Invalid 2FA token"}, status=status.HTTP_400_BAD_REQUEST)

        # Token rotation: delete all old tokens then create fresh
        # Use explicit delete + create to avoid DRF's get_or_create race condition
        Token.objects.filter(user=user).delete()
        try:
            token = Token.objects.create(user=user)
        except Exception:
            # Handle race condition: if create fails, try get_or_create
            token, _ = Token.objects.get_or_create(user=user)
        
        # Store scope access for this specific token to enable strict backend enforcement
        from django.core.cache import cache
        cache.set(f'token_scope:{token.key}', scope_access, timeout=60 * 60 * 24 * 7) # 1 week

        return Response({
            'token': token.key,
            'user': UserSerializer(user).data,
            'scope_access': scope_access,
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

def _resolve_2fa_challenge(request, challenge_id):
    """
    Resolves a 2FA challenge using server-side cached credentials.
    The password never leaves the server — only the challenge_id is exchanged.
    """
    from django.core.cache import cache
    
    otp_token = request.data.get('otp_token')
    if not otp_token:
        return Response({"error": "OTP token is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Retrieve cached challenge
    cache_key = f'2fa:{challenge_id}'
    challenge_data = cache.get(cache_key)
    
    if not challenge_data:
        return Response(
            {"error": "2FA challenge expired or invalid. Please log in again."},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        user = User.objects.get(pk=challenge_data['user_id'])
    except User.DoesNotExist:
        cache.delete(cache_key)
        return Response({"error": "User not found"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Verify OTP
    totp = pyotp.TOTP(user.two_factor_secret)
    if not totp.verify(otp_token):
        return Response({"error": "Invalid 2FA token"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Clean up challenge (one-time use)
    cache.delete(cache_key)
    
    # Issue token (with rotation)
    Token.objects.filter(user=user).delete()
    try:
        token = Token.objects.create(user=user)
    except Exception:
        token, _ = Token.objects.get_or_create(user=user)
    
    scope_access = challenge_data.get('scope_access', 'internal')
    
    # Store scope access for this specific token
    from django.core.cache import cache
    cache.set(f'token_scope:{token.key}', scope_access, timeout=60 * 60 * 24 * 7) # 1 week

    return Response({
        'token': token.key,
        'user': UserSerializer(user).data,
        'scope_access': scope_access,
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
@authentication_classes([])  # No CSRF for public registration
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
                registration_status='PENDING',
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
        root_domain = getattr(settings, 'ROOT_DOMAIN', 'localhost')
        # Use absolute URL to ensure correct subdomain redirect from root domain
        login_url = f"https://{slug}.{root_domain}/login"
        
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


# ── Password Reset (Forgot Password) ────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])  # No CSRF for public password reset
@throttle_classes([LoginRateThrottle])
def password_reset_request_view(request):
    """
    Step 1: User submits email. We generate a reset token.
    Token is logged server-side for dev/demo. In production, integrate email sending.
    """
    email = request.data.get('email')
    if not email:
        return Response({"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    users = User.objects.filter(email=email, is_active=True)
    if users.exists():
        for user in users:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            
            # Construct tenant-aware link
            root_domain = getattr(settings, 'ROOT_DOMAIN', 'localhost')
            if user.organization and user.organization.slug != 'saas':
                reset_link = f"https://{user.organization.slug}.{root_domain}/reset-password?uid={uid}&token={token}"
            else:
                # Fallback for saas-admin or unassigned users (use base domain)
                reset_link = f"https://{root_domain}/reset-password?uid={uid}&token={token}"
                
            subject = "Password Reset Request"
            message = (
                f"Hello {user.first_name or user.username},\n\n"
                f"We received a request to reset your password. Click the link below to set a new password:\n\n"
                f"{reset_link}\n\n"
                f"If you did not request this, please ignore this email.\n\n"
                f"Thanks,\nThe Team"
            )
            html_message = (
                f"<p>Hello <strong>{user.first_name or user.username}</strong>,</p>"
                f"<p>We received a request to reset your password. Click the link below to set a new password:</p>"
                f"<p><a href='{reset_link}' style='display:inline-block;padding:10px 20px;background:#10b981;color:white;text-decoration:none;border-radius:5px;'>Reset Password</a></p>"
                f"<p>Alternatively, copy and paste this link into your browser:<br><a href='{reset_link}'>{reset_link}</a></p>"
                f"<p>If you did not request this, please ignore this email.</p>"
            )
            
            try:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@example.com'),
                    recipient_list=[user.email],
                    html_message=html_message,
                    fail_silently=False,
                )
                logger.info(f"[AUTH] Password reset email dispatched to {email}.")
            except Exception as e:
                # Log the error but do not crash the API or expose failure to the client
                logger.error(f"[AUTH] Failed to send password reset email to {email}: {e}")
    
    # Always return identical response to prevent email enumeration
    return Response({
        "message": "If an account exists with this email, you will receive reset instructions."
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])  # No CSRF for public password reset confirm
def password_reset_confirm_view(request):
    """
    Step 2: User submits uid, token, and new password.
    """
    uidb64 = request.data.get('uid')
    token = request.data.get('token')
    new_password = request.data.get('new_password')

    if not (uidb64 and token and new_password):
        return Response({"error": "UID, token, and new password are required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and default_token_generator.check_token(user, token):
        user.set_password(new_password)
        user.save()
        return Response({"message": "Password has been reset successfully."}, status=status.HTTP_200_OK)
    else:
        return Response({"error": "The reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)


# ── Two-Factor Authentication (2FA) ──────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def setup_2fa_view(request):
    """
    Step 1: Generate a secret and return provisioning data.
    """
    user = request.user
    if user.is_2fa_enabled:
        return Response({"error": "2FA is already enabled"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Generate new secret if not already present or if re-setting up
    secret = pyotp.random_base32()
    user.two_factor_secret = secret
    user.save(update_fields=['two_factor_secret'])
    
    otp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=user.email,
        issuer_name=getattr(settings, 'PLATFORM_NAME', 'BlancEngine')
    )
    
    return Response({
        "secret": secret,
        "otp_uri": otp_uri
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_2fa_setup_view(request):
    """
    Step 2: Verify the initial token and enable 2FA officially.
    """
    token = request.data.get('token')
    if not token:
        return Response({"error": "Verification token is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    user = request.user
    if not user.two_factor_secret:
        return Response({"error": "2FA setup not initiated"}, status=status.HTTP_400_BAD_REQUEST)
    
    totp = pyotp.TOTP(user.two_factor_secret)
    if totp.verify(token):
        user.is_2fa_enabled = True
        user.save(update_fields=['is_2fa_enabled'])
        return Response({"message": "2FA has been successfully enabled."})
    else:
        return Response({"error": "Invalid token. Please try again."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disable_2fa_view(request):
    """
    Disable 2FA. Requires valid token if active.
    """
    user = request.user
    if not user.is_2fa_enabled:
         return Response({"error": "2FA is not enabled"}, status=status.HTTP_400_BAD_REQUEST)

    token = request.data.get('token')
    if not token:
        return Response({"error": "Verification token required to disable 2FA"}, status=status.HTTP_400_BAD_REQUEST)
    
    totp = pyotp.TOTP(user.two_factor_secret)
    if totp.verify(token):
        user.is_2fa_enabled = False
        user.two_factor_secret = None
        user.save(update_fields=['is_2fa_enabled', 'two_factor_secret'])
        return Response({"message": "2FA has been disabled."})
    else:
        return Response({"error": "Invalid token. Security check failed."}, status=status.HTTP_400_BAD_REQUEST)
