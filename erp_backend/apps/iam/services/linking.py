"""
IAM Services — Linking

Handles user↔contact linking with safe auto-link policy.

Auto-link rules:
- Strong match ONLY (exact normalized email + contact type eligibility)
- Never auto-link suppliers loosely
- Admin can always link manually
"""
from django.db import transaction
from django.utils import timezone

from apps.iam.services import audit


def strong_match_contact(organization, email, contact_types=None, phone=None):
    """
    Find an existing Contact by STRONG match criteria.

    Strong match = exact normalized email AND eligible contact type AND active status.
    Returns the best single match, or None.

    This is intentionally strict to prevent false links.
    """
    from apps.crm.models import Contact

    if not email:
        return None

    qs = Contact.objects.filter(
        organization=organization,
        email__iexact=email.strip(),
        status='ACTIVE',
    )

    if contact_types:
        qs = qs.filter(type__in=contact_types)

    matches = list(qs[:2])  # Fetch max 2 to detect ambiguity

    if len(matches) == 1:
        return matches[0]

    if len(matches) > 1:
        # Ambiguous match — do NOT auto-link, let admin resolve
        import logging
        logger = logging.getLogger('apps.iam')
        logger.warning(
            f"[IAM] Ambiguous contact match for email={email} in org={organization.id}: "
            f"found {len(matches)} candidates. Skipping auto-link."
        )
        return None

    return None


def create_user_from_contact(contact, password=None, created_by=None):
    """
    Create a User account from an existing CRM Contact.
    Auto-creates ContactPortalAccess based on contact.type.

    Usage: Admin clicks "Create Portal User" on a Contact card.

    Returns: (user, portal_access)
    """
    from erp.models import User
    from apps.iam.models import ContactPortalAccess
    import secrets

    portal_type = 'SUPPLIER' if contact.type in ('SUPPLIER',) else 'CLIENT'

    with transaction.atomic():
        if not password:
            password = secrets.token_urlsafe(16)

        name_parts = (contact.name or '').split()
        user = User.objects.create_user(
            username=contact.email or f"contact_{contact.id}",
            email=contact.email or '',
            password=password,
            first_name=name_parts[0] if name_parts else '',
            last_name=' '.join(name_parts[1:]) if len(name_parts) > 1 else '',
            organization=contact.organization,
            account_status='ACTIVE',
            registration_channel='ERP_ADMIN',
        )

        access = ContactPortalAccess.objects.create(
            organization=contact.organization,
            user=user,
            contact=contact,
            portal_type=portal_type,
            status='ACTIVE',
            relationship_role='SELF',
            is_primary=True,
            created_via='ADMIN_CREATE',
            can_access_portal=True,
            can_access_ecommerce=portal_type == 'CLIENT',
            granted_by=created_by,
            granted_at=timezone.now(),
        )

        event = audit.CLIENT_ACCESS_CREATED if portal_type == 'CLIENT' else audit.SUPPLIER_ACCESS_CREATED
        audit.emit(event, user=user, actor=created_by,
                   organization=contact.organization,
                   detail=f'Portal user created from contact #{contact.id}',
                   contact_id=contact.id, access_id=access.id)

    return user, access


def link_user_to_contact(user, contact, portal_type, relationship_role='SELF',
                         granted_by=None):
    """
    Link an existing User to an existing Contact with portal access.

    Returns: ContactPortalAccess instance
    """
    from apps.iam.models import ContactPortalAccess

    access, created = ContactPortalAccess.objects.get_or_create(
        organization=contact.organization,
        user=user,
        contact=contact,
        portal_type=portal_type,
        defaults={
            'status': 'ACTIVE',
            'relationship_role': relationship_role,
            'is_primary': True,
            'created_via': 'ADMIN_CREATE',
            'can_access_portal': True,
            'can_access_ecommerce': portal_type == 'CLIENT',
            'granted_by': granted_by,
            'granted_at': timezone.now(),
        }
    )
    if not created and access.status in ('REVOKED', 'BLOCKED'):
        access.reactivate(granted_by=granted_by)
        audit.emit(audit.ACCESS_REACTIVATED, user=user, actor=granted_by,
                   organization=contact.organization,
                   detail=f'Portal access reactivated for contact #{contact.id}')
    elif created:
        audit.emit(audit.USER_LINKED_TO_CONTACT, user=user, actor=granted_by,
                   organization=contact.organization,
                   detail=f'User linked to contact #{contact.id} ({portal_type})',
                   contact_id=contact.id, access_id=access.id)

    return access
