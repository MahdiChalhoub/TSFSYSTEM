"""
Custom Throttle Classes for DRF
================================
Provides rate-limited access to sensitive endpoints:
  - LoginRateThrottle: 5/minute per IP for login attempts
  - RegisterRateThrottle: 3/minute per IP for registration
  - TenantResolveRateThrottle: 30/minute per IP for organization resolution
"""

from rest_framework.throttling import SimpleRateThrottle


class LoginRateThrottle(SimpleRateThrottle):
    """Limit login attempts to prevent brute-force attacks."""
    scope = 'login'

    def get_cache_key(self, request, view):
        # Throttle by IP address (anonymous users)
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class RegisterRateThrottle(SimpleRateThrottle):
    """Limit registration attempts to prevent abuse."""
    scope = 'register'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class TenantResolveRateThrottle(SimpleRateThrottle):
    """Limit organization resolution to prevent enumeration attacks."""
    scope = 'tenant_resolve'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }
