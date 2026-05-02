"""
List Preferences API Views
Endpoints for reading/writing per-user and per-org list preferences.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from erp.list_preferences import OrgListDefault, UserListPreference
from erp.middleware import get_current_tenant_id


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def user_list_preference(request, list_key):
    """
    GET: Returns merged preference (user → org → empty).
    PUT: Saves user preference for this list.
    """
    org_id = get_current_tenant_id()
    if not org_id:
        return Response({"error": "Organization context missing"}, status=400)

    if request.method == 'GET':
        # 1. Fetch organization defaults (shared profiles)
        shared_profiles = []
        org_active_id = 'default'
        try:
            org_default = OrgListDefault.objects.get(
                organization_id=org_id, list_key=list_key
            )
            shared_profiles = org_default.view_profiles or []
            org_active_id = org_default.active_profile_id or 'default'
            # Mark shared profiles
            for p in shared_profiles:
                p['is_shared'] = True
        except OrgListDefault.DoesNotExist:
            org_default = None

        # 2. Fetch user preferences
        try:
            pref = UserListPreference.objects.get(
                user=request.user, organization_id=org_id, list_key=list_key
            )
            
            # Merge shared profiles into user's profiles
            all_profiles = shared_profiles + (pref.view_profiles or [])
            
            return Response({
                'source': 'user',
                'list_key': list_key,
                'visible_columns': pref.visible_columns,
                'default_filters': pref.default_filters,
                'page_size': pref.page_size,
                'sort_column': pref.sort_column,
                'sort_direction': pref.sort_direction,
                'view_profiles': all_profiles,
                'active_profile_id': pref.active_profile_id,
            })
        except UserListPreference.DoesNotExist:
            pass

        # 3. Fall back to org default if no user preference exists
        if org_default:
            return Response({
                'source': 'organization',
                'list_key': list_key,
                'visible_columns': org_default.visible_columns,
                'default_filters': org_default.default_filters,
                'page_size': org_default.page_size,
                'sort_column': org_default.sort_column,
                'sort_direction': org_default.sort_direction,
                'view_profiles': shared_profiles,
                'active_profile_id': org_active_id,
            })

        # 4. Total fallback
        return Response({
            'source': 'default',
            'list_key': list_key,
            'visible_columns': [],
            'default_filters': {},
            'page_size': 25,
            'sort_column': '',
            'sort_direction': 'asc',
            'view_profiles': [],
            'active_profile_id': 'default',
        })

    elif request.method == 'PUT':
        data = request.data
        # Filter out shared profiles before saving to user preferences
        # (Users can't modify shared profiles in their own space)
        all_profiles = data.get('view_profiles', [])
        user_profiles = [p for p in all_profiles if not p.get('is_shared')]

        pref, created = UserListPreference.objects.update_or_create(
            user=request.user,
            organization_id=org_id,
            list_key=list_key,
            defaults={
                'visible_columns': data.get('visible_columns', []),
                'default_filters': data.get('default_filters', {}),
                'page_size': data.get('page_size', 25),
                'sort_column': data.get('sort_column', ''),
                'sort_direction': data.get('sort_direction', 'asc'),
                'view_profiles': user_profiles,
                'active_profile_id': data.get('active_profile_id', 'default'),
            }
        )
        return Response({
            'success': True,
            'created': created,
            'list_key': list_key,
        })


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def org_list_default(request, list_key):
    """
    GET: Returns org default for this list.
    PUT: Sets org default (admin only).
    """
    org_id = get_current_tenant_id()
    if not org_id:
        return Response({"error": "Organization context missing"}, status=400)

    if request.method == 'GET':
        try:
            org_default = OrgListDefault.objects.get(
                organization_id=org_id, list_key=list_key
            )
            return Response({
                'list_key': list_key,
                'visible_columns': org_default.visible_columns,
                'default_filters': org_default.default_filters,
                'page_size': org_default.page_size,
                'sort_column': org_default.sort_column,
                'sort_direction': org_default.sort_direction,
                'view_profiles': org_default.view_profiles,
                'active_profile_id': org_default.active_profile_id,
            })
        except OrgListDefault.DoesNotExist:
            return Response({
                'list_key': list_key,
                'visible_columns': [],
                'default_filters': {},
                'page_size': 25,
                'sort_column': '',
                'sort_direction': 'asc',
                'view_profiles': [],
                'active_profile_id': 'default',
            })

    elif request.method == 'PUT':
        # Only staff/admin can set org defaults
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"error": "Only administrators can set organization defaults"},
                status=403
            )

        data = request.data
        # Ensure all saved profiles are marked as shared
        shared_profiles = data.get('view_profiles', [])
        for p in shared_profiles:
            p['is_shared'] = True

        default, created = OrgListDefault.objects.update_or_create(
            organization_id=org_id,
            list_key=list_key,
            defaults={
                'visible_columns': data.get('visible_columns', []),
                'default_filters': data.get('default_filters', {}),
                'page_size': data.get('page_size', 25),
                'sort_column': data.get('sort_column', ''),
                'sort_direction': data.get('sort_direction', 'asc'),
                'view_profiles': shared_profiles,
                'active_profile_id': data.get('active_profile_id', 'default'),
            }
        )
        return Response({
            'success': True,
            'created': created,
            'list_key': list_key,
        })
