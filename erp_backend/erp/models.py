from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid

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

class Site(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='sites')
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

class Role(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='roles')
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

class Category(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Category'
        unique_together = ('name', 'organization')

class Brand(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='brands')
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Brand'
        unique_together = ('name', 'organization')

class Unit(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='units')
    code = models.CharField(max_length=50) # 'KG', 'PC'
    name = models.CharField(max_length=100)
    conversion_factor = models.DecimalField(max_digits=15, decimal_places=5, default=1.0)
    
    class Meta:
        db_table = 'Unit'
        unique_together = ('code', 'organization')

class Product(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='products')
    sku = models.CharField(max_length=100)
    barcode = models.CharField(max_length=100, null=True, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True, blank=True)
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True)
    
    cost_price = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    selling_price = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Product'
        unique_together = (('sku', 'organization'), ('barcode', 'organization'))

class ChartOfAccount(models.Model):
    ACCOUNT_TYPES = (
        ('ASSET', 'Asset'),
        ('LIABILITY', 'Liability'),
        ('EQUITY', 'Equity'),
        ('REVENUE', 'Revenue'),
        ('EXPENSE', 'Expense'),
    )
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='ledger')
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ChartOfAccount'
        unique_together = ('code', 'organization')

class FinancialAccount(models.Model):
    ACCOUNT_TYPES = (
        ('CASH', 'Cash'),
        ('BANK', 'Bank'),
        ('MOBILE', 'Mobile'),
    )
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='financial_accounts')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)
    currency = models.CharField(max_length=10, default='USD')
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    ledger_account = models.OneToOneField(ChartOfAccount, on_delete=models.PROTECT, null=True, blank=True)

    class Meta:
        db_table = 'FinancialAccount'
        unique_together = ('name', 'organization', 'site')

class Transaction(models.Model):
    TRANSACTION_TYPES = (
        ('DEBIT', 'Debit'),
        ('CREDIT', 'Credit'),
    )
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='transactions')
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
