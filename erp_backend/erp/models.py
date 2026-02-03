from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
from decimal import Decimal
from .middleware import get_current_tenant_id

class BusinessType(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'BusinessType'
    
    def __str__(self):
        return self.name

class GlobalCurrency(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True) # USD, EUR
    symbol = models.CharField(max_length=10) # $, €
    
    class Meta:
        db_table = 'GlobalCurrency'

    def __str__(self):
        return f"{self.name} ({self.code})"

class TenantManager(models.Manager):
    def get_queryset(self):
        tenant_id = get_current_tenant_id()
        if tenant_id:
            return super().get_queryset().filter(organization_id=tenant_id)
        return super().get_queryset()

class TenantModel(models.Model):
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE)

    objects = TenantManager()
    original_objects = models.Manager() # Fallback for cross-tenant logic if needed

    class Meta:
        abstract = True

class Unit(TenantModel):
    code = models.CharField(max_length=50) # PC, BOX
    name = models.CharField(max_length=255) # Piece, Box
    short_name = models.CharField(max_length=50, null=True, blank=True)
    type = models.CharField(max_length=50, default='COUNT')
    allow_fraction = models.BooleanField(default=False)
    needs_balance = models.BooleanField(default=False)
    balance_code_structure = models.CharField(max_length=100, null=True, blank=True)
    
    base_unit = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    conversion_factor = models.DecimalField(max_digits=15, decimal_places=6, default=1.0)

    class Meta:
        db_table = 'Unit'
        unique_together = ('code', 'organization')

    def __str__(self):
        return f"{self.name} ({self.code})"

class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Onboarding Fields
    logo = models.ImageField(upload_to='logos/', null=True, blank=True)
    business_email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    website = models.URLField(null=True, blank=True)
    
    address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    zip_code = models.CharField(max_length=20, null=True, blank=True)
    country = models.CharField(max_length=100, null=True, blank=True)
    timezone = models.CharField(max_length=50, default='UTC')
    
    business_type = models.ForeignKey(BusinessType, on_delete=models.SET_NULL, null=True, blank=True)
    base_currency = models.ForeignKey(GlobalCurrency, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'Organization'

    def __str__(self):
        return self.name

class SystemSettings(TenantModel):
    key = models.CharField(max_length=100)
    value = models.TextField() # JSON stored as string
    
    class Meta:
        db_table = 'SystemSettings'
        unique_together = ('key', 'organization')

    def __str__(self):
        return f"{self.key} ({self.organization.name})"

class Site(TenantModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    vat_number = models.CharField(max_length=100, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Site'
        unique_together = ('code', 'organization')

    def __str__(self):
        return f"{self.name} ({self.organization.name})"

class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True) # e.g. 'pos.sell'
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Permission'

    def __str__(self):
        return self.name

class Role(TenantModel):
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    is_public_requestable = models.BooleanField(default=False)
    permissions = models.ManyToManyField(Permission, related_name='roles')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Role'
        unique_together = ('name', 'organization')

    def __str__(self):
        return f"{self.name} ({self.organization.name})"

class Country(models.Model):
    code = models.CharField(max_length=5, unique=True) # 'LB', 'US'
    name = models.CharField(max_length=100)

    class Meta:
        db_table = 'Country'

    def __str__(self):
        return self.name

class ProductGroup(TenantModel):
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    image = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'ProductGroup'

class Parfum(TenantModel):
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=100, null=True, blank=True)
    categories = models.ManyToManyField('Category', related_name='parfums', blank=True)

    class Meta:
        db_table = 'Parfum'
        unique_together = ('name', 'organization')

class Category(TenantModel):
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=100, null=True, blank=True)
    code = models.CharField(max_length=50, null=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Category'
        unique_together = ('name', 'organization')

class Brand(TenantModel):
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=100, null=True, blank=True)
    categories = models.ManyToManyField(Category, related_name='brands', blank=True)
    countries = models.ManyToManyField(Country, related_name='brands', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Brand'
        unique_together = ('name', 'organization')

class Product(TenantModel):
    sku = models.CharField(max_length=100)
    barcode = models.CharField(max_length=100, null=True, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    
    product_group = models.ForeignKey(ProductGroup, on_delete=models.SET_NULL, null=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True, blank=True)
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True)
    parfum = models.ForeignKey(Parfum, on_delete=models.SET_NULL, null=True, blank=True)
    country = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True)

    # AMC (Average Moving Cost) - This is the "Logical" cost for accounting
    cost_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
    # Pricing Breakdown (HT / TTC)
    cost_price_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    cost_price_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tva_rate = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00')) # e.g. 0.11
    
    selling_price_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    selling_price_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
    # Matching Prisma Fields
    status = models.CharField(max_length=20, default='ACTIVE')
    # supplier = models.ForeignKey('erp.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='products')

    is_expiry_tracked = models.BooleanField(default=False)
    min_stock_level = models.IntegerField(default=10)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Product'
        unique_together = (('sku', 'organization'), ('barcode', 'organization'))

