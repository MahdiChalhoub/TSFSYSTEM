"""
AES-256-GCM Field-Level Encryption Utility
============================================
Provides authenticated encryption for sensitive data fields.
Each organization gets its own 256-bit key for tenant isolation.

Usage:
    from erp.encryption import generate_org_key, encrypt_value, decrypt_value

    key = generate_org_key()                          # New 256-bit key (base64)
    encrypted = encrypt_value('SSN-123-45-6789', key) # -> 'enc:nonce:ciphertext:tag'
    original  = decrypt_value(encrypted, key)         # -> 'SSN-123-45-6789'
"""

import os
import base64
import logging
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)

# Prefix that identifies encrypted values in the database
ENCRYPTED_PREFIX = 'enc:'


def generate_org_key() -> str:
    """
    Generate a new AES-256 key for an organization.
    Returns a base64-encoded 32-byte key string.
    """
    raw_key = AESGCM.generate_key(bit_length=256)  # 32 bytes
    return base64.b64encode(raw_key).decode('utf-8')


def _decode_key(key_b64: str) -> bytes:
    """Decode a base64-encoded key string to raw bytes."""
    raw = base64.b64decode(key_b64)
    if len(raw) != 32:
        raise ValueError(f"Invalid AES-256 key length: expected 32 bytes, got {len(raw)}")
    return raw


def encrypt_value(plaintext: str, key_b64: str) -> str:
    """
    Encrypt a plaintext string using AES-256-GCM.
    
    Returns a string in the format: 'enc:<nonce_b64>:<ciphertext_b64>'
    The nonce and authentication tag are embedded in the ciphertext by AESGCM.
    
    Args:
        plaintext: The string to encrypt
        key_b64: Base64-encoded 256-bit key
    
    Returns:
        Encrypted string with 'enc:' prefix
    """
    if not plaintext:
        return plaintext
    
    if is_encrypted(plaintext):
        return plaintext  # Already encrypted, don't double-encrypt
    
    key = _decode_key(key_b64)
    aesgcm = AESGCM(key)
    
    # 96-bit nonce (recommended for GCM)
    nonce = os.urandom(12)
    
    # Encrypt (AESGCM appends the auth tag to the ciphertext automatically)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
    
    # Encode as: enc:<nonce_b64>:<ciphertext_with_tag_b64>
    nonce_b64 = base64.b64encode(nonce).decode('utf-8')
    ct_b64 = base64.b64encode(ciphertext).decode('utf-8')
    
    return f"{ENCRYPTED_PREFIX}{nonce_b64}:{ct_b64}"


def decrypt_value(encrypted_str: str, key_b64: str) -> str:
    """
    Decrypt an AES-256-GCM encrypted string.
    
    Args:
        encrypted_str: String in format 'enc:<nonce_b64>:<ciphertext_b64>'
        key_b64: Base64-encoded 256-bit key
    
    Returns:
        Decrypted plaintext string
    
    Raises:
        ValueError: If the encrypted string format is invalid
        cryptography.exceptions.InvalidTag: If authentication fails (tampered data)
    """
    if not encrypted_str or not is_encrypted(encrypted_str):
        return encrypted_str  # Not encrypted, return as-is
    
    try:
        # Strip prefix and split: nonce:ciphertext
        payload = encrypted_str[len(ENCRYPTED_PREFIX):]
        parts = payload.split(':')
        
        if len(parts) != 2:
            raise ValueError(f"Invalid encrypted format: expected 2 parts, got {len(parts)}")
        
        nonce_b64, ct_b64 = parts
        nonce = base64.b64decode(nonce_b64)
        ciphertext = base64.b64decode(ct_b64)
        key = _decode_key(key_b64)
        
        aesgcm = AESGCM(key)
        plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        
        return plaintext_bytes.decode('utf-8')
    
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        raise


def is_encrypted(value: str) -> bool:
    """Check if a string value is already encrypted (has the enc: prefix)."""
    return isinstance(value, str) and value.startswith(ENCRYPTED_PREFIX)


def mask_value(value: str, visible_chars: int = 4) -> str:
    """
    Return a masked version of a value for display purposes.
    Example: 'SSN-123-45-6789' -> '••••••••••6789'
    """
    if not value:
        return value
    if len(value) <= visible_chars:
        return '•' * len(value)
    return '•' * (len(value) - visible_chars) + value[-visible_chars:]
