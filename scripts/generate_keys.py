#!/usr/bin/env python
"""
Key Pair Generator

Generates RSA key pair for signing platform packages.
- Private key: Keep secret, used to sign packages
- Public key: Goes into security_keys.py for verification

Usage:
    python generate_keys.py [output_dir]
    
Example:
    python generate_keys.py keys/
"""
import sys
import os

# Add parent to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'erp_backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

try:
    import django
    django.setup()
    from erp.security_keys import generate_key_pair
except:
    # Fallback if Django not available
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.backends import default_backend
    
    def generate_key_pair():
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


def main():
    output_dir = sys.argv[1] if len(sys.argv) > 1 else 'keys'
    os.makedirs(output_dir, exist_ok=True)
    
    print("🔑 Generating RSA-2048 key pair...")
    private_pem, public_pem = generate_key_pair()
    
    # Save private key
    private_path = os.path.join(output_dir, 'private_key.pem')
    with open(private_path, 'w') as f:
        f.write(private_pem)
    print(f"🔒 Private key saved: {private_path}")
    print("   ⚠️  KEEP THIS SECRET! Do not commit to git!")
    
    # Save public key
    public_path = os.path.join(output_dir, 'public_key.pem')
    with open(public_path, 'w') as f:
        f.write(public_pem)
    print(f"🔓 Public key saved: {public_path}")
    
    print("\n📋 To enable signature verification:")
    print("   1. Copy the public key content to erp/security_keys.py")
    print("   2. Set REQUIRE_PACKAGE_SIGNATURES = True in settings.py")
    print(f"\n🔐 Public Key:\n{public_pem}")


if __name__ == '__main__':
    main()
