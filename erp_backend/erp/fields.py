"""
EncryptedCharField — Transparent AES-256 encryption for Django model fields.
=============================================================================
Drop-in replacement for CharField that automatically encrypts on save 
and decrypts on read, using the organization's AES-256 key.

Usage in models:
    from erp.fields import EncryptedCharField
    
    class Employee(models.Model):
        ssn = EncryptedCharField(max_length=500, verbose_name='Social Security Number')
        bank_account = EncryptedCharField(max_length=500, verbose_name='Bank Account')

The field stores encrypted data as 'enc:<nonce>:<ciphertext>' in the DB.
If the organization doesn't have encryption enabled, data is stored as plaintext.
"""

import threading
from django.db import models
from erp.encryption import encrypt_value, decrypt_value, is_encrypted

# Thread-local storage for the current organization's encryption context
_encryption_context = threading.local()


def set_encryption_context(org):
    """
    Set the current organization for encryption operations.
    Called by middleware or views before processing requests.
    """
    _encryption_context.org = org


def get_encryption_context():
    """Get the current organization from thread-local storage."""
    return getattr(_encryption_context, 'org', None)


def clear_encryption_context():
    """Clear the encryption context after request processing."""
    _encryption_context.org = None


class EncryptedCharField(models.CharField):
    """
    CharField that transparently encrypts/decrypts using AES-256-GCM.
    
    - On save: encrypts plaintext using the org's key (if encryption is enabled)
    - On read: decrypts automatically (if the value has the 'enc:' prefix)
    - If no encryption key is available, operates as a normal CharField
    """
    
    def __init__(self, *args, **kwargs):
        # Encrypted values are longer than plaintext — ensure sufficient max_length
        # AES-256-GCM overhead: ~16 bytes nonce + ~16 bytes tag + base64 encoding + prefix
        # Roughly 2.5x the original max_length is safe
        kwargs.setdefault('max_length', 500)
        super().__init__(*args, **kwargs)
    
    def get_prep_value(self, value):
        """Encrypt the value before saving to the database."""
        value = super().get_prep_value(value)
        
        if not value:
            return value
        
        # Don't re-encrypt already encrypted values
        if is_encrypted(value):
            return value
        
        # Get the org from thread-local context
        org = get_encryption_context()
        if org and getattr(org, 'encryption_enabled', False) and getattr(org, 'encryption_key', None):
            try:
                return encrypt_value(value, org.encryption_key)
            except Exception:
                # If encryption fails, store plaintext (fail-open for data safety)
                return value
        
        return value
    
    def from_db_value(self, value, expression, connection):
        """Decrypt the value when reading from the database."""
        if not value or not is_encrypted(value):
            return value
        
        # Get the org from thread-local context
        org = get_encryption_context()
        if org and getattr(org, 'encryption_key', None):
            try:
                return decrypt_value(value, org.encryption_key)
            except Exception:
                # If decryption fails, return the encrypted value
                # (better than crashing — admin can investigate)
                return value
        
        # No org context or no key — return encrypted value as-is
        return value
    
    def deconstruct(self):
        """Support Django migrations."""
        name, path, args, kwargs = super().deconstruct()
        # Use our custom field path for migrations
        path = 'erp.fields.EncryptedCharField'
        return name, path, args, kwargs
