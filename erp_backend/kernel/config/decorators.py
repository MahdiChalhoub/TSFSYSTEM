"""
Config Decorators

Decorators for feature flag enforcement in views.
"""

from functools import wraps
from django.http import JsonResponse
from rest_framework.response import Response
from .config_manager import is_feature_enabled


def require_feature(feature_key: str, redirect_url: str = None):
    """
    Decorator to require a feature flag to be enabled.

    Args:
        feature_key: Feature flag key
        redirect_url: Optional redirect URL if feature disabled

    Usage:
        @require_feature('new_invoice_ui')
        def new_invoice_view(request):
            # Only accessible if feature is enabled
            pass

    Example with DRF:
        class InvoiceAPIView(APIView):
            @require_feature('api_v2')
            def post(self, request):
                pass
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            user = request.user if hasattr(request, 'user') else None

            if not is_feature_enabled(feature_key, user=user):
                # Determine response type
                if hasattr(view_func, 'cls'):  # DRF view
                    return Response(
                        {
                            'error': f'Feature not available: {feature_key}',
                            'feature_key': feature_key
                        },
                        status=403
                    )
                else:  # Django view
                    if redirect_url:
                        from django.shortcuts import redirect
                        return redirect(redirect_url)
                    else:
                        return JsonResponse(
                            {
                                'error': f'Feature not available: {feature_key}',
                                'feature_key': feature_key
                            },
                            status=403
                        )

            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator


def feature_flag(feature_key: str):
    """
    Decorator that passes feature flag status to the view function.

    Usage:
        @feature_flag('new_invoice_ui')
        def invoice_view(request, feature_enabled):
            if feature_enabled:
                # Use new UI
                pass
            else:
                # Use old UI
                pass
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            user = request.user if hasattr(request, 'user') else None
            feature_enabled = is_feature_enabled(feature_key, user=user)

            # Pass feature status as kwarg
            kwargs['feature_enabled'] = feature_enabled

            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator
