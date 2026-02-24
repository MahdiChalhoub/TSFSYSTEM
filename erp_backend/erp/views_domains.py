"""
Custom Domain API Views
=======================
Provides CRUD + verification + resolution endpoints for custom domains.

Endpoints:
  GET    /api/domains/                → List org's custom domains
  POST   /api/domains/                → Add a new custom domain
  GET    /api/domains/<id>/           → Get domain details
  DELETE /api/domains/<id>/           → Remove a custom domain
  POST   /api/domains/<id>/verify/    → Verify DNS TXT record
  GET    /api/domains/resolve/?domain=shop.acme.com → Resolve domain → org slug (public, no auth)
"""
import dns.resolver
import logging
from datetime import timezone as tz

from django.utils import timezone
from rest_framework import serializers, viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models_domains import CustomDomain

logger = logging.getLogger(__name__)


# ─── Serializers ─────────────────────────────────────────────────────────────

class CustomDomainSerializer(serializers.ModelSerializer):
    txt_record_name = serializers.SerializerMethodField()
    txt_record_value = serializers.SerializerMethodField()
    organization_slug = serializers.CharField(source='organization.slug', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = CustomDomain
        fields = [
            'id', 'domain', 'domain_type', 'organization', 'organization_slug', 'organization_name',
            'is_verified', 'verification_token', 'txt_record_name', 'txt_record_value',
            'ssl_status', 'is_active', 'is_primary',
            'created_at', 'updated_at', 'verified_at', 'ssl_provisioned_at',
        ]
        read_only_fields = [
            'id', 'is_verified', 'verification_token', 'ssl_status',
            'is_active', 'created_at', 'updated_at', 'verified_at', 'ssl_provisioned_at',
        ]

    def get_txt_record_name(self, obj):
        return obj.get_txt_record_name()

    def get_txt_record_value(self, obj):
        return obj.verification_token


class DomainResolveSerializer(serializers.Serializer):
    """Response serializer for domain resolution."""
    domain = serializers.CharField()
    slug = serializers.CharField()
    domain_type = serializers.CharField()
    organization_name = serializers.CharField()


# ─── ViewSet ─────────────────────────────────────────────────────────────────

class CustomDomainViewSet(viewsets.ModelViewSet):
    """
    CRUD for custom domains.
    Scoped to the user's organization (tenant isolation).
    """
    serializer_class = CustomDomainSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        org_id = getattr(self.request, 'organization_id', None)
        if org_id:
            return CustomDomain.objects.filter(organization_id=org_id)
        # Superusers can see all
        if self.request.user.is_superuser:
            return CustomDomain.objects.all()
        return CustomDomain.objects.none()

    def perform_create(self, serializer):
        org_id = getattr(self.request, 'organization_id', None)
        if not org_id:
            raise serializers.ValidationError("No organization context found.")

        domain = serializer.validated_data.get('domain', '').lower().strip()

        # Validation: block platform subdomains
        root_domain = 'tsf.ci'
        if domain.endswith(f'.{root_domain}') or domain == root_domain:
            raise serializers.ValidationError(
                f"Cannot use {root_domain} subdomains as custom domains."
            )

        # Validation: block common reserved domains
        reserved = ['localhost', '127.0.0.1', 'example.com', 'test.com']
        if any(domain.endswith(r) for r in reserved):
            raise serializers.ValidationError("This domain is reserved and cannot be used.")

        # Check limit (max 5 custom domains per org)
        existing_count = CustomDomain.objects.filter(organization_id=org_id).count()
        if existing_count >= 5:
            raise serializers.ValidationError(
                "Maximum of 5 custom domains per organization. Remove one to add another."
            )

        instance = serializer.save(organization_id=org_id)
        logger.info(f"[DOMAIN] Added: {domain} → org={org_id} type={instance.domain_type}")

    @action(detail=True, methods=['post'], url_path='verify')
    def verify_dns(self, request, pk=None):
        """
        Verify that the domain has the correct DNS TXT record.
        Queries DNS for _tsf-verification.{domain} TXT record.
        """
        domain_obj = self.get_object()

        if domain_obj.is_verified:
            return Response(
                {'status': 'already_verified', 'message': 'Domain is already verified.'},
                status=status.HTTP_200_OK
            )

        txt_name = domain_obj.get_txt_record_name()
        expected_value = domain_obj.verification_token

        try:
            answers = dns.resolver.resolve(txt_name, 'TXT')
            for rdata in answers:
                txt_value = rdata.to_text().strip('"').strip()
                if txt_value == expected_value:
                    domain_obj.is_verified = True
                    domain_obj.verified_at = timezone.now()
                    # Auto-activate if we bypass SSL for now
                    domain_obj.ssl_status = 'ACTIVE'
                    domain_obj.ssl_provisioned_at = timezone.now()
                    domain_obj.is_active = True
                    domain_obj.save()
                    logger.info(f"[DOMAIN] Verified: {domain_obj.domain}")
                    return Response({
                        'status': 'verified',
                        'message': f'Domain {domain_obj.domain} verified successfully!',
                        'domain': CustomDomainSerializer(domain_obj).data,
                    })

            # TXT records found but no match
            return Response({
                'status': 'not_found',
                'message': f'TXT record found but value does not match.',
                'expected_name': txt_name,
                'expected_value': expected_value,
            }, status=status.HTTP_400_BAD_REQUEST)

        except dns.resolver.NXDOMAIN:
            return Response({
                'status': 'nxdomain',
                'message': f'No DNS records found for {txt_name}. Add the TXT record first.',
                'expected_name': txt_name,
                'expected_value': expected_value,
            }, status=status.HTTP_400_BAD_REQUEST)

        except dns.resolver.NoAnswer:
            return Response({
                'status': 'no_answer',
                'message': f'DNS responded but no TXT records found for {txt_name}.',
                'expected_name': txt_name,
                'expected_value': expected_value,
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"[DOMAIN] DNS verification error for {domain_obj.domain}: {e}")
            return Response({
                'status': 'error',
                'message': f'DNS lookup failed: {str(e)}',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='set-primary')
    def set_primary(self, request, pk=None):
        """Set this domain as the primary for its org+type combo."""
        domain_obj = self.get_object()
        if not domain_obj.is_active:
            return Response(
                {'error': 'Domain must be active before it can be set as primary.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Unset any existing primary of same type
        CustomDomain.objects.filter(
            organization=domain_obj.organization,
            domain_type=domain_obj.domain_type,
            is_primary=True,
        ).update(is_primary=False)

        domain_obj.is_primary = True
        domain_obj.save()
        return Response({
            'status': 'ok',
            'message': f'{domain_obj.domain} is now the primary {domain_obj.domain_type} domain.',
        })


# ─── Public Resolution Endpoint ──────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def resolve_custom_domain(request):
    """
    Public endpoint to resolve a custom domain to an organization slug.
    Used by the Next.js middleware to route traffic.

    GET /api/domains/resolve/?domain=shop.acme.com
    Returns: { slug, domain_type, organization_name } or 404
    """
    domain = request.GET.get('domain', '').lower().strip()
    if not domain:
        return Response({'error': 'domain parameter required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        domain_obj = CustomDomain.objects.select_related('organization').get(
            domain=domain,
            is_active=True,
        )
        return Response({
            'domain': domain_obj.domain,
            'slug': domain_obj.organization.slug,
            'domain_type': domain_obj.domain_type,
            'organization_name': domain_obj.organization.name,
        })
    except CustomDomain.DoesNotExist:
        return Response({'error': 'Domain not found or not active'}, status=status.HTTP_404_NOT_FOUND)
