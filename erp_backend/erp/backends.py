from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q
from .middleware import get_current_tenant_id

User = get_user_model()

class TenantAuthBackend(ModelBackend):
    """
    Authenticates against settings.AUTH_USER_MODEL.
    Uses the organization (tenant) context to distinguish users with the same username.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        
        try:
            # Try to fetch user based on username AND active tenant
            # We defer to the middleware's thread-local storage or request headers
            
            # 1. Check if we have an explicit organization in kwargs (optional)
            org_id = kwargs.get('organization_id')
            
            # 2. If not, try to get from global middleware context
            if not org_id:
                org_id = get_current_tenant_id()
            
            # 3. If still not, try request headers if request is passed
            if not org_id and request:
                tenant_header = request.headers.get('X-Tenant-Id')
                if tenant_header:
                    org_id = tenant_header

            # Query Logic
            query = Q(username=username)
            if org_id:
                query &= Q(organization_id=org_id)
            else:
                # If no tenant context is found:
                # OPTION A: Only match root users (org=None)
                # OPTION B: Match ANY user (but this is dangerous if multiple exist)
                # We'll go with OPTION A for security, or try to be smart.
                # However, for the specific case of a USER logging in to a specific business,
                # the frontend MUST send the tenant context (slug/id).
                
                # If the user is trying to login to "root" (no tenant), look for:
                # - org=None (legacy root users)
                # - org.slug='saas' (SaaS Federation panel users)
                query &= (Q(organization__isnull=True) | Q(organization__slug='saas'))
            
            user = User.objects.get(query)
            
        except User.DoesNotExist:
            # Run the default password hasher once to reduce the timing
            # difference between an existing and a nonexistent user (#20760).
            User().set_password(password)
            return None
        except User.MultipleObjectsReturned:
            import logging
            logging.getLogger('erp').warning(
                f"[AUTH] MultipleObjectsReturned for username='{username}' - data integrity issue"
            )
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
