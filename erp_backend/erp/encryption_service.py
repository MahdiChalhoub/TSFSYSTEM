"""
Encryption Service — Manages the AES-256 encryption lifecycle for organizations.
==================================================================================
Handles activation, deactivation, key rotation, and entitlement checks.
"""

import logging
from erp.encryption import generate_org_key, encrypt_value, decrypt_value, is_encrypted

logger = logging.getLogger(__name__)


class EncryptionService:
    """Manages AES-256 encryption lifecycle per organization."""
    
    @staticmethod
    def check_addon_entitlement(org) -> bool:
        """
        Check if the organization is entitled to use encryption.
        Returns True if:
        1. The org's plan includes an encryption add-on, OR
        2. The org has directly purchased an encryption add-on (OrganizationAddon).
        """
        from erp.models import PlanAddon, OrganizationAddon
        
        # Check 1: Direct org-level purchase (OrganizationAddon)
        if OrganizationAddon.objects.filter(
            organization=org,
            addon__addon_type='encryption',
            status='active',
        ).exists():
            return True
        
        # Check 2: Plan-level entitlement (PlanAddon linked to org's plan)
        if not org.current_plan:
            return False
        
        return PlanAddon.objects.filter(
            plans=org.current_plan,
            addon_type='encryption',
            is_active=True,
        ).exists()
    
    @staticmethod
    def activate(org, force: bool = False) -> dict:
        """
        Activate AES-256 encryption for an organization.
        
        Args:
            org: Organization instance
            force: Skip entitlement check (for superadmin use)
        
        Returns:
            dict with status and details
        """
        # Check entitlement (unless forced by superadmin)
        if not force and not EncryptionService.check_addon_entitlement(org):
            return {
                'success': False,
                'error': 'Organization plan does not include the AES-256 Encryption add-on.',
                'hint': 'Upgrade your plan or purchase the encryption add-on.',
            }
        
        # If already active, return current status
        if org.encryption_enabled and org.encryption_key:
            return {
                'success': True,
                'status': 'already_active',
                'message': 'Encryption is already active for this organization.',
            }
        
        # Generate a new key if none exists
        if not org.encryption_key:
            org.encryption_key = generate_org_key()
        
        org.encryption_enabled = True
        org.save(update_fields=['encryption_key', 'encryption_enabled'])
        
        logger.info(f"AES-256 encryption activated for org '{org.slug}' (id={org.id})")
        
        return {
            'success': True,
            'status': 'activated',
            'message': f'AES-256 encryption activated for {org.name}.',
        }
    
    @staticmethod
    def deactivate(org) -> dict:
        """
        Deactivate encryption for an organization.
        The key is preserved so existing encrypted data can still be read.
        """
        if not org.encryption_enabled:
            return {
                'success': True,
                'status': 'already_inactive',
                'message': 'Encryption is already inactive.',
            }
        
        org.encryption_enabled = False
        org.save(update_fields=['encryption_enabled'])
        
        logger.info(f"AES-256 encryption deactivated for org '{org.slug}' (key preserved)")
        
        return {
            'success': True,
            'status': 'deactivated',
            'message': f'Encryption deactivated for {org.name}. Key preserved for reading existing data.',
            'warning': 'New data will be stored as plaintext. Existing encrypted data remains readable.',
        }
    
    @staticmethod
    def rotate_key(org) -> dict:
        """
        Rotate the encryption key for an organization.
        Generates a new key and re-encrypts all fields that use EncryptedCharField.
        
        WARNING: This is a heavyweight operation that touches all encrypted records.
        """
        if not org.encryption_enabled or not org.encryption_key:
            return {
                'success': False,
                'error': 'Encryption must be active before rotating keys.',
            }
        
        old_key = org.encryption_key
        new_key = generate_org_key()
        
        # Re-encrypt all fields that use EncryptedCharField
        re_encrypted_count = EncryptionService._re_encrypt_all_fields(org, old_key, new_key)
        
        # Update the org key
        org.encryption_key = new_key
        org.save(update_fields=['encryption_key'])
        
        logger.info(f"Key rotated for org '{org.slug}': {re_encrypted_count} values re-encrypted")
        
        return {
            'success': True,
            'status': 'rotated',
            'message': f'Key rotated. {re_encrypted_count} encrypted values updated.',
        }
    
    @staticmethod
    def get_status(org) -> dict:
        """Get the current encryption status for an organization."""
        return {
            'organization': org.name,
            'encryption_enabled': org.encryption_enabled,
            'has_key': bool(org.encryption_key),
            'addon_entitled': EncryptionService.check_addon_entitlement(org),
            'plan': org.current_plan.name if org.current_plan else None,
        }
    
    @staticmethod
    def _re_encrypt_all_fields(org, old_key: str, new_key: str) -> int:
        """
        Find all models with EncryptedCharField and re-encrypt their values.
        Returns the count of re-encrypted values.
        """
        from django.apps import apps
        from erp.fields import EncryptedCharField as ECF
        
        count = 0
        
        for model in apps.get_models():
            encrypted_fields = [
                f for f in model._meta.get_fields()
                if isinstance(f, ECF)
            ]
            
            if not encrypted_fields:
                continue
            
            # Only process records belonging to this organization
            org_filter = {}
            if hasattr(model, 'organization_id'):
                org_filter['organization_id'] = org.id
            elif hasattr(model, 'organization'):
                org_filter['organization'] = org
            else:
                continue  # Skip models without org relationship
            
            for record in model.objects.filter(**org_filter):
                changed = False
                for field in encrypted_fields:
                    raw_value = getattr(record, field.attname)
                    if raw_value and is_encrypted(raw_value):
                        try:
                            plaintext = decrypt_value(raw_value, old_key)
                            new_encrypted = encrypt_value(plaintext, new_key)
                            setattr(record, field.attname, new_encrypted)
                            changed = True
                            count += 1
                        except Exception as e:
                            logger.warning(f"Failed to re-encrypt {model.__name__}.{field.name} pk={record.pk}: {e}")
                
                if changed:
                    record.save(update_fields=[f.attname for f in encrypted_fields])
        
        return count
