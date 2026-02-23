"""
Storage Module — views_chunked.py
Chunked/resumable upload API endpoints.
"""
import hashlib
import logging
import os

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .upload_session import UploadSession
from .models import StorageProvider, StoredFile
from . import backends

logger = logging.getLogger(__name__)


# ── 1. INIT — Create a new upload session ─────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def chunked_upload_init(request):
    """
    POST /api/storage/upload/init/
    Body: { filename, total_size, content_type?, checksum?, category?, linked_model?, linked_id?, upload_type?, package_type? }
    Returns: { session_id, upload_url }
    """
    filename = request.data.get('filename')
    total_size = request.data.get('total_size')

    if not filename or not total_size:
        return Response(
            {'error': 'filename and total_size are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    org_id = request.headers.get('X-Tenant-Id') or \
             getattr(request, 'organization', None) or \
             getattr(request.user, 'organization_id', None)
    
    from erp.models import Organization
    org = Organization.objects.filter(id=org_id).first() if org_id else None

    session = UploadSession(
        filename=filename,
        content_type=request.data.get('content_type', 'application/octet-stream'),
        total_size=int(total_size),
        checksum_expected=request.data.get('checksum', ''),
        upload_type=request.data.get('upload_type', 'file'),
        category=request.data.get('category', 'ATTACHMENT'),
        linked_model=request.data.get('linked_model', ''),
        linked_id=request.data.get('linked_id'),
        package_type=request.data.get('package_type', ''),
        organization_id=org.id if org else None,
        uploaded_by=request.user,
    )
    session.save()

    return Response({
        'session_id': str(session.id),
        'chunk_url': f'/api/storage/upload/{session.id}/chunk/',
        'status_url': f'/api/storage/upload/{session.id}/status/',
    }, status=status.HTTP_201_CREATED)


# ── 2. CHUNK — Receive a file chunk ───────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def chunked_upload_chunk(request, session_id):
    """
    POST /api/storage/upload/<session_id>/chunk/
    Body (multipart): chunk (file), offset (optional int)
    Appends the chunk to the temp file, updates bytes_received.
    """
    try:
        session = UploadSession.objects.get(id=session_id)
    except UploadSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    if session.status != 'uploading':
        return Response(
            {'error': f'Session is {session.status}, not accepting chunks'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if session.is_expired:
        session.status = 'expired'
        session.save(update_fields=['status'])
        return Response({'error': 'Upload session expired'}, status=status.HTTP_410_GONE)

    chunk = request.FILES.get('chunk') or request.data.get('chunk')
    if not chunk:
        return Response({'error': 'No chunk data provided'}, status=status.HTTP_400_BAD_REQUEST)

    # Optional: client can specify offset for verification
    expected_offset = request.data.get('offset')
    if expected_offset is not None:
        expected_offset = int(expected_offset)
        if expected_offset != session.bytes_received:
            return Response({
                'error': 'Offset mismatch',
                'expected_offset': session.bytes_received,
                'provided_offset': expected_offset,
            }, status=status.HTTP_409_CONFLICT)

    # Append chunk to temp file
    try:
        temp_dir = os.path.dirname(session.temp_path)
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir, exist_ok=True)
            os.chmod(temp_dir, 0o777)

        with open(session.temp_path, 'ab') as f:
            if hasattr(chunk, 'chunks'):
                for part in chunk.chunks():
                    f.write(part)
                    session.bytes_received += len(part)
            else:
                data = chunk.read() if hasattr(chunk, 'read') else chunk
                if isinstance(data, str):
                    data = data.encode()
                f.write(data)
                session.bytes_received += len(data)

        session.chunk_count += 1
        session.save(update_fields=['bytes_received', 'chunk_count', 'updated_at'])

        return Response({
            'session_id': str(session.id),
            'bytes_received': session.bytes_received,
            'total_size': session.total_size,
            'progress': session.progress,
            'complete': session.is_complete,
        })

    except Exception as e:
        logger.exception('Chunk write failed')
        return Response(
            {'error': f'Failed to write chunk: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ── 3. COMPLETE — Finalize the upload ─────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def chunked_upload_complete(request, session_id):
    """
    POST /api/storage/upload/<session_id>/complete/
    Verifies checksum, moves file to storage, creates StoredFile record.
    """
    try:
        session = UploadSession.objects.get(id=session_id)
    except UploadSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    if session.status != 'uploading':
        return Response(
            {'error': f'Session is {session.status}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not os.path.exists(session.temp_path):
        session.status = 'failed'
        session.save(update_fields=['status'])
        return Response({'error': 'Temp file not found'}, status=status.HTTP_410_GONE)

    actual_size = os.path.getsize(session.temp_path)
    if actual_size < session.total_size:
        return Response({
            'error': 'Upload incomplete',
            'bytes_received': actual_size,
            'total_size': session.total_size,
            'progress': session.progress,
        }, status=status.HTTP_400_BAD_REQUEST)

    # Verify checksum if provided
    if session.checksum_expected:
        sha = hashlib.sha256()
        with open(session.temp_path, 'rb') as f:
            for block in iter(lambda: f.read(8192), b''):
                sha.update(block)
        actual_checksum = sha.hexdigest()
        if actual_checksum != session.checksum_expected:
            session.status = 'failed'
            session.save(update_fields=['status'])
            return Response({
                'error': 'Checksum mismatch — file may be corrupted',
                'expected': session.checksum_expected,
                'actual': actual_checksum,
            }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
    else:
        # Compute checksum for record
        sha = hashlib.sha256()
        with open(session.temp_path, 'rb') as f:
            for block in iter(lambda: f.read(8192), b''):
                sha.update(block)
        actual_checksum = sha.hexdigest()

    # Route based on upload_type
    if session.upload_type == 'package':
        result = _finalize_package_upload(session, actual_checksum)
    else:
        result = _finalize_file_upload(session, actual_checksum, request)

    # Cleanup temp file
    if os.path.exists(session.temp_path):
        os.remove(session.temp_path)

    session.status = 'complete'
    session.save(update_fields=['status'])

    return Response(result, status=status.HTTP_201_CREATED)


def _finalize_file_upload(session, checksum, request):
    """Move assembled file to cloud storage and create StoredFile record."""
    org_id = request.headers.get('X-Tenant-Id') or \
             getattr(request, 'organization', None) or \
             getattr(request.user, 'organization_id', None)
    
    from erp.models import Organization
    org = Organization.objects.filter(id=org_id).first() if org_id else None
    provider = StorageProvider.get_for_organization(org)

    # Create a file-like wrapper for the assembled temp file
    class TempFileWrapper:
        def __init__(self, path, name, ct, size):
            self.name = name
            self.content_type = ct
            self.size = size
            self._file = open(path, 'rb')

        def read(self, n=-1):
            return self._file.read(n)

        def seek(self, pos):
            self._file.seek(pos)

        def chunks(self, chunk_size=8192):
            self.seek(0)
            while True:
                data = self.read(chunk_size)
                if not data:
                    break
                yield data

        def close(self):
            self._file.close()

    file_obj = TempFileWrapper(
        session.temp_path, session.filename,
        session.content_type, session.total_size,
    )

    try:
        storage_key, bucket, _, file_size = backends.upload_to_cloud(
            provider=provider,
            file_obj=file_obj,
            category=session.category,
            original_filename=session.filename,
        )

        stored_file = StoredFile.objects.create(
            organization=org,
            original_filename=session.filename,
            storage_key=storage_key,
            bucket=bucket,
            content_type=session.content_type,
            file_size=session.total_size,
            category=session.category,
            linked_model=session.linked_model,
            linked_id=session.linked_id,
            uploaded_by=session.uploaded_by,
            checksum=checksum,
        )

        return {
            'type': 'file',
            'uuid': str(stored_file.uuid),
            'filename': stored_file.original_filename,
            'file_size_display': stored_file.file_size_display,
            'category': stored_file.category,
            'checksum': checksum,
        }
    finally:
        file_obj.close()


def _finalize_package_upload(session, checksum):
    """Create a PackageUpload record from the assembled file."""
    import json
    import zipfile
    import shutil
    from django.core.files.base import ContentFile

    manifest = {}
    name = session.filename.replace('.zip', '')
    version = '1.0.0'
    changelog = ''

    # Extract manifest from ZIP
    try:
        with zipfile.ZipFile(session.temp_path, 'r') as zf:
            for mf in ['update.json', 'manifest.json', 'module_update.json', 'frontend_update.json']:
                if mf in zf.namelist():
                    with zf.open(mf) as f:
                        manifest = json.loads(f.read().decode('utf-8'))
                        name = manifest.get('name', name)
                        version = manifest.get('version', version)
                        changelog = manifest.get('changelog', '')
                    break
    except Exception:
        pass

    # Import PackageUpload
    from apps.packages.models import PackageUpload

    with open(session.temp_path, 'rb') as f:
        file_content = ContentFile(f.read(), name=session.filename)

    package = PackageUpload.objects.create(
        package_type=session.package_type or 'module',
        name=name,
        version=version,
        file=file_content,
        file_size=session.total_size,
        upload_progress=100,
        checksum=checksum,
        status='ready',
        changelog=changelog,
        uploaded_by=session.uploaded_by,
        manifest=manifest,
    )

    return {
        'type': 'package',
        'package_id': str(package.id),
        'name': package.name,
        'version': package.version,
        'package_type': package.package_type,
        'status': package.status,
        'changelog': changelog,
        'checksum': checksum,
    }


# ── 4. STATUS — Check upload progress (for resume) ───────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chunked_upload_status(request, session_id):
    """
    GET /api/storage/upload/<session_id>/status/
    Returns current progress, allowing client to resume.
    """
    try:
        session = UploadSession.objects.get(id=session_id)
    except UploadSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'session_id': str(session.id),
        'filename': session.filename,
        'total_size': session.total_size,
        'bytes_received': session.bytes_received,
        'progress': session.progress,
        'status': session.status,
        'chunk_count': session.chunk_count,
        'upload_type': session.upload_type,
        'created_at': session.created_at.isoformat() if session.created_at else None,
        'expires_at': session.expires_at.isoformat() if session.expires_at else None,
        'is_expired': session.is_expired,
    })


# ── 5. LIST — Active upload sessions ─────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def active_uploads(request):
    """
    GET /api/storage/upload/active/
    Returns all non-expired, non-complete upload sessions.
    """
    sessions = UploadSession.objects.filter(
        status='uploading',
        expires_at__gt=timezone.now(),
    ).order_by('-created_at')

    upload_type = request.query_params.get('type')
    if upload_type:
        sessions = sessions.filter(upload_type=upload_type)

    data = [{
        'session_id': str(s.id),
        'filename': s.filename,
        'total_size': s.total_size,
        'bytes_received': s.bytes_received,
        'progress': s.progress,
        'upload_type': s.upload_type,
        'package_type': s.package_type,
        'category': s.category,
        'created_at': s.created_at.isoformat() if s.created_at else None,
    } for s in sessions[:50]]

    return Response({'uploads': data, 'count': len(data)})


# ── 6. ABORT — Cancel and cleanup a session ───────────────────────────────

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def chunked_upload_abort(request, session_id):
    """
    DELETE /api/storage/upload/<session_id>/abort/
    Cancels the upload, deletes temp file, and removes the session record.
    """
    try:
        session = UploadSession.objects.get(id=session_id)
    except UploadSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    # Cleanup temp file
    if os.path.exists(session.temp_path):
        try:
            os.remove(session.temp_path)
        except Exception as e:
            logger.error(f"Failed to delete temp file {session.temp_path}: {e}")

    session.delete()
    return Response({'status': 'aborted'}, status=status.HTTP_200_OK)
