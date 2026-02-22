"""
Storage Module — backends.py
S3-compatible storage backend for Cloudflare R2 / AWS S3 / MinIO.
Handles upload, download (presigned URLs), and delete operations.
"""
import hashlib
import logging
import os
import uuid as uuid_lib
from datetime import datetime

from django.conf import settings

logger = logging.getLogger(__name__)


def _get_boto3_client(provider):
    """
    Create a boto3 S3 client from a StorageProvider instance or env defaults.
    """
    import boto3
    from botocore.config import Config

    endpoint_url = provider.endpoint_url if provider else getattr(settings, 'STORAGE_R2_ENDPOINT', '')
    access_key = provider.access_key if provider else getattr(settings, 'STORAGE_R2_ACCESS_KEY', '')
    secret_key = provider.secret_key if provider else getattr(settings, 'STORAGE_R2_SECRET_KEY', '')
    region = provider.region if provider else 'auto'

    if not endpoint_url or not access_key or not secret_key:
        raise ValueError("Storage provider credentials are not configured.")

    return boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
        config=Config(
            signature_version='s3v4',
            retries={'max_attempts': 3, 'mode': 'adaptive'},
        ),
    )


def _build_storage_key(provider, category, original_filename, linked_model='', linked_id=None, org_slug=''):
    """
    Build the S3 object key with strict isolation:
    {prefix}{module}/{feature}/{id}/{filename}
    Fallback to: {prefix}{category}/{YYYY-MM}/{uuid}_{filename}
    """
    # 0. Determine isolation prefix
    if provider and provider.path_prefix:
        prefix = provider.path_prefix
    elif org_slug:
        prefix = f"{org_slug}/"
    else:
        prefix = ''
    
    # 1. Attempt structured path if linked_model exists
    if linked_model and '.' in linked_model:
        try:
            module, model_name = linked_model.split('.', 1)
            feature = model_name.lower()
            # Pluralize feature if possible or just use it
            if not feature.endswith('s'):
                feature = f"{feature}s"
            
            identifier = str(linked_id) if linked_id else 'general'
            
            # Sanitise filename
            safe_name = original_filename.replace(' ', '_').replace('/', '_')
            return f"{prefix}{module}/{feature}/{identifier}/{safe_name}"
        except Exception:
            pass

    # 2. Fallback to category-based flat structure if no linked model
    now = datetime.utcnow()
    date_part = now.strftime('%Y-%m')
    unique = uuid_lib.uuid4().hex[:12]
    safe_name = original_filename.replace(' ', '_').replace('/', '_')
    return f"{prefix}{category.lower()}/{date_part}/{unique}_{safe_name}"


def _compute_checksum(file_obj):
    """Compute SHA-256 checksum of an uploaded file."""
    sha = hashlib.sha256()
    file_obj.seek(0)
    for chunk in file_obj.chunks() if hasattr(file_obj, 'chunks') else iter(lambda: file_obj.read(8192), b''):
        sha.update(chunk)
    file_obj.seek(0)
    return sha.hexdigest()


def upload_to_cloud(provider, file_obj, category, original_filename, linked_model='', linked_id=None, org_slug=''):
    """
    Upload a file to the configured cloud storage.
    Returns (storage_key, bucket, checksum, file_size).
    Falls back to local media storage if provider_type == LOCAL.
    """
    bucket = provider.bucket_name if provider else getattr(settings, 'STORAGE_R2_BUCKET', 'tsf-files')
    storage_key = _build_storage_key(
        provider, category, original_filename,
        linked_model=linked_model, linked_id=linked_id,
        org_slug=org_slug
    )
    checksum = _compute_checksum(file_obj)
    file_size = file_obj.size if hasattr(file_obj, 'size') else 0

    provider_type = provider.provider_type if provider else getattr(settings, 'STORAGE_DEFAULT_PROVIDER', 'LOCAL')

    if provider_type == 'LOCAL':
        return _upload_local(file_obj, storage_key, bucket, checksum, file_size)

    # Cloud upload (R2 / S3 / MinIO)
    client = _get_boto3_client(provider)
    content_type = getattr(file_obj, 'content_type', 'application/octet-stream')

    file_obj.seek(0)
    client.put_object(
        Bucket=bucket,
        Key=storage_key,
        Body=file_obj.read(),
        ContentType=content_type,
    )
    logger.info(f"Uploaded {storage_key} to {bucket} ({provider_type})")
    return storage_key, bucket, checksum, file_size


