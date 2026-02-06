"""
Package Storage & Deployment Center - API Views
Handles package upload, listing, deployment, and rollback.
"""
import os
import json
import hashlib
import shutil
import zipfile
import tempfile
from datetime import datetime
from django.conf import settings
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from .models import PackageUpload
from .serializers import PackageUploadSerializer
from .package_deployer import PackageDeployer


class PackageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing package uploads and deployments.
    
    Endpoints:
    - GET /api/packages/ - List all packages
    - POST /api/packages/upload/ - Upload new package
    - GET /api/packages/{id}/ - Get package details
    - POST /api/packages/{id}/apply/ - Apply package now
    - POST /api/packages/{id}/schedule/ - Schedule deployment
    - POST /api/packages/{id}/rollback/ - Rollback to previous
    - DELETE /api/packages/{id}/ - Delete package
    """
    queryset = PackageUpload.objects.all()
    serializer_class = PackageUploadSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        queryset = PackageUpload.objects.all()
        package_type = self.request.query_params.get('type', None)
        status_filter = self.request.query_params.get('status', None)
        
        if package_type:
            queryset = queryset.filter(package_type=package_type)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset
    
    @action(detail=False, methods=['post'], url_path='upload')
    def upload_package(self, request):
        """
        Handle package file upload with metadata extraction.
        Supports both single upload and chunked upload.
        """
        file = request.FILES.get('file')
        package_type = request.data.get('package_type', 'module')
        
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file extension
        valid_extensions = {
            'kernel': '.kernel.zip',
            'frontend': '.frontend.zip',
            'module': '.module.zip'
        }
        
        if not file.name.endswith('.zip'):
            return Response({'error': 'File must be a ZIP archive'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Calculate checksum
        file_hash = hashlib.sha256()
        for chunk in file.chunks():
            file_hash.update(chunk)
        checksum = file_hash.hexdigest()
        
        # Extract manifest from ZIP
        manifest = {}
        name = file.name.replace('.zip', '')
        version = '1.0.0'
        changelog = ''
        
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp:
                for chunk in file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name
            
            with zipfile.ZipFile(tmp_path, 'r') as zf:
                # Look for manifest files
                manifest_files = ['update.json', 'manifest.json', 'frontend_update.json']
                for mf in manifest_files:
                    if mf in zf.namelist():
                        with zf.open(mf) as f:
                            manifest = json.loads(f.read().decode('utf-8'))
                            name = manifest.get('name', name)
                            version = manifest.get('version', version)
                            changelog = manifest.get('changelog', '')
                        break
            
            os.unlink(tmp_path)
        except Exception as e:
            pass  # Continue without manifest
        
        # Reset file pointer
        file.seek(0)
        
        # Create package record
        package = PackageUpload.objects.create(
            package_type=package_type,
            name=name,
            version=version,
            file=file,
            file_size=file.size,
            upload_progress=100,
            checksum=checksum,
            status='ready',
            changelog=changelog,
            uploaded_by=request.user,
            manifest=manifest
        )
        
        serializer = PackageUploadSerializer(package)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='apply')
    def apply_package(self, request, pk=None):
        """
        Apply a package immediately.
        """
        package = self.get_object()
        
        if package.status not in ['ready', 'scheduled']:
            return Response(
                {'error': f'Package cannot be applied. Current status: {package.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        deployer = PackageDeployer()
        result = deployer.deploy(package, request.user)
        
        if result['success']:
            return Response({
                'message': f'Package {package.name} v{package.version} applied successfully',
                'backup_path': result.get('backup_path')
            })
        else:
            return Response(
                {'error': result.get('error', 'Deployment failed')},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'], url_path='schedule')
    def schedule_deployment(self, request, pk=None):
        """
        Schedule a package for future deployment.
        """
        package = self.get_object()
        scheduled_time = request.data.get('scheduled_for')
        
        if not scheduled_time:
            return Response({'error': 'scheduled_for is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            scheduled_dt = datetime.fromisoformat(scheduled_time.replace('Z', '+00:00'))
        except ValueError:
            return Response({'error': 'Invalid datetime format'}, status=status.HTTP_400_BAD_REQUEST)
        
        if scheduled_dt <= timezone.now():
            return Response({'error': 'Scheduled time must be in the future'}, status=status.HTTP_400_BAD_REQUEST)
        
        package.scheduled_for = scheduled_dt
        package.status = 'scheduled'
        package.save()
        
        serializer = PackageUploadSerializer(package)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], url_path='rollback')
    def rollback_package(self, request, pk=None):
        """
        Rollback a deployed package using its backup.
        """
        package = self.get_object()
        
        if package.status != 'applied':
            return Response(
                {'error': 'Only applied packages can be rolled back'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not package.backup_path or not os.path.exists(package.backup_path):
            return Response(
                {'error': 'No backup available for rollback'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        deployer = PackageDeployer()
        result = deployer.rollback(package)
        
        if result['success']:
            package.status = 'rolled_back'
            package.save()
            return Response({'message': 'Rollback completed successfully'})
        else:
            return Response(
                {'error': result.get('error', 'Rollback failed')},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='stats')
    def get_stats(self, request):
        """
        Get deployment statistics.
        """
        total = PackageUpload.objects.count()
        by_type = {
            'kernel': PackageUpload.objects.filter(package_type='kernel').count(),
            'frontend': PackageUpload.objects.filter(package_type='frontend').count(),
            'module': PackageUpload.objects.filter(package_type='module').count(),
        }
        by_status = {
            'ready': PackageUpload.objects.filter(status='ready').count(),
            'applied': PackageUpload.objects.filter(status='applied').count(),
            'scheduled': PackageUpload.objects.filter(status='scheduled').count(),
            'failed': PackageUpload.objects.filter(status='failed').count(),
        }
        
        return Response({
            'total': total,
            'by_type': by_type,
            'by_status': by_status
        })
