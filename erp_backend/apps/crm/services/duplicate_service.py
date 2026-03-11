"""
CRM Duplicate Detection Service
=================================
Checks for potential duplicate contacts based on normalized comparison
of email, phone, VAT ID, company name, and WhatsApp number.

Severity Levels:
    HARD_DUPLICATE:     Confident match (same unique identifier within org)
    LIKELY_DUPLICATE:   Strong similarity (several fields match)
    POSSIBLE_DUPLICATE: Weak heuristic overlap (name similarity only)

Usage:
    from apps.crm.services.duplicate_service import DuplicateDetectionService

    result = DuplicateDetectionService.check_for_duplicates(
        organization_id=org.id,
        name='Acme Corp',
        email='acme@example.com',
        phone='+2250700001122',
        vat_id='CI123456789',
        company_name='Acme Corporation',
    )

    if result['has_duplicates']:
        for dup in result['duplicates']:
            print(f"{dup['severity']}: Contact #{dup['contact_id']} ({dup['contact_name']})")
"""
import re
import logging
from django.db.models import Q

logger = logging.getLogger(__name__)


class DuplicateDetectionService:
    """Service for detecting potential duplicate contacts within an organization."""

    # Fields that, when matched exactly, indicate a hard duplicate
    HARD_UNIQUE_FIELDS = ('email', 'vat_id')

    # Fields that, when matched, indicate a likely duplicate
    SOFT_MATCH_FIELDS = ('phone', 'whatsapp_group_id')

    @classmethod
    def check_for_duplicates(cls, organization_id, name=None, email=None, phone=None,
                              vat_id=None, company_name=None, whatsapp_group_id=None,
                              exclude_contact_id=None):
        """
        Check for potential duplicate contacts.

        Returns:
            {
                'has_duplicates': bool,
                'highest_severity': 'HARD_DUPLICATE' | 'LIKELY_DUPLICATE' | 'POSSIBLE_DUPLICATE' | None,
                'duplicates': [
                    {
                        'contact_id': int,
                        'contact_name': str,
                        'contact_type': str,
                        'severity': str,
                        'matched_fields': [str],
                        'status': str,  # contact lifecycle status
                    }
                ],
                'allow_create': bool,  # True if no HARD duplicates found
            }
        """
        from apps.crm.models import Contact

        duplicates = []
        seen_ids = set()

        base_qs = Contact.objects.filter(tenant_id=organization_id)
        if exclude_contact_id:
            base_qs = base_qs.exclude(id=exclude_contact_id)

        # ── Hard duplicate checks (unique identifiers) ──────────────
        if email and email.strip():
            normalized_email = cls._normalize_email(email)
            email_matches = base_qs.filter(email__iexact=normalized_email)
            for c in email_matches:
                if c.id not in seen_ids:
                    seen_ids.add(c.id)
                    duplicates.append(cls._build_dup_entry(c, 'HARD_DUPLICATE', ['email']))

        if vat_id and vat_id.strip():
            normalized_vat = cls._normalize_vat(vat_id)
            vat_matches = base_qs.filter(vat_id__iexact=normalized_vat)
            for c in vat_matches:
                if c.id not in seen_ids:
                    seen_ids.add(c.id)
                    duplicates.append(cls._build_dup_entry(c, 'HARD_DUPLICATE', ['vat_id']))
                else:
                    # Already found — add matched field
                    for d in duplicates:
                        if d['contact_id'] == c.id:
                            d['matched_fields'].append('vat_id')

        # ── Likely duplicate checks (strong signals) ────────────────
        if phone and phone.strip():
            normalized_phone = cls._normalize_phone(phone)
            if normalized_phone:
                phone_matches = base_qs.filter(
                    Q(phone__icontains=normalized_phone[-8:])  # Match last 8 digits
                )
                for c in phone_matches:
                    if c.id not in seen_ids:
                        seen_ids.add(c.id)
                        duplicates.append(cls._build_dup_entry(c, 'LIKELY_DUPLICATE', ['phone']))
                    else:
                        for d in duplicates:
                            if d['contact_id'] == c.id:
                                d['matched_fields'].append('phone')

        # Company name + phone combo (strong signal for B2B)
        if company_name and phone:
            normalized_company = cls._normalize_name(company_name)
            if normalized_company:
                combo_matches = base_qs.filter(
                    company_name__iexact=normalized_company,
                ).exclude(company_name__isnull=True).exclude(company_name='')
                for c in combo_matches:
                    if c.id not in seen_ids:
                        seen_ids.add(c.id)
                        duplicates.append(cls._build_dup_entry(c, 'LIKELY_DUPLICATE', ['company_name']))
                    else:
                        for d in duplicates:
                            if d['contact_id'] == c.id and 'company_name' not in d['matched_fields']:
                                d['matched_fields'].append('company_name')

        # WhatsApp number
        if whatsapp_group_id and whatsapp_group_id.strip():
            wa_matches = base_qs.filter(whatsapp_group_id=whatsapp_group_id)
            for c in wa_matches:
                if c.id not in seen_ids:
                    seen_ids.add(c.id)
                    duplicates.append(cls._build_dup_entry(c, 'LIKELY_DUPLICATE', ['whatsapp_group_id']))

        # ── Possible duplicate checks (name heuristic) ──────────────
        if name and name.strip():
            normalized_name = cls._normalize_name(name)
            if normalized_name and len(normalized_name) >= 3:
                name_matches = base_qs.filter(
                    name__iexact=normalized_name
                )
                for c in name_matches:
                    if c.id not in seen_ids:
                        seen_ids.add(c.id)
                        duplicates.append(cls._build_dup_entry(c, 'POSSIBLE_DUPLICATE', ['name']))

        # ── Determine severity precedence ───────────────────────────
        severity_order = {'HARD_DUPLICATE': 3, 'LIKELY_DUPLICATE': 2, 'POSSIBLE_DUPLICATE': 1}
        highest = None
        for d in duplicates:
            if highest is None or severity_order.get(d['severity'], 0) > severity_order.get(highest, 0):
                highest = d['severity']

        has_hard_dup = any(d['severity'] == 'HARD_DUPLICATE' for d in duplicates)

        return {
            'has_duplicates': len(duplicates) > 0,
            'highest_severity': highest,
            'duplicates': duplicates,
            'allow_create': not has_hard_dup,
        }

    @staticmethod
    def _build_dup_entry(contact, severity, matched_fields):
        return {
            'contact_id': contact.id,
            'contact_name': contact.name,
            'contact_type': contact.type,
            'severity': severity,
            'matched_fields': matched_fields,
            'status': getattr(contact, 'status', 'ACTIVE'),
        }

    @staticmethod
    def _normalize_email(email):
        """Lowercase, strip whitespace."""
        return email.strip().lower() if email else ''

    @staticmethod
    def _normalize_phone(phone):
        """Remove all non-digit characters."""
        if not phone:
            return ''
        return re.sub(r'[^\d]', '', phone)

    @staticmethod
    def _normalize_vat(vat_id):
        """Uppercase, strip whitespace and common separators."""
        if not vat_id:
            return ''
        return re.sub(r'[\s\-\.\/]', '', vat_id.strip().upper())

    @staticmethod
    def _normalize_name(name):
        """Strip whitespace, collapse multiple spaces."""
        if not name:
            return ''
        return re.sub(r'\s+', ' ', name.strip())
