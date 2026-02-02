from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, SiteViewSet, FinancialAccountViewSet,
    ChartOfAccountViewSet, FiscalYearViewSet, FiscalPeriodViewSet,
    JournalEntryViewSet, ProductViewSet, WarehouseViewSet,
    InventoryViewSet, UnitViewSet, SettingsViewSet, health_check,

    POSViewSet, PurchaseViewSet, TenantResolutionView, DashboardViewSet,
    BrandViewSet, CategoryViewSet, ParfumViewSet, ProductGroupViewSet,
    CountryViewSet, ContactViewSet, EmployeeViewSet, RoleViewSet,
    BarcodeSettingsViewSet, LoanViewSet, FinancialEventViewSet, TransactionSequenceViewSet
)
from .views_auth import login_view, logout_view, me_view
from .views_onboarding import PublicConfigView, BusinessRegistrationView, UserSignUpView
from .views_manager import PendingUsersView, ApproveUserView, RejectUserView, RequestCorrectionView

router = DefaultRouter()
router.register(r'tenant', TenantResolutionView, basename='tenant')
router.register(r'organizations', OrganizationViewSet)
router.register(r'sites', SiteViewSet)
router.register(r'accounts', FinancialAccountViewSet)
router.register(r'coa', ChartOfAccountViewSet)
router.register(r'fiscal-years', FiscalYearViewSet)
router.register(r'fiscal-periods', FiscalPeriodViewSet)
router.register(r'journal', JournalEntryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'units', UnitViewSet)
router.register(r'warehouses', WarehouseViewSet)
router.register(r'inventory', InventoryViewSet)
router.register(r'settings', SettingsViewSet, basename='settings')
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
router.register(r'loans', LoanViewSet)
router.register(r'financial-events', FinancialEventViewSet)
router.register(r'sequences', TransactionSequenceViewSet)

urlpatterns = [
    path('health/', health_check),
    path('auth/login/', login_view, name='auth_login'),
    path('auth/logout/', logout_view, name='auth_logout'),
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
    
    path('', include(router.urls)),
]
