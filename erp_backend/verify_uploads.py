import os
import django
import uuid
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from django.urls import reverse

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.storage.models import StoredFile, StorageProvider
from apps.migration.models import MigrationJob
from erp.models import Organization, User

def verify_uploads():
    print("🚀 Starting Upload Verification...")
    
    # 1. Setup Test Data
    org, _ = Organization.objects.get_or_create(slug='test-org', defaults={'name': 'Test Org'})
    user, _ = User.objects.get_or_create(username='test-admin', defaults={'email': 'test@example.com', 'is_staff': True})
    user.organization = org
    user.save()
    
    # Ensure a local storage provider exists
    StorageProvider.objects.get_or_create(
        organization=org,
        defaults={'provider_type': 'LOCAL', 'bucket_name': 'test-bucket'}
    )
    
    client = Client(HTTP_HOST='localhost')
    client.force_login(user)
    
    # 2. Test Standard Storage Upload
    print("📦 Testing Standard Storage Upload...")
    file_content = b"test content"
    f = SimpleUploadedFile("test.txt", file_content, content_type="text/plain")
    
    response = client.post('/api/storage/files/upload/', {'file': f, 'category': 'ATTACHMENT'})
    if response.status_code == 201:
        print("✅ Standard Storage Upload: SUCCESS")
        file_uuid = response.json()['uuid']
    else:
        print(f"❌ Standard Storage Upload: FAILED ({response.status_code})")
        print(response.json())
        return

    # 3. Test Migration Upload (Fix Verification)
    print("🚚 Testing Migration Upload...")
    sql_content = b"CREATE TABLE users (id INT);"
    sql_file = SimpleUploadedFile("dump.sql", sql_content, content_type="application/sql")
    
    response = client.post('/api/migration/jobs/upload/', {'file': sql_file, 'name': 'Test Migration'})
    if response.status_code == 201:
        print("✅ Migration Upload: SUCCESS (Bug Fixed!)")
        migration_job_id = response.json()['id']
    else:
        print(f"❌ Migration Upload: FAILED ({response.status_code})")
        print(response.json())
        return

    # 4. Test Chunked Upload
    print("🧩 Testing Chunked Upload (Chunk 1 robustness)...")
    # Init
    response = client.post('/api/storage/upload/init/', {
        'filename': 'chunked.sql',
        'total_size': 20,
        'category': 'MIGRATION',
        'content_type': 'application/sql'
    }, content_type='application/json')
    
    if response.status_code != 201:
        print(f"❌ Chunked Upload Init: FAILED ({response.status_code})")
        print(response.json())
        return
    
    session_id = response.json()['session_id']
    chunk_url = response.json()['chunk_url']
    
    # Chunk 1
    chunk1 = SimpleUploadedFile("chunk1", b"CREATE TABLE tbl ", content_type="application/octet-stream")
    response = client.post(chunk_url, {'chunk': chunk1, 'offset': 0})
    
    if response.status_code == 200:
        print("✅ Chunk 1: SUCCESS")
    else:
        print(f"❌ Chunk 1: FAILED ({response.status_code})")
        print(response.json())
        return
        
    # Chunk 2
    chunk2 = SimpleUploadedFile("chunk2", b"(id INT);", content_type="application/octet-stream")
    response = client.post(chunk_url, {'chunk': chunk2, 'offset': 17})
    
    if response.status_code == 200:
        print("✅ Chunk 2: SUCCESS")
    else:
        print(f"❌ Chunk 2: FAILED ({response.status_code})")
        print(response.json())
        return
        
    # Complete
    response = client.post(f'/api/storage/upload/{session_id}/complete/', {}, content_type='application/json')
    if response.status_code == 201:
        print("✅ Chunked Upload Complete: SUCCESS")
        chunked_file_uuid = response.json()['uuid']
    else:
        print(f"❌ Chunked Upload Complete: FAILED ({response.status_code})")
        print(response.json())
        return

    # 5. Test Migration Link
    print("🔗 Testing Migration Link...")
    response = client.post('/api/migration/jobs/link/', {
        'file_uuid': chunked_file_uuid,
        'name': 'Linked Migration'
    }, content_type='application/json')
    
    if response.status_code == 201:
        print("✅ Migration Link: SUCCESS")
    else:
        print(f"❌ Migration Link: FAILED ({response.status_code})")
        print(response.json())
        return

    print("\n✨ All Upload Verifications Passed!")

if __name__ == "__main__":
    verify_uploads()
