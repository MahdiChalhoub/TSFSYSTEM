"""
IAM Views — Portal Access & Approval management API.

Admin endpoints for managing ContactPortalAccess and PortalApprovalRequest.
Views delegate to selectors/services — no direct ORM logic here.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.iam.models import ContactPortalAccess, PortalApprovalRequest
from apps.iam.serializers import (
    ContactPortalAccessSerializer,
    PortalApprovalRequestSerializer,
)
from apps.iam.services import audit


class ContactPortalAccessViewSet(viewsets.ModelViewSet):
    """Admin CRUD for ContactPortalAccess records."""
    serializer_class = ContactPortalAccessSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ContactPortalAccess.objects.select_related(
            'user', 'contact', 'granted_by',
        ).all()

        portal_type = self.request.query_params.get('portal_type')
        if portal_type:
            qs = qs.filter(portal_type=portal_type.upper())

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        return qs

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke an active portal access."""
        access = self.get_object()
        reason = request.data.get('reason', '')
        access.revoke(revoked_by=request.user, reason=reason)
        audit.emit(audit.ACCESS_REVOKED, user=access.user, actor=request.user,
                   organization=access.organization,
                   detail=f'Access revoked for contact #{access.contact_id}',
                   access_id=access.id, reason=reason)
        return Response({'status': 'revoked'})

    @action(detail=True, methods=['post'])
    def block(self, request, pk=None):
        """Temporarily block access."""
        access = self.get_object()
        access.block()
        audit.emit(audit.ACCESS_BLOCKED, user=access.user, actor=request.user,
                   organization=access.organization,
                   detail=f'Access blocked for contact #{access.contact_id}',
                   access_id=access.id)
        return Response({'status': 'blocked'})

    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        """Reactivate a blocked/revoked access."""
        access = self.get_object()
        if access.status not in ('BLOCKED', 'REVOKED'):
            return Response(
                {'error': f'Cannot reactivate from {access.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        access.reactivate(granted_by=request.user)
        audit.emit(audit.ACCESS_REACTIVATED, user=access.user, actor=request.user,
                   organization=access.organization,
                   detail=f'Access reactivated for contact #{access.contact_id}',
                   access_id=access.id)
        return Response({'status': 'reactivated'})


class PortalApprovalRequestViewSet(viewsets.ModelViewSet):
    """Admin CRUD for PortalApprovalRequest records."""
    serializer_class = PortalApprovalRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = PortalApprovalRequest.objects.select_related(
            'target_user', 'target_contact', 'reviewed_by', 'resulting_access',
        ).all()

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        request_type = self.request.query_params.get('request_type')
        if request_type:
            qs = qs.filter(request_type=request_type.upper())

        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Approve a pending request.
        For supplier registrations, must include contact_id to link.
        """
        approval_req = self.get_object()
        contact_id = request.data.get('contact_id')
        review_notes = request.data.get('review_notes', '')

        contact = None
        if contact_id:
            from apps.crm.models import Contact
            try:
                contact = Contact.objects.get(id=contact_id)
            except Contact.DoesNotExist:
                return Response({'error': 'Contact not found'},
                                status=status.HTTP_404_NOT_FOUND)

        try:
            access = approval_req.approve(
                reviewed_by=request.user,
                contact=contact,
                review_notes=review_notes,
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        audit.emit(audit.APPROVAL_APPROVED, user=approval_req.target_user,
                   actor=request.user, organization=approval_req.organization,
                   detail=f'Request #{approval_req.id} approved',
                   request_id=approval_req.id, access_id=access.id)

        return Response({
            'status': 'approved',
            'access_id': access.id,
        })

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a pending request."""
        approval_req = self.get_object()
        reason = request.data.get('reason', '')
        try:
            approval_req.reject(reviewed_by=request.user, reason=reason)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        audit.emit(audit.APPROVAL_REJECTED, user=approval_req.target_user,
                   actor=request.user, organization=approval_req.organization,
                   detail=f'Request #{approval_req.id} rejected: {reason}',
                   request_id=approval_req.id)
        return Response({'status': 'rejected'})

    @action(detail=True, methods=['post'])
    def correction(self, request, pk=None):
        """Request correction from the user."""
        approval_req = self.get_object()
        notes = request.data.get('notes', '')
        if not notes:
            return Response({'error': 'Correction notes required'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            approval_req.request_correction(reviewed_by=request.user, notes=notes)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        audit.emit(audit.APPROVAL_CORRECTION, user=approval_req.target_user,
                   actor=request.user, organization=approval_req.organization,
                   detail=f'Correction requested for #{approval_req.id}: {notes}',
                   request_id=approval_req.id)
        return Response({'status': 'correction_requested'})


class IAMUserViewSet(viewsets.ViewSet):
    """IAM-scoped user management helpers."""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def create_from_contact(self, request):
        """Create a User + Portal Access from an existing Contact."""
        from apps.iam.services.linking import create_user_from_contact
        from apps.crm.models import Contact

        contact_id = request.data.get('contact_id')
        if not contact_id:
            return Response({'error': 'contact_id required'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            contact = Contact.objects.get(id=contact_id)
        except Contact.DoesNotExist:
            return Response({'error': 'Contact not found'},
                            status=status.HTTP_404_NOT_FOUND)

        user, access = create_user_from_contact(contact, created_by=request.user)
        return Response({
            'user_id': user.id,
            'access_id': access.id,
            'status': access.status,
            'portal_type': access.portal_type,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def promote_to_employee(self, request):
        """Create an Employee from an existing User."""
        from apps.iam.services.transfer import promote_to_employee
        from erp.models import User

        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id required'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'},
                            status=status.HTTP_404_NOT_FOUND)

        employee = promote_to_employee(
            user=user,
            organization=user.organization,
            job_title=request.data.get('job_title', ''),
            employee_type=request.data.get('employee_type', 'EMPLOYEE'),
            created_by=request.user,
        )
        return Response({
            'employee_id': employee.employee_id,
            'user_id': user.id,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def create_contact_from_employee(self, request):
        """Create a CRM Contact from an Employee and auto-link."""
        from apps.iam.services.transfer import create_contact_from_employee
        from apps.hr.models import Employee

        employee_id = request.data.get('employee_id')
        contact_type = request.data.get('contact_type', 'CUSTOMER')
        if not employee_id:
            return Response({'error': 'employee_id required'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            employee = Employee.objects.get(employee_id=employee_id)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'},
                            status=status.HTTP_404_NOT_FOUND)

        contact, access = create_contact_from_employee(
            employee=employee, contact_type=contact_type, created_by=request.user
        )
        return Response({
            'contact_id': contact.id,
            'contact_name': contact.name,
            'access_id': access.id if access else None,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def create_contact_from_user(self, request):
        """Create a CRM Contact from a User and auto-link."""
        from apps.iam.services.transfer import create_contact_from_user
        from erp.models import User

        user_id = request.data.get('user_id')
        contact_type = request.data.get('contact_type', 'CUSTOMER')
        if not user_id:
            return Response({'error': 'user_id required'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'},
                            status=status.HTTP_404_NOT_FOUND)

        contact, access = create_contact_from_user(
            user=user, contact_type=contact_type, created_by=request.user
        )
        return Response({
            'contact_id': contact.id,
            'contact_name': contact.name,
            'access_id': access.id,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def link_to_contact(self, request):
        """Manually link an existing User to an existing Contact."""
        from apps.iam.services.linking import link_user_to_contact
        from erp.models import User
        from apps.crm.models import Contact

        user_id = request.data.get('user_id')
        contact_id = request.data.get('contact_id')
        portal_type = request.data.get('portal_type', 'CLIENT')
        role = request.data.get('relationship_role', 'SELF')

        if not user_id or not contact_id:
            return Response({'error': 'user_id and contact_id required'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id)
            contact = Contact.objects.get(id=contact_id)
        except (User.DoesNotExist, Contact.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        access = link_user_to_contact(
            user=user, contact=contact, portal_type=portal_type,
            relationship_role=role, granted_by=request.user,
        )
        return Response({
            'access_id': access.id,
            'status': access.status,
            'portal_type': access.portal_type,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def portal_summary(self, request):
        """Get portal persona summary for a user."""
        from apps.iam.services.portal_access import get_portal_summary

        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response({'error': 'user_id required'},
                            status=status.HTTP_400_BAD_REQUEST)
        from erp.models import User
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'},
                            status=status.HTTP_404_NOT_FOUND)

        summary = get_portal_summary(user, organization=user.organization)
        return Response(summary)
