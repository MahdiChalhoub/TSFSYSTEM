from decimal import Decimal
from django.db import models
from erp.models import TenantModel

class ClientWallet(TenantModel):
    contact = models.OneToOneField(
        'crm.Contact', on_delete=models.CASCADE,
        related_name='wallet',
        limit_choices_to={'type': 'CUSTOMER'},
    )
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    loyalty_points = models.IntegerField(default=0)
    lifetime_points = models.IntegerField(default=0)
    currency = models.CharField(max_length=10, default='USD')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'client_wallet'

    def __str__(self):
        return f"Wallet: {self.contact} — {self.currency} {self.balance}"

    def credit(self, amount, reason='', reference_type='', reference_id=None):
        self.balance += Decimal(str(amount))
        self.save(update_fields=['balance', 'updated_at'])
        return WalletTransaction.objects.create(
            organization=self.organization, wallet=self, transaction_type='CREDIT',
            amount=Decimal(str(amount)), balance_after=self.balance,
            reason=reason, reference_type=reference_type, reference_id=reference_id
        )

    def debit(self, amount, reason='', reference_type='', reference_id=None):
        amount = Decimal(str(amount))
        if amount > self.balance:
            raise ValueError(f"Insufficient wallet balance: {self.balance} < {amount}")
        self.balance -= amount
        self.save(update_fields=['balance', 'updated_at'])
        return WalletTransaction.objects.create(
            organization=self.organization, wallet=self, transaction_type='DEBIT',
            amount=amount, balance_after=self.balance,
            reason=reason, reference_type=reference_type, reference_id=reference_id
        )

    def add_loyalty_points(self, points):
        self.loyalty_points += points
        self.lifetime_points += points
        self.save(update_fields=['loyalty_points', 'lifetime_points', 'updated_at'])

    def redeem_loyalty_points(self, points, discount_amount):
        if points > self.loyalty_points:
            raise ValueError(f"Insufficient points: {self.loyalty_points} < {points}")
        self.loyalty_points -= points
        self.save(update_fields=['loyalty_points', 'updated_at'])
        return self.credit(discount_amount, reason=f'Loyalty redemption ({points} points)',
                           reference_type='LoyaltyRedemption')


class WalletTransaction(TenantModel):
    TRANSACTION_TYPES = (('CREDIT', 'Credit'), ('DEBIT', 'Debit'))
    wallet = models.ForeignKey(ClientWallet, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=10, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    balance_after = models.DecimalField(max_digits=15, decimal_places=2)
    reason = models.CharField(max_length=255, blank=True, default='')
    reference_type = models.CharField(max_length=50, blank=True, default='')
    reference_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'wallet_transaction'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.transaction_type} {self.amount} → {self.wallet.contact}"