class ChartOfAccount(TenantModel):
    ACCOUNT_TYPES = (
        ('ASSET', 'Asset'),
        ('LIABILITY', 'Liability'),
        ('EQUITY', 'Equity'),
        ('INCOME', 'Income'),
        ('EXPENSE', 'Expense'),
    )
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)
    sub_type = models.CharField(max_length=50, null=True, blank=True) # e.g. 'CASH', 'BANK'
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    
    is_system_only = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_hidden = models.BooleanField(default=False)
    requires_zero_balance = models.BooleanField(default=False)
    
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    balance_official = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Regulatory Mapping
    syscohada_code = models.CharField(max_length=50, null=True, blank=True)
    syscohada_class = models.CharField(max_length=100, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ChartOfAccount'
        unique_together = ('code', 'organization')

class Contact(TenantModel):
    TYPES = (
        ('SUPPLIER', 'Supplier'),
        ('CUSTOMER', 'Customer'),
        ('LEAD', 'Lead')
    )
    CUSTOMER_TYPES = (
        ('B2B', 'Business to Business'),
        ('B2C', 'Business to Consumer'),
        ('B2F', 'Business to Foreign'),
        ('B2G', 'Business to Government'),
    )
    type = models.CharField(max_length=20, choices=TYPES)
    customer_type = models.CharField(max_length=10, choices=CUSTOMER_TYPES, default='B2C') # Default to Consumer
    name = models.CharField(max_length=255)
    email = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    vat_id = models.CharField(max_length=100, null=True, blank=True)
    
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    credit_limit = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    
    linked_account = models.OneToOneField(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='contact')
    home_site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True, related_name='contacts')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Contact'

class Employee(TenantModel):
    employee_id = models.CharField(max_length=100, unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    
    # Employee Personal Details
    nationality = models.CharField(max_length=100, null=True, blank=True)
    address_line = models.TextField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    
    job_title = models.CharField(max_length=100, null=True, blank=True)
    salary = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    
    home_site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')
    linked_account = models.OneToOneField(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='employee')
    user = models.OneToOneField('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='employee')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Employee'

class Warehouse(TenantModel):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='warehouses')
    name = models.CharField(max_length=255) # "Main", "Damaged"
    code = models.CharField(max_length=50, null=True, blank=True)
    type = models.CharField(max_length=50, default='PHYSICAL')
    can_sell = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'Warehouse'
        unique_together = ('name', 'site')

class StockBatch(TenantModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='batches')
    batch_code = models.CharField(max_length=100)
    expiry_date = models.DateTimeField(null=True, blank=True)
    cost_price = models.DecimalField(max_digits=15, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'StockBatch'

class InventoryLevel(TenantModel):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='inventory_levels')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='site_levels')
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)

    class Meta:
        db_table = 'InventoryLevel'
        unique_together = ('site', 'product', 'organization')