def generate_download_url(provider, storage_key, bucket, expires_in=3600):
    """
    Generate a presigned URL for downloading a file.
    Returns a URL string valid for `expires_in` seconds (default 1 hour).
    """
    provider_type = provider.provider_type if provider else getattr(settings, 'STORAGE_DEFAULT_PROVIDER', 'LOCAL')

    if provider_type == 'LOCAL':
        # Return the local media URL
        media_url = getattr(settings, 'MEDIA_URL', '/media/')
        return f"{media_url}{storage_key}"

    client = _get_boto3_client(provider)
    url = client.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket, 'Key': storage_key},
        ExpiresIn=expires_in,
    )
    return url


def delete_from_cloud(provider, storage_key, bucket):
    """
    Delete a file from cloud storage.
    """
    provider_type = provider.provider_type if provider else getattr(settings, 'STORAGE_DEFAULT_PROVIDER', 'LOCAL')

    if provider_type == 'LOCAL':
        return _delete_local(storage_key)

    client = _get_boto3_client(provider)
    client.delete_object(Bucket=bucket, Key=storage_key)
    logger.info(f"Deleted {storage_key} from {bucket}")


def get_file_stream(provider, storage_key, bucket):
    """
    Returns a stream-aware object for reading a file.
    For LOCAL: returns a file handle.
    For Cloud: returns the boto3 StreamingBody.
    """
    provider_type = provider.provider_type if provider else getattr(settings, 'STORAGE_DEFAULT_PROVIDER', 'LOCAL')

    if provider_type == 'LOCAL':
        file_path = os.path.join(settings.MEDIA_ROOT, storage_key)
        return open(file_path, 'rb')

    client = _get_boto3_client(provider)
    response = client.get_object(Bucket=bucket, Key=storage_key)
    return response['Body']


def get_local_path(provider, storage_key, bucket):
    """
    Returns an absolute path to the file.
    If cloud-stored, downloads it to a temporary location first.
    """
    provider_type = provider.provider_type if provider else getattr(settings, 'STORAGE_DEFAULT_PROVIDER', 'LOCAL')

    if provider_type == 'LOCAL':
        return os.path.abspath(os.path.join(settings.MEDIA_ROOT, storage_key))

    # Download to temp file
    import tempfile
    suffix = os.path.splitext(storage_key)[1]
    # We use delete=False because we want the path to remain valid after close
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    
    client = _get_boto3_client(provider)
    client.download_fileobj(bucket, storage_key, tmp)
    tmp.close()
    
    return tmp.name


def test_connection(provider):
    """
    Test connectivity to the configured storage provider.
    Returns (success: bool, message: str).
    """
    provider_type = provider.provider_type if provider else getattr(settings, 'STORAGE_DEFAULT_PROVIDER', 'LOCAL')

    if provider_type == 'LOCAL':
        media_root = getattr(settings, 'MEDIA_ROOT', '')
        if media_root and os.path.isdir(media_root):
            return True, "Local storage directory exists."
        return False, f"Local media root not found: {media_root}"

    try:
        client = _get_boto3_client(provider)
        bucket = provider.bucket_name if provider else getattr(settings, 'STORAGE_R2_BUCKET', 'tsf-files')
        client.head_bucket(Bucket=bucket)
        return True, f"Successfully connected to bucket '{bucket}'."
    except Exception as e:
        return False, f"Connection failed: {str(e)}"


# ── Local storage fallback ────────────────────────────────────────

def _upload_local(file_obj, storage_key, bucket, checksum, file_size):
    """Save file to MEDIA_ROOT for local dev."""
    media_root = getattr(settings, 'MEDIA_ROOT', os.path.join(settings.BASE_DIR, 'media'))
    full_path = os.path.join(media_root, storage_key)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    file_obj.seek(0)
    with open(full_path, 'wb') as dest:
        for chunk in file_obj.chunks() if hasattr(file_obj, 'chunks') else iter(lambda: file_obj.read(8192), b''):
            dest.write(chunk)

    logger.info(f"Saved locally: {full_path}")
    return storage_key, bucket, checksum, file_size


def _delete_local(storage_key):
    """Delete a file from MEDIA_ROOT."""
    media_root = getattr(settings, 'MEDIA_ROOT', os.path.join(settings.BASE_DIR, 'media'))
    full_path = os.path.join(media_root, storage_key)
    if os.path.exists(full_path):
        os.remove(full_path)
        logger.info(f"Deleted locally: {full_path}")
