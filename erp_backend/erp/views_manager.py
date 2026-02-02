from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from erp.models import User, Employee, Organization, Role
from erp.permissions import IsOrgAdmin # Assuming we have or will create this, or leverage Role permissions

class PendingUsersView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Fetch all users with PENDING or NEEDS_CORRECTION status for this tenant
        org = request.user.organization
        if not org:
            return Response({'error': 'No tenant context'}, status=400)
            
        users = User.objects.filter(
            organization=org, 
            registration_status__in=['PENDING', 'NEEDS_CORRECTION']
        ).select_related('role', 'employee')
        
        data = []
        for u in users:
            emp = getattr(u, 'employee', None)
            data.append({
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'role': u.role.name if u.role else 'N/A',
                'status': u.registration_status,
                'date_joined': u.date_joined,
                'employee_details': {
                    'phone': emp.phone if emp else '',
                    'nationality': emp.nationality if emp else '',
                    'dob': emp.date_of_birth if emp else ''
                } if emp else {}
            })
            
        return Response(data)

class ApproveUserView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, organization=request.user.organization)
            user.registration_status = 'APPROVED'
            user.is_active = True # ENABLE LOGIN
            user.save()
            return Response({'message': 'User approved successfully'})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

class RejectUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, organization=request.user.organization)
            user.registration_status = 'REJECTED'
            user.is_active = False
            user.save()
            return Response({'message': 'User rejected'})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

class RequestCorrectionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        notes = request.data.get('notes')
        if not notes:
             return Response({'error': 'Correction notes are required'}, status=400)

        try:
            user = User.objects.get(id=user_id, organization=request.user.organization)
            user.registration_status = 'NEEDS_CORRECTION'
            user.correction_notes = notes
            user.is_active = False
            user.save()
            return Response({'message': 'Correction requested'})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
