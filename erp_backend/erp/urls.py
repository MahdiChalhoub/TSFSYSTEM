from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, SiteViewSet, 
    ProductViewSet, WarehouseViewSet,
    InventoryViewSet, UnitViewSet, SettingsViewSet, health_check,

    POSViewSet, PurchaseViewSet, TenantResolutionView, DashboardViewSet,
    BrandViewSet, CategoryViewSet, ParfumViewSet, ProductGroupViewSet,
    CountryViewSet, ContactViewSet, EmployeeViewSet, RoleViewSet,
    BarcodeSettingsViewSet, TransactionSequenceViewSet
)
from .views_subscription import (
    PlanCategoryViewSet, SubscriptionPlanViewSet, SubscriptionPaymentViewSet
)
from .views_auth import login_view, logout_view, me_view
from .views_saas_modules import SaaSModuleViewSet, OrgModuleViewSet
from .views_system import SystemUpdateViewSet
from .views_modules import ModuleListView, ModuleEnableView, ModuleDisableView
from .views_manager import PendingUsersView, ApproveUserView, RejectUserView, RequestCorrectionView
from .views_onboarding import PublicConfigView, BusinessRegistrationView, UserSignUpView
from .views_audit import (
    AuditLogViewSet, WorkflowDefinitionViewSet, ApprovalRequestViewSet,
    TaskTemplateViewSet, TaskQueueViewSet
)

router = DefaultRouter()
router.register(r'tenant', TenantResolutionView, basename='tenant')
router.register(r'organizations', OrganizationViewSet)
router.register(r'sites', SiteViewSet)

# Finance ViewSets
from .views_finance import (
    ChartOfAccountViewSet, FinancialAccountViewSet,
    FiscalYearViewSet, FiscalPeriodViewSet,
    JournalEntryViewSet, LoanViewSet, FinancialEventViewSet
)
router.register(r'coa', ChartOfAccountViewSet, basename='coa')
router.register(r'accounts', FinancialAccountViewSet, basename='accounts')
router.register(r'fiscal-years', FiscalYearViewSet, basename='fiscal-years')
router.register(r'fiscal-periods', FiscalPeriodViewSet, basename='fiscal-periods')
router.register(r'journal', JournalEntryViewSet, basename='journal')
router.register(r'loans', LoanViewSet, basename='loans')
router.register(r'financial-events', FinancialEventViewSet, basename='financial-events')


router.register(r'products', ProductViewSet)
router.register(r'units', UnitViewSet)
router.register(r'warehouses', WarehouseViewSet)
router.register(r'inventory', InventoryViewSet)
router.register(r'settings', SettingsViewSet, basename='settings')
router.register(r'saas/updates', SystemUpdateViewSet, basename='system-update')
router.register(r'pos', POSViewSet, basename='pos')
router.register(r'purchase', PurchaseViewSet, basename='purchase')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'brands', BrandViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'parfums', ParfumViewSet)
router.register(r'product-groups', ProductGroupViewSet)
router.register(r'countries', CountryViewSet)
router.register(r'contacts', ContactViewSet)
router.register(r'employees', EmployeeViewSet)
router.register(r'roles', RoleViewSet)
router.register(r'settings/barcode', BarcodeSettingsViewSet, basename='barcode-settings')
router.register(r'sequences', TransactionSequenceViewSet)

# SaaS Management
router.register(r'saas/modules', SaaSModuleViewSet, basename='saas-modules')
router.register(r'saas/org-modules', OrgModuleViewSet, basename='saas-org-modules')

# Subscription
router.register(r'saas/plans/categories', PlanCategoryViewSet)
router.register(r'saas/plans', SubscriptionPlanViewSet)
router.register(r'saas/payments', SubscriptionPaymentViewSet, basename='subscription-payments')

# Audit & Workflow Engine
router.register(r'audit/logs', AuditLogViewSet, basename='audit-logs')
router.register(r'audit/workflows', WorkflowDefinitionViewSet, basename='workflow-definitions')
router.register(r'audit/approvals', ApprovalRequestViewSet, basename='approval-requests')
router.register(r'audit/task-templates', TaskTemplateViewSet, basename='task-templates')
router.register(r'audit/tasks', TaskQueueViewSet, basename='task-queue')

# Connector Module (Core Infrastructure)
from .views_connector import (
    ModuleContractViewSet, ConnectorPolicyViewSet, BufferedRequestViewSet,
    ConnectorLogViewSet, ModuleStateOverviewView, ConnectorDashboardView,
    ConnectorRouteView
)
router.register(r'connector/contracts', ModuleContractViewSet, basename='connector-contracts')
router.register(r'connector/policies', ConnectorPolicyViewSet, basename='connector-policies')
router.register(r'connector/buffer', BufferedRequestViewSet, basename='connector-buffer')
router.register(r'connector/logs', ConnectorLogViewSet, basename='connector-logs')

urlpatterns = [
    path('health/', health_check),
    path('auth/login/', login_view, name='auth_login'),
    path('auth/me/', me_view, name='auth_me'),
    
    # Onboarding
    path('auth/config/', PublicConfigView.as_view(), name='auth_config'),
    path('auth/register/business/', BusinessRegistrationView.as_view(), name='auth_register_business'),
    path('auth/register/user/', UserSignUpView.as_view(), name='auth_register_user'),

    # Manager Approvals
    path('manager/approvals/pending/', PendingUsersView.as_view(), name='manager_pending_users'),
    path('manager/approvals/<int:user_id>/approve/', ApproveUserView.as_view(), name='manager_approve_user'),
    path('manager/approvals/<int:user_id>/reject/', RejectUserView.as_view(), name='manager_reject_user'),
    path('manager/approvals/<int:user_id>/correction/', RequestCorrectionView.as_view(), name='manager_correction_user'),
    
    # Module Management
    path('modules/', ModuleListView.as_view(), name='module_list'),
    path('modules/<str:code>/enable/', ModuleEnableView.as_view(), name='module_enable'),
    path('modules/<str:code>/disable/', ModuleDisableView.as_view(), name='module_disable'),

    # Connector Module (Core Infrastructure)
    path('connector/states/', ModuleStateOverviewView.as_view(), name='connector_states'),
    path('connector/dashboard/', ConnectorDashboardView.as_view(), name='connector_dashboard'),
    path('connector/route/', ConnectorRouteView.as_view(), name='connector_route'),

    # MCP AI Connector Module
    path('mcp/', include('apps.mcp.urls')),

    # Modular Finance API
    path('', include('apps.finance.urls')),

    path('', include(router.urls)),
]

