"""
Maintenance Mode Middleware for TSF Platform

Provides a graceful "Optimizing Experience" response during deployments
instead of hard connection resets or 502 errors.

Activation: Touch /tmp/tsf_maintenance to enable, remove to disable.
The atomic deploy script can use this to show a brief overlay.
"""

import os
from django.http import JsonResponse


MAINTENANCE_FLAG = "/tmp/tsf_maintenance"

# Paths that should ALWAYS work, even during maintenance
EXEMPT_PATHS = [
    "/api/health/",
]


class MaintenanceModeMiddleware:
    """
    Returns a 503 with a friendly message when maintenance mode is active.
    The frontend can catch this and show a brief "Optimizing" overlay.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if os.path.exists(MAINTENANCE_FLAG):
            # Allow health checks through (for deploy monitoring)
            if request.path in EXEMPT_PATHS:
                return self.get_response(request)

            return JsonResponse(
                {
                    "status": "maintenance",
                    "message": "Optimizing your experience. Back in seconds.",
                    "retry_after": 5,
                },
                status=503,
            )

        return self.get_response(request)
