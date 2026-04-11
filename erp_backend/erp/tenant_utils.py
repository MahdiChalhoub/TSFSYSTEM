import uuid

def resolve_tenant_header(header_value):
    """
    Normalizes a organization header value (UUID or slug) into a string UUID.
    If it's already a valid UUID, returns it. If it's a slug, looks up
    the active Organization and returns its UUID. 
    Otherwise, returns the original value to fail gracefully downstream.
    """
    if not header_value:
        return None
        
    try:
        uuid.UUID(str(header_value))
        return str(header_value)
    except (ValueError, AttributeError):
        from erp.models import Organization
        org = Organization.objects.filter(slug__iexact=header_value, is_active=True).first()
        if org:
            return str(org.id)
            
    return str(header_value)