class Inventory(TenantModel):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='inventory')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='inventory')
    batch = models.ForeignKey(StockBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory')
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    
    class Meta:
        db_table = 'Inventory'
        unique_together = ('warehouse', 'product', 'batch', 'organization')

class Order(TenantModel):
    TYPES = (
        ('SALE', 'Sale'),
        ('PURCHASE', 'Purchase'),
        ('TRANSFER', 'Transfer'),
        ('ADJUSTMENT', 'Adjustment')
    )
    type = models.CharField(max_length=20, choices=TYPES)
    status = models.CharField(max_length=20, default='DRAFT') # 'DRAFT', 'COMPLETED', etc.
    
    contact = models.ForeignKey('erp.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='orders')
    site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    
    scope = models.CharField(max_length=20, default='OFFICIAL')
    invoice_price_type = models.CharField(max_length=20, default='HT_BASED') # 'HT_BASED' or 'TTC_BASED'
    vat_recoverable = models.BooleanField(default=True)
    payment_method = models.CharField(max_length=20, default='CASH')
    ref_code = models.CharField(max_length=100, null=True, blank=True)

    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    discount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
    is_verified = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Order'

class OrderLine(TenantModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='order_lines')
    batch = models.ForeignKey(StockBatch, on_delete=models.SET_NULL, null=True, blank=True)
    
    quantity = models.DecimalField(max_digits=15, decimal_places=2)
    unit_price = models.DecimalField(max_digits=15, decimal_places=2) # Selling Price or Effective Cost depending on context
    tax_rate = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
    # Cost capture
    unit_cost_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    unit_cost_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    vat_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    effective_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'OrderLine'

class InventoryMovement(TenantModel):
    MOVEMENT_TYPES = (
        ('IN', 'Inbound'),
        ('OUT', 'Outbound'),
        ('TRANSFER', 'Transfer'),
        ('ADJUST', 'Adjustment'),
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity = models.DecimalField(max_digits=15, decimal_places=2)
    cost_price = models.DecimalField(max_digits=15, decimal_places=2) # Cost at time of movement
    reference = models.CharField(max_length=100, null=True, blank=True)
    reason = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'InventoryMovement'

class FinancialAccount(TenantModel):
    FINANCIAL_TYPES = (
        ('CASH', 'Cash'),
        ('BANK', 'Bank'),
        ('MOBILE', 'Mobile'),
    )
    site = models.ForeignKey(Site, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=FINANCIAL_TYPES)
    currency = models.CharField(max_length=10, default='USD')
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    ledger_account = models.OneToOneField(ChartOfAccount, on_delete=models.PROTECT, null=True, blank=True)

    class Meta:
        db_table = 'FinancialAccount'
        unique_together = ('name', 'organization', 'site')

class FiscalYear(TenantModel):
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    is_closed = models.BooleanField(default=False)
    is_hard_locked = models.BooleanField(default=False)

    class Meta:
        db_table = 'FiscalYear'
        unique_together = ('name', 'organization')

class FiscalPeriod(TenantModel):
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.CASCADE, related_name='periods')
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    is_closed = models.BooleanField(default=False)

    class Meta:
        db_table = 'FiscalPeriod'
        unique_together = ('name', 'fiscal_year')

class JournalEntry(TenantModel):
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('POSTED', 'Posted'),
        ('REVERSED', 'Reversed'),
        ('VOID', 'Void'),
    )
    SCOPE_CHOICES = (
        ('OFFICIAL', 'Official'),
        ('INTERNAL', 'Internal'),
    )
    transaction_date = models.DateTimeField()
    description = models.TextField()
    reference = models.CharField(max_length=100, unique=True)
    
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.PROTECT)
    fiscal_period = models.ForeignKey(FiscalPeriod, on_delete=models.PROTECT)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default='OFFICIAL')
    
    site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True)
    
    is_verified = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'JournalEntry'

class JournalEntryLine(TenantModel):
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey(ChartOfAccount, on_delete=models.PROTECT, related_name='journal_lines')
    
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
    description = models.TextField(null=True, blank=True)
    
    # Optional links to other domains
    contact_id = models.IntegerField(null=True, blank=True) # Will link to Contact later
    employee_id = models.IntegerField(null=True, blank=True) # Will link to Employee later

    class Meta:
        db_table = 'JournalEntryLine'

