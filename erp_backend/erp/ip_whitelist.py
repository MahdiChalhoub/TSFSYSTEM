"""
IP Whitelisting Middleware for SaaS Admin Panel
================================================
Restricts access to /api/saas/ endpoints to whitelisted IP addresses.
Configure via SAAS_ADMIN_IP_WHITELIST in settings (empty = allow all).
"""

import logging
from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger('erp')


class SaaSIPWhitelistMiddleware:
    """
    Restricts /api/saas/ endpoints to whitelisted IPs.

    Configure in settings.py:
        SAAS_ADMIN_IP_WHITELIST = ['127.0.0.1']

    If empty or not set, all IPs are allowed (open mode).
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.whitelist = set(getattr(settings, 'SAAS_ADMIN_IP_WHITELIST', []))

    def __call__(self, request):
        # Only check SaaS admin-level endpoints
        if request.path.startswith('/api/saas/') and self.whitelist:
            client_ip = self._get_client_ip(request)
            if client_ip not in self.whitelist:
                logger.warning(f"[IP BLOCK] Rejected {client_ip} from {request.path}")
                return JsonResponse(
                    {"error": "Access denied. Your IP is not authorized for SaaS administration."},
                    status=403
                )
        return self.get_response(request)

    def _get_client_ip(self, request):
        """Extract real client IP, respecting proxy headers."""
        forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '0.0.0.0')
