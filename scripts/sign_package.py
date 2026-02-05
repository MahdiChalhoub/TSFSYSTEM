#!/usr/bin/env python
"""
Package Signing Tool

Signs module (.modpkg.zip) and kernel (.kernel.zip) packages with RSA signature.
Only signed packages will be accepted by the platform when signature verification is enabled.

Usage:
    python sign_package.py <package.zip> <private_key.pem>
    
Example:
    python sign_package.py dist/demo_v1.0.0.modpkg.zip keys/private_key.pem
"""
import sys
import os
import json
import base64
import zipfile
import tempfile
import shutil
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend


def load_private_key(key_path: str):
    """Load private key from PEM file."""
    with open(key_path, 'rb') as f:
        return serialization.load_pem_private_key(
            f.read(),
            password=None,
            backend=default_backend()
        )


def sign_manifest(manifest_content: bytes, private_key) -> str:
    """
    Sign manifest content and return base64-encoded signature.
    """
    signature = private_key.sign(
        manifest_content,
        padding.PKCS1v15(),
        hashes.SHA256()
    )
    return base64.b64encode(signature).decode('utf-8')


def find_manifest_in_zip(zip_path: str) -> str:
    """Find the manifest.json path inside the zip."""
    with zipfile.ZipFile(zip_path, 'r') as zf:
        names = zf.namelist()
        
        # Check root level
        if 'manifest.json' in names:
            return 'manifest.json'
        
        # Check for update.json (kernel packages)
        if 'update.json' in names:
            return 'update.json'
        
        # Check inside module folder
        for name in names:
            if name.endswith('/manifest.json'):
                return name
                
    raise ValueError("No manifest.json or update.json found in package")


def sign_package(package_path: str, private_key_path: str) -> str:
    """
    Sign a package by adding signature.sig to it.
    Returns path to signed package.
    """
    if not os.path.exists(package_path):
        raise FileNotFoundError(f"Package not found: {package_path}")
    
    if not os.path.exists(private_key_path):
        raise FileNotFoundError(f"Private key not found: {private_key_path}")
    
    # Load private key
    private_key = load_private_key(private_key_path)
    
    # Find manifest
    manifest_path = find_manifest_in_zip(package_path)
    print(f"📄 Found manifest: {manifest_path}")
    
    # Read manifest content
    with zipfile.ZipFile(package_path, 'r') as zf:
        manifest_content = zf.read(manifest_path)
    
    # Create signature
    signature_b64 = sign_manifest(manifest_content, private_key)
    print(f"🔐 Generated signature: {signature_b64[:32]}...")
    
    # Create new zip with signature
    temp_dir = tempfile.mkdtemp()
    try:
        # Extract existing package
        with zipfile.ZipFile(package_path, 'r') as zf:
            zf.extractall(temp_dir)
        
        # Add signature file
        sig_path = os.path.join(temp_dir, 'signature.sig')
        with open(sig_path, 'w') as f:
            f.write(signature_b64)
        
        # Determine output path
        base, ext = os.path.splitext(package_path)
        if package_path.endswith('.modpkg.zip'):
            base = package_path.replace('.modpkg.zip', '')
            output_path = f"{base}.signed.modpkg.zip"
        elif package_path.endswith('.kernel.zip'):
            base = package_path.replace('.kernel.zip', '')
            output_path = f"{base}.signed.kernel.zip"
        else:
            output_path = f"{base}.signed{ext}"
        
        # Create signed package
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zf.write(file_path, arcname)
        
        print(f"✅ Signed package created: {output_path}")
        return output_path
        
    finally:
        shutil.rmtree(temp_dir)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        print("\nError: Missing arguments")
        print("Usage: python sign_package.py <package.zip> <private_key.pem>")
        sys.exit(1)
    
    package_path = sys.argv[1]
    private_key_path = sys.argv[2]
    
    try:
        sign_package(package_path, private_key_path)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
