import os
import re

fname = "erp/views.py"
with open(fname, "r", encoding="utf-8") as f:
    text = f.read()

header = text[:text.find("# ============================================================================")]

blocks = text.split("# ============================================================================\n")
# block 0 is header
# block 1 header title block + KERNEL BASE CLASS
# Let's just find the classes using regex.
classes = {
    'TenantModelViewSet': ('views_base.py', []),
    'UserViewSet': ('views_users.py', []),
    'RoleViewSet': ('views_users.py', []),
    'PermissionViewSet': ('views_users.py', []),
    
    'OrganizationViewSet': ('views_org.py', []),
    'SiteViewSet': ('views_org.py', []),
    'CountryViewSet': ('views_org.py', []),
    'CurrencyViewSet': ('views_org.py', []),
    'BusinessTypeViewSet': ('views_org.py', []),
    
    'DashboardViewSet': ('views_dashboard.py', []),
    
    'NotificationViewSet': ('views_system.py', []),
    'TenantResolutionView': ('views_system.py', []),
    'SettingsViewSet': ('views_system.py', []),
    'RecordHistoryViewSet': ('views_system.py', []),
    'EntityGraphViewSet': ('views_system.py', []),
}

# Actually, a simpler way is just copy views.py into each file and let me trim it, OR
# since we want to split it right, I can use an AST-based extractor or just manual.
