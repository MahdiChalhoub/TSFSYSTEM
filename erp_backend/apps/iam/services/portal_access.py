"""
IAM Services — Portal Access

Query/selector services for checking and resolving portal access.
Views should use these selectors, not direct ORM queries.

IMPORTANT: resolve_active_context handles multi-contact scenarios
where a user represents multiple contacts under the same portal type.
"""


def resolve_active_context(user, portal_type, organization=None, preferred_contact_id=None):
    """
    Resolve the active portal access context for a user.

    Handles the multi-contact case:
    - If user has exactly one active access → return it
    - If user has multiple active accesses → use preferred_contact_id or primary
    - If no active access → return None

    This is the core security function — portals never accept arbitrary contact IDs.

    Args:
        user: Authenticated User
        portal_type: 'CLIENT' or 'SUPPLIER'
        organization: Optional org filter
        preferred_contact_id: User's selected contact (from session/header)

    Returns: ContactPortalAccess or None
    """
    from apps.iam.models import ContactPortalAccess

    qs = ContactPortalAccess.objects.filter(
        user=user,
        portal_type=portal_type,
        status='ACTIVE',
        can_access_portal=True,
    ).select_related('contact', 'granted_by')

    if organization:
        qs = qs.filter(organization=organization)

    accesses = list(qs)

    if len(accesses) == 0:
        return None

    if len(accesses) == 1:
        return accesses[0]

    # Multiple active accesses — resolve by preference or primary
    if preferred_contact_id:
        for acc in accesses:
            if acc.contact_id == preferred_contact_id:
                return acc

    # Fall back to primary
    for acc in accesses:
        if acc.is_primary:
            return acc

    # Last resort: most recently created
    return accesses[0]


def get_all_active_accesses(user, portal_type=None, organization=None):
    """
    Get all active portal access records for a user.
    Useful when user needs to select which contact context to use.

    Returns: QuerySet of ContactPortalAccess
    """
    from apps.iam.models import ContactPortalAccess

    qs = ContactPortalAccess.objects.filter(
        user=user,
        status='ACTIVE',
    ).select_related('contact', 'granted_by')

    if portal_type:
        qs = qs.filter(portal_type=portal_type)
    if organization:
        qs = qs.filter(organization=organization)

    return qs


def get_portal_summary(user, organization=None):
    """
    Summary of user's portal personas for admin views.
    Returns dict with counts and details per portal type.
    """
    from apps.iam.models import ContactPortalAccess

    qs = ContactPortalAccess.objects.filter(user=user)
    if organization:
        qs = qs.filter(organization=organization)

    accesses = list(qs.select_related('contact').values(
        'id', 'portal_type', 'status', 'contact__name', 'contact__type',
        'relationship_role', 'is_primary', 'created_via', 'created_at',
    ))

    return {
        'total': len(accesses),
        'client': [a for a in accesses if a['portal_type'] == 'CLIENT'],
        'supplier': [a for a in accesses if a['portal_type'] == 'SUPPLIER'],
        'active_count': sum(1 for a in accesses if a['status'] == 'ACTIVE'),
    }


def resolve_contact_for_portal(user, portal_type, organization=None):
    """
    Convenience: resolve to the Contact directly.
    Shortcut for resolve_active_context().contact
    """
    ctx = resolve_active_context(user, portal_type, organization)
    return ctx.contact if ctx else None
