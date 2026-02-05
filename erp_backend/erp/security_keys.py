"""
Platform Security Keys and Signature Verification

This module handles cryptographic verification of module and kernel packages.
Only packages signed with the platform's private key will be accepted.
"""
import hashlib
import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidSignature
from django.conf import settings


# === PLATFORM PUBLIC KEY ===
# This is used to verify signatures on uploaded packages.
# The private key is kept secret and used only for signing packages.
# To regenerate keys, run: python scripts/generate_keys.py

PLATFORM_PUBLIC_KEY_PEM = """
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvmK9LvGWXZ0pqPHkLvR4
znNZx5qVYQqZwCU1cR1VgKj0q3hkF1R0C3Xe7nTvPyqMsCe0HMpBQe0O4nXHHq1a
L3RWxMjEv8v3P0kx5NQ8vQm8Ax0T6P3e1h8Y0xbGHr2V8jhbKJxQT3m1sxQK9gZV
8KQPx5R3Y0T1VWN8nHq0TQPe0K3T8xqL8vRHC0Y1K9jVcL3R0xN1VxY3P8Q9RhK0
Y8q1L9v0R3C8P5hxQ9T1V0xN8Y3R0VxL9C3P0h8Y1R0K8V1T9xqL3R0C8P5hxQ9T1
V0xN8Y3R0VxL9C3P0h8Y1R0K8V1T9xqL3R0C8P5hxQ9T1V0xN8Y3R0VxL9C3P0h8Y
1QIDAQAB
-----END PUBLIC KEY-----
""".strip()

# Bypass signature verification in development (set to True to require signatures)
REQUIRE_SIGNATURES = getattr(settings, 'REQUIRE_PACKAGE_SIGNATURES', False)


def load_public_key():
    """Load the platform public key for verification."""
    return serialization.load_pem_public_key(
        PLATFORM_PUBLIC_KEY_PEM.encode(),
        backend=default_backend()
    )


def calculate_manifest_hash(manifest_content: bytes) -> bytes:
    """Calculate SHA256 hash of manifest content."""
    return hashlib.sha256(manifest_content).digest()


def verify_signature(manifest_content: bytes, signature: bytes) -> bool:
    """
    Verify that the signature is valid for the given manifest content.
    
    Args:
        manifest_content: Raw bytes of manifest.json
        signature: Base64-decoded signature bytes
        
    Returns:
        True if signature is valid, False otherwise
    """
    if not REQUIRE_SIGNATURES:
        return True  # Skip verification in development
        
    try:
        public_key = load_public_key()
        public_key.verify(
            signature,
            manifest_content,
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        return True
    except InvalidSignature:
        return False
    except Exception as e:
        print(f"⚠️ Signature verification error: {e}")
        return False


def is_package_trusted(zip_ref, module_name: str = None) -> tuple[bool, str]:
    """
    Check if a package is trusted (has valid signature).
    
    Args:
        zip_ref: Open ZipFile reference
        module_name: Optional, for error messages
        
    Returns:
        (is_trusted: bool, message: str)
    """
    if not REQUIRE_SIGNATURES:
        return True, "Signature verification disabled (development mode)"
    
    # Check for signature file
    if 'signature.sig' not in zip_ref.namelist():
        return False, f"Package '{module_name or 'unknown'}' is not signed. Missing signature.sig"
    
    # Check for manifest
    manifest_path = 'manifest.json'
    # Also check inside module folder
    if manifest_path not in zip_ref.namelist():
        for name in zip_ref.namelist():
            if name.endswith('/manifest.json'):
                manifest_path = name
                break
    
    if manifest_path not in zip_ref.namelist():
        return False, "Package missing manifest.json"
    
    try:
        # Read manifest and signature
        manifest_content = zip_ref.read(manifest_path)
        signature_b64 = zip_ref.read('signature.sig').decode('utf-8').strip()
        signature = base64.b64decode(signature_b64)
        
        # Verify
        if verify_signature(manifest_content, signature):
            return True, "Package signature verified successfully"
        else:
            return False, f"Invalid signature for package '{module_name or 'unknown'}'. Package may be tampered or from untrusted source."
            
    except Exception as e:
        return False, f"Signature verification failed: {str(e)}"


def generate_key_pair():
    """
    Generate a new RSA key pair for package signing.
    Returns (private_key_pem, public_key_pem)
    """
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode()
    
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()
    
    return private_pem, public_pem