class Transaction(TenantModel):
    TRANSACTION_TYPES = (
        ('IN', 'Inbound/Deposit'),
        ('OUT', 'Outbound/Withdrawal'),
    )
    account = models.ForeignKey(FinancialAccount, on_delete=models.CASCADE, related_name='transactions')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, null=True, blank=True)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    type = models.CharField(max_length=10, choices=TRANSACTION_TYPES)
    description = models.TextField(null=True, blank=True)
    reference_id = models.CharField(max_length=100, null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')

    class Meta:
        db_table = 'Transaction'
    
    created_at = models.DateTimeField(auto_now_add=True)

from django.contrib.auth.validators import UnicodeUsernameValidator
from django.utils.translation import gettext_lazy as _

class User(AbstractUser):
    # Override username to allow duplicates across tenants
    username_validator = UnicodeUsernameValidator()

    username = models.CharField(
        _('username'),
        max_length=150,
        unique=False, 
        help_text=_('Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.'),
        validators=[username_validator],
    )

    class Meta:
        db_table = 'User'
        constraints = [
            models.UniqueConstraint(fields=['username', 'organization'], name='unique_username_per_org')
        ]
    
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='users', null=True, blank=True)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    home_site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True, related_name='home_users')
    cash_register = models.ForeignKey(FinancialAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_users')
    is_active_account = models.BooleanField(default=True)
    
    # Registration Status
    REGISTRATION_STATUS = (
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('NEEDS_CORRECTION', 'Needs Correction'),
    )
    registration_status = models.CharField(max_length=50, choices=REGISTRATION_STATUS, default='APPROVED')
    correction_notes = models.TextField(null=True, blank=True)

    def __str__(self):
        return self.email if self.email else self.username

class TransactionSequence(TenantModel):
    type = models.CharField(max_length=50) # 'INVOICE', 'LOAN', etc.
    prefix = models.CharField(max_length=20, null=True, blank=True)
    suffix = models.CharField(max_length=20, null=True, blank=True)
    next_number = models.IntegerField(default=1)
    padding = models.IntegerField(default=5)
    
    class Meta:
        db_table = 'TransactionSequence'
        unique_together = ('type', 'organization')

class BarcodeSettings(TenantModel):
    prefix = models.CharField(max_length=10, default="200")
    next_sequence = models.IntegerField(default=1000)
    length = models.IntegerField(default=13)
    is_enabled = models.BooleanField(default=True)

    class Meta:
        db_table = 'BarcodeSettings'

class Loan(TenantModel):
    INTEREST_TYPES = (
        ('NONE', 'None'),
        ('SIMPLE', 'Simple'),
        ('COMPOUND', 'Compound')
    )
    FREQUENCIES = (
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('YEARLY', 'Yearly')
    )
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('DEFAULTED', 'Defaulted')
    )

    contract_number = models.CharField(max_length=50)
    contact = models.ForeignKey(Contact, on_delete=models.PROTECT, related_name='loans')
    
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2) # Annual %
    interest_type = models.CharField(max_length=20, choices=INTEREST_TYPES, default='SIMPLE')
    
    term_months = models.IntegerField()
    start_date = models.DateField()
    payment_frequency = models.CharField(max_length=20, choices=FREQUENCIES, default='MONTHLY')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Loan'
        unique_together = ('contract_number', 'organization')

class LoanInstallment(TenantModel):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('PAID', 'Paid'),
        ('PARTIAL', 'Partial'),
        ('OVERDUE', 'Overdue')
    )
    
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name='installments')
    due_date = models.DateField()
    
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2)
    interest_amount = models.DecimalField(max_digits=15, decimal_places=2)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'LoanInstallment'

class FinancialEvent(TenantModel):
    EVENT_TYPES = (
        ('PARTNER_CAPITAL_INJECTION', 'Capital Injection'),
        ('PARTNER_LOAN', 'Partner Loan'),
        ('PARTNER_WITHDRAWAL', 'Partner Withdrawal'),
        ('REFUND_RECEIVED', 'Refund Received'),
    )
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('SETTLED', 'Settled'),
        ('CANCELLED', 'Cancelled')
    )

    event_type = models.CharField(max_length=50, choices=EVENT_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    date = models.DateTimeField()
    
    reference = models.CharField(max_length=100, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    
    contact = models.ForeignKey(Contact, on_delete=models.PROTECT, related_name='financial_events')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    # Links to accounting
    transaction = models.ForeignKey(Transaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_events')
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_events')
    
    # Optional link to Loan if this event IS a loan disbursement
    loan = models.ForeignKey(Loan, on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_events')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'FinancialEvent'
