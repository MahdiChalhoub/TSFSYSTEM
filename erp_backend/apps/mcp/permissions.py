from rest_framework import permissions
from erp.permissions import BaseModulePermission


# =============================================================================
# PERMISSIONS
# =============================================================================

class CanViewMCP(BaseModulePermission):
    permission_code = 'mcp.view'


class CanManageMCP(BaseModulePermission):
    permission_code = 'mcp.manage'


class CanUseMCPChat(BaseModulePermission):
    permission_code = 'mcp.chat'


class CanExecuteMCPTools(BaseModulePermission):
    permission_code = 'mcp.tools'


class IsMCPAdmin(BaseModulePermission):
    permission_code = 'mcp.admin'


class CanManageAgents(BaseModulePermission):
    permission_code = 'mcp.agents.manage'
