from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
from decimal import Decimal
from .middleware import get_current_tenant_id

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

    class Meta:
        db_table = 'Parfum'
        unique_together = ('name', 'organization')

class Category(TenantModel):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Category'
        unique_together = ('name', 'organization')

class Brand(TenantModel):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Brand'
        unique_together = ('name', 'organization')

class Unit(TenantModel):
    code = models.CharField(max_length=50) # 'KG', 'PC'
    name = models.CharField(max_length=100)
    conversion_factor = models.DecimalField(max_digits=15, decimal_places=5, default=1.0)
    
    class Meta:
        db_table = 'Unit'
        unique_together = ('code', 'organization')

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
    supplier = models.ForeignKey('Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='products')

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
    type = models.CharField(max_length=20, choices=TYPES)
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
    job_title = models.CharField(max_length=100, null=True, blank=True)
    salary = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    
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
    
    contact = models.ForeignKey(Contact, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='orders')
    site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    
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
    unit_price = models.DecimalField(max_digits=15, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
    # Cost capture
    unit_cost_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
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

class User(AbstractUser):
    class Meta:
        db_table = 'User'
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='users', null=True, blank=True)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    home_site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True, related_name='home_users')
    is_active_account = models.BooleanField(default=True)

    def __str__(self):
        return self.email if self.email else self.username
