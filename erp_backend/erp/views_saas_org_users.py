from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.conf import settings
from django.db import models as models
from .models import SystemModule, Organization, OrganizationModule, SystemUpdate
from .module_manager import ModuleManager
from .kernel_manager import KernelManager
import logging

logger = logging.getLogger(__name__)



class OrgSaasUsersMixin:

    # ─── User Management Endpoints ────────────────────────────────────

    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        """List all users for an organization"""
        from erp.models import User
        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        users = User.objects.filter(organization=org).select_related('role').order_by('-date_joined')
        data = [{
            'id': str(u.id),
            'username': u.username,
            'email': u.email or '',
            'first_name': u.first_name or '',
            'last_name': u.last_name or '',
            'is_superuser': u.is_superuser,
            'is_staff': u.is_staff,
            'is_active': u.is_active,
            'role': u.role.name if u.role else None,
            'date_joined': u.date_joined.isoformat() if u.date_joined else None,
        } for u in users]

        return Response(data)


    @action(detail=True, methods=['post'])
    def create_user(self, request, pk=None):
        """Create a new user in an organization"""
        from erp.models import User
        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '').strip()
        is_superuser = request.data.get('is_superuser', False)
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()

        if not username or not password:
            return Response({'error': 'Username and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Check unique username per org
        if User.objects.filter(username=username, organization=org).exists():
            return Response({'error': f'Username "{username}" already exists in this organization'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                organization=org,
                first_name=first_name,
                last_name=last_name,
                is_superuser=is_superuser,
                is_staff=is_superuser,  # superusers are also staff
                registration_status='APPROVED', # SaaS-created users are pre-approved
                is_active=True,
            )
            return Response({
                'message': f'User "{username}" created successfully',
                'user': {
                    'id': str(user.id),
                    'username': user.username,
                    'email': user.email,
                    'is_superuser': user.is_superuser,
                }
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """Reset a user's password"""
        from erp.models import User
        user_id = request.data.get('user_id')
        new_password = request.data.get('new_password', '').strip()

        if not user_id or not new_password:
            return Response({'error': 'user_id and new_password are required'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 6:
            return Response({'error': 'Password must be at least 6 characters'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id, organization_id=pk)
            user.set_password(new_password)
            user.save() # Full save to ensure all auth signals fire
            
            logger.info(f"SaaS Admin Reset Password for user {user.username} (ID: {user.id})")
            
            return Response({'message': f'Password reset for "{user.username}"'})
        except User.DoesNotExist:
            return Response({'error': 'User not found in this organization'}, status=status.HTTP_404_NOT_FOUND)


    @action(detail=True, methods=['post'], url_path='set-client')
    def set_client(self, request, pk=None):
        """Assign or unassign a client to this organization"""
        from erp.models import SaaSClient
        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        client_id = request.data.get('client_id')
        if client_id:
            try:
                client = SaaSClient.objects.get(id=client_id)
            except SaaSClient.DoesNotExist:
                return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)
            org.client = client
            org.save(update_fields=['client'])
            return Response({'message': f'Client "{client.full_name}" assigned to {org.name}'})
        else:
            org.client = None
            org.save(update_fields=['client'])
            return Response({'message': f'Client unassigned from {org.name}'})

