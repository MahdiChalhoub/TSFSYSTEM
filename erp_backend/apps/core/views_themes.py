"""
Theme API Views
===============
REST API endpoints for theme management.

Endpoints:
- GET    /api/themes/              - List all themes
- POST   /api/themes/              - Create custom theme
- GET    /api/themes/{id}/         - Get theme details
- PATCH  /api/themes/{id}/         - Update custom theme
- DELETE /api/themes/{id}/         - Delete custom theme
- POST   /api/themes/{id}/activate/ - Activate theme
- POST   /api/themes/toggle-mode/  - Toggle dark/light mode
- GET    /api/themes/current/      - Get current user theme
- POST   /api/themes/import/       - Import theme from JSON
- GET    /api/themes/{id}/export/  - Export theme as JSON
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils.text import slugify
from django.shortcuts import get_object_or_404
from .models_themes import OrganizationTheme, UserThemePreference
from .serializers_themes import (
    OrganizationThemeSerializer,
    OrganizationThemeListSerializer,
    UserThemePreferenceSerializer,
    ThemeExportSerializer
)
from kernel.rbac.decorators import require_permission
from kernel.tenancy.context import set_current_tenant

def _get_org_context(request):
    """Helper to resolve organization with fallback to 'saas' for theme operations"""
    # Try both .organization and .tenant (middleware uses .tenant)
    org = getattr(request, 'organization', None) or getattr(request, 'tenant', None)
    # For theme operations, always fallback to 'saas' organization if no tenant context
    # This allows theme switching to work even without full authentication
    if not org:
        from erp.models import Organization
        org = Organization.objects.filter(slug='saas').first()
        if org:
            # Sync thread-local context for TenantOwnedModel validation
            set_current_tenant(org)
    return org


@api_view(['GET'])
@permission_classes([AllowAny])  # TEMPORARILY PUBLIC FOR TESTING
def list_themes(request):
    """
    List all available themes (system + custom for tenant)

    Returns:
    {
        "system": [...],
        "custom": [...],
        "current": {"theme_slug": "...", "color_mode": "..."}
    }
    """
    # System themes — use original_objects (unscoped) so tenant auto-filter
    # doesn't exclude org=None system themes when a user is logged in
    system_themes = OrganizationTheme.original_objects.filter(
        is_system=True,
        is_active=True
    )

    # Tenant custom themes
    custom_themes = []
    org = _get_org_context(request)

    if org:
        custom_themes = OrganizationTheme.original_objects.filter(
            organization=org,
            is_active=True,
            is_system=False
        )

    # Current user preference
    user_pref = None
    current_theme_slug = 'ant-design'  # Default to industry design system
    current_color_mode = 'dark'

    if org and request.user.is_authenticated:
        user_pref, _ = UserThemePreference.objects.get_or_create(
            user=request.user,
            organization=org
        )

        # Use saved preference if exists
        if user_pref.active_theme:
            current_theme_slug = user_pref.active_theme.slug
        current_color_mode = user_pref.color_mode

    return Response({
        'system': OrganizationThemeListSerializer(system_themes, many=True).data,
        'custom': OrganizationThemeListSerializer(custom_themes, many=True).data,
        'current': {
            'theme_slug': current_theme_slug,
            'color_mode': current_color_mode
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_permission('core.add_organizationtheme')
def create_theme(request):
    """
    Create custom theme

    Body:
    {
        "name": "My Custom Theme",
        "description": "...",
        "category": "custom",
        "preset_data": {...},
        "tags": [...]
    }
    """
    org = _get_org_context(request)
    if not org:
        return Response(
            {'error': 'Organization context required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    data = request.data.copy()
    data['slug'] = slugify(data['name'])
    data['is_system'] = False  # Custom themes are never system themes

    serializer = OrganizationThemeSerializer(data=data)
    if serializer.is_valid():
        theme = serializer.save(
            organization=org,  # Fixed: use org from _get_org_context()
            created_by=request.user
        )

        return Response(
            OrganizationThemeSerializer(theme).data,
            status=status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_theme(request, theme_id):
    """Get theme details by ID"""
    theme = get_object_or_404(OrganizationTheme, id=theme_id)

    # Verify access (system themes or own tenant themes)
    if not theme.is_system:
        org = _get_org_context(request)
        if not org or theme.organization != org:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )

    return Response(OrganizationThemeSerializer(theme).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@require_permission('core.change_organizationtheme')
def update_theme(request, theme_id):
    """Update custom theme (system themes cannot be modified)"""
    theme = get_object_or_404(OrganizationTheme, id=theme_id)

    # Cannot update system themes
    if theme.is_system:
        return Response(
            {'error': 'System themes cannot be modified'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Verify tenant access
    org = _get_org_context(request)
    if not org or theme.organization != org:
        return Response(
            {'error': 'Access denied'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = OrganizationThemeSerializer(theme, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@require_permission('core.delete_organizationtheme')
def delete_theme(request, theme_id):
    """Delete custom theme (system themes cannot be deleted)"""
    theme = get_object_or_404(OrganizationTheme, id=theme_id)

    # Cannot delete system themes
    if theme.is_system:
        return Response(
            {'error': 'System themes cannot be deleted'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Verify tenant access
    org = _get_org_context(request)
    if not org or theme.organization != org:
        return Response(
            {'error': 'Access denied'},
            status=status.HTTP_403_FORBIDDEN
        )

    theme.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([AllowAny])  # TEMPORARILY: Allow unauthenticated for theme testing
def activate_theme(request, theme_id):
    """
    Activate theme for current user

    Sets this theme as the active theme for the logged-in user.
    """
    theme = get_object_or_404(OrganizationTheme, id=theme_id)

    # Verify access
    org = _get_org_context(request)
    if not theme.is_system:
        if not org or theme.organization != org:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )

    # Get or create user preference for current organization
    if not org:
        return Response(
            {'error': 'Organization context required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Only save preference if user is authenticated
    if request.user.is_authenticated:
        user_pref, _ = UserThemePreference.objects.get_or_create(
            user=request.user,
            organization=org
        )

        user_pref.active_theme = theme
        user_pref.save()

        # Increment usage counter
        theme.increment_usage()

    # Return success even for unauthenticated users (theme will be client-side only)
    return Response({
        'status': 'activated',
        'theme_slug': theme.slug,
        'theme_name': theme.name
    })


@api_view(['POST'])
@permission_classes([AllowAny])  # TEMPORARILY: Allow unauthenticated for theme testing
def toggle_color_mode(request):
    """
    Toggle between dark and light mode

    Body (optional):
    {
        "mode": "dark" | "light" | "auto"
    }

    If no body provided, toggles between dark/light.
    """
    # Get or create user preference for current organization
    org = _get_org_context(request)
    if not org:
        return Response(
            {'error': 'Organization context required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Determine new mode
    if 'mode' in request.data:
        new_mode = request.data['mode']
        if new_mode not in ['dark', 'light', 'auto']:
            return Response(
                {'error': 'Invalid mode. Must be dark, light, or auto'},
                status=status.HTTP_400_BAD_REQUEST
            )
    else:
        # Toggle between dark and light (default to dark if no preference)
        current_mode = 'dark'
        if request.user.is_authenticated:
            user_pref = UserThemePreference.objects.filter(
                user=request.user,
                organization=org
            ).first()
            if user_pref:
                current_mode = user_pref.color_mode
        new_mode = 'light' if current_mode == 'dark' else 'dark'

    # Only save if user is authenticated
    if request.user.is_authenticated:
        user_pref, _ = UserThemePreference.objects.get_or_create(
            user=request.user,
            organization=org
        )
        user_pref.color_mode = new_mode
        user_pref.save()

    # Return success even for unauthenticated users
    return Response({
        'color_mode': new_mode,
        'status': 'updated'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_theme(request):
    """Get current user's active theme with full details"""
    org = _get_org_context(request)
    if not org:
        return Response(
            {'error': 'Organization context required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user_pref, _ = UserThemePreference.objects.get_or_create(
        user=request.user,
        organization=org
    )

    # Get effective theme
    theme = user_pref.get_effective_theme()

    return Response({
        'theme': OrganizationThemeSerializer(theme).data,
        'color_mode': user_pref.color_mode,
        'custom_overrides': user_pref.custom_overrides
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_permission('core.add_organizationtheme')
def import_theme(request):
    """
    Import theme from JSON

    Body:
    {
        "name": "Imported Theme",
        "description": "...",
        "category": "custom",
        "preset_data": {...},
        "tags": [...]
    }
    """
    org = _get_org_context(request)
    if not org:
        return Response(
            {'error': 'Organization context required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = ThemeExportSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        theme = OrganizationTheme.import_from_json(
            data=serializer.validated_data,
            organization=org,
            user=request.user
        )

        return Response(
            OrganizationThemeSerializer(theme).data,
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
        return Response(
            {'error': f'Import failed: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_theme(request, theme_id):
    """Export theme as JSON for sharing/backup"""
    theme = get_object_or_404(OrganizationTheme, id=theme_id)

    # Verify access
    if not theme.is_system:
        org = _get_org_context(request)
        if not org or theme.organization != org:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )

    return Response(theme.export_json())
