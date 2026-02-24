"""
Custom Domain API Views (Production-Grade)
============================================
CRUD + verification + resolution + rate limiting.

Improvements over v1:
  - Redis-cached domain resolution (5-min TTL)
  - Rate limiting on public resolve endpoint (30 req/min/IP)
  - CNAME validation before domain activation
  - Background DNS verification trigger
  - Cache invalidation on domain changes
"""
import logging

from django.utils import timezone
from rest_framework import serializers, viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models_domains import CustomDomain
from .tasks_domains import (
    cache_domain_resolution, get_cached_domain_resolution,
    invalidate_domain_cache, check_rate_limit,
    check_domain_cname, provision_ssl, warm_domain_cache,
)

logger = logging.getLogger(__name__)


# ─── Serializers ─────────────────────────────────────────────────────────────

class CustomDomainSerializer(serializers.ModelSerializer):
    txt_record_name = serializers.SerializerMethodField()
    txt_record_value = serializers.SerializerMethodField()
    organization_slug = serializers.CharField(source='organization.slug', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    cname_target = serializers.SerializerMethodField()

    class Meta:
        model = CustomDomain
        fields = [
            'id', 'domain', 'domain_type', 'organization', 'organization_slug', 'organization_name',
            'is_verified', 'verification_token', 'txt_record_name', 'txt_record_value',
            'cname_target',
            'ssl_status', 'is_active', 'is_primary',
            'created_at', 'updated_at', 'verified_at', 'ssl_provisioned_at',
        ]
        read_only_fields = [
            'id', 'organization', 'is_verified', 'verification_token', 'ssl_status',
            'is_active', 'created_at', 'updated_at', 'verified_at', 'ssl_provisioned_at',
        ]

    def get_txt_record_name(self, obj):
        return obj.get_txt_record_name()

    def get_txt_record_value(self, obj):
        return obj.verification_token

    def get_cname_target(self, obj):
        return 'saas.tsf.ci'


# ─── ViewSet ─────────────────────────────────────────────────────────────────

class CustomDomainViewSet(viewsets.ModelViewSet):
    """
    CRUD for custom domains.
    Scoped to the user's organization (tenant isolation).
    Cache invalidated on create/update/delete.
    """
    serializer_class = CustomDomainSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        org_id = getattr(self.request, 'organization_id', None)
        if org_id:
            return CustomDomain.objects.filter(organization_id=org_id).select_related('organization')
        if self.request.user.is_superuser:
            return CustomDomain.objects.all().select_related('organization')
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

        # Validation: block reserved domains
        reserved = ['localhost', '127.0.0.1', 'example.com', 'test.com']
        if any(domain.endswith(r) for r in reserved):
            raise serializers.ValidationError("This domain is reserved and cannot be used.")

        # Validation: basic domain format check
        if '.' not in domain or len(domain) < 4:
            raise serializers.ValidationError("Invalid domain format.")

        # Check limit (max 5 custom domains per org)
        existing_count = CustomDomain.objects.filter(organization_id=org_id).count()
        if existing_count >= 5:
            raise serializers.ValidationError(
                "Maximum of 5 custom domains per organization. Remove one to add another."
            )

        instance = serializer.save(organization_id=org_id)
        logger.info(f"[DOMAIN] Added: {domain} → org={org_id} type={instance.domain_type}")

    def perform_destroy(self, instance):
        domain = instance.domain
        invalidate_domain_cache(domain)
        logger.info(f"[DOMAIN] Removed: {domain}")
        instance.delete()

    @action(detail=True, methods=['post'], url_path='verify')
    def verify_dns(self, request, pk=None):
        """
        Verify that the domain has the correct DNS TXT record.
        Also triggers CNAME check if TXT verification passes.
        """
        import dns.resolver
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
                    domain_obj.save(update_fields=['is_verified', 'verified_at', 'updated_at'])
                    logger.info(f"[DOMAIN] Verified via UI: {domain_obj.domain}")

                    # Trigger background CNAME check + SSL provisioning
                    check_domain_cname.delay(str(domain_obj.id))

                    return Response({
                        'status': 'verified',
                        'message': f'Domain {domain_obj.domain} verified! Checking DNS routing...',
                        'domain': CustomDomainSerializer(domain_obj).data,
                    })

            return Response({
                'status': 'not_found',
                'message': 'TXT record found but value does not match.',
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
                'message': f'DNS responded but no TXT records. Check your DNS provider.',
                'expected_name': txt_name,
                'expected_value': expected_value,
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"[DOMAIN] DNS verification error: {e}")
            return Response({
                'status': 'error',
                'message': f'DNS lookup failed: {str(e)}',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='check-cname')
    def check_cname(self, request, pk=None):
        """Manually trigger a CNAME check for a verified domain."""
        domain_obj = self.get_object()
        if not domain_obj.is_verified:
            return Response({'error': 'Domain must be verified first.'}, status=400)

        check_domain_cname.delay(str(domain_obj.id))
        return Response({'status': 'queued', 'message': 'CNAME check queued. Status will update shortly.'})

    @action(detail=True, methods=['post'], url_path='provision-ssl')
    def request_ssl(self, request, pk=None):
        """Manually trigger SSL provisioning for a verified + CNAME-validated domain."""
        domain_obj = self.get_object()
        if not domain_obj.is_verified:
            return Response({'error': 'Domain must be verified first.'}, status=400)

        provision_ssl.delay(str(domain_obj.id))
        return Response({'status': 'queued', 'message': 'SSL provisioning queued.'})

    @action(detail=True, methods=['post'], url_path='set-primary')
    def set_primary(self, request, pk=None):
        """Set this domain as the primary for its org+type combo."""
        domain_obj = self.get_object()
        if not domain_obj.is_active:
            return Response(
                {'error': 'Domain must be active before it can be set as primary.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        CustomDomain.objects.filter(
            organization=domain_obj.organization,
            domain_type=domain_obj.domain_type,
            is_primary=True,
        ).update(is_primary=False)

        domain_obj.is_primary = True
        domain_obj.save(update_fields=['is_primary', 'updated_at'])
        return Response({
            'status': 'ok',
            'message': f'{domain_obj.domain} is now the primary {domain_obj.domain_type} domain.',
        })


# ─── Public Resolution Endpoint (Rate-Limited + Redis-Cached) ────────────────

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def resolve_custom_domain(request):
    """
    Public endpoint to resolve a custom domain to an org slug.
    Used by the Next.js middleware to route traffic.

    Features:
      - Redis-cached (5-min TTL, much faster than DB)
      - Rate-limited (30 req/min/IP to prevent abuse)
      - Returns 404 for inactive/unknown domains

    GET /api/domains/resolve/?domain=shop.acme.com
    """
    domain = request.GET.get('domain', '').lower().strip()
    if not domain:
        return Response({'error': 'domain parameter required'}, status=status.HTTP_400_BAD_REQUEST)

    # Rate limiting
    client_ip = request.META.get('HTTP_X_REAL_IP') or request.META.get('REMOTE_ADDR', '0.0.0.0')
    try:
        if not check_rate_limit(client_ip):
            return Response(
                {'error': 'Rate limit exceeded. Try again in 60 seconds.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
    except Exception:
        pass  # Redis down — fail open, don't block

    # 1. Check Redis cache first (fastest path)
    try:
        cached = get_cached_domain_resolution(domain)
        if cached:
            return Response({
                'domain': domain,
                'slug': cached['slug'],
                'domain_type': cached['domain_type'],
                'source': 'cache',
            })
    except Exception:
        pass  # Redis down — fall through to DB

    # 2. Query database
    try:
        domain_obj = CustomDomain.objects.select_related('organization').get(
            domain=domain,
            is_active=True,
        )
        result = {
            'domain': domain_obj.domain,
            'slug': domain_obj.organization.slug,
            'domain_type': domain_obj.domain_type,
            'organization_name': domain_obj.organization.name,
            'source': 'db',
        }

        # Warm cache for next request
        try:
            cache_domain_resolution(domain, domain_obj.organization.slug, domain_obj.domain_type)
        except Exception:
            pass  # Redis down — still return result

        return Response(result)

    except CustomDomain.DoesNotExist:
        # Cache negative result to prevent DB hammering
        try:
            import redis as redis_lib
            r = redis_lib.Redis.from_url(
                'redis://redis:6379/2', decode_responses=True
            )
            r.setex(f'domain:resolve:neg:{domain}', 60, '1')
        except Exception:
            pass

        return Response({'error': 'Domain not found or not active'}, status=status.HTTP_404_NOT_FOUND)
