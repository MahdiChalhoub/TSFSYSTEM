"""
POS Register / Cashier management.
Each register belongs to a site, has its own cash account,
allowed payment methods, and authorized users with PIN codes.
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel, User


class POSRegister(TenantModel):
    """A physical POS register/cashier terminal at a location."""
    name = models.CharField(max_length=100, help_text='e.g. Caisse 1, Register A')
    branch = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.CASCADE, null=True, blank=True,
        related_name='pos_registers',
        help_text='Branch/location this register belongs to'
    )
    warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pos_register_stock',
        help_text='Default warehouse for stock deduction (if different from branch)'
    )

    # Financial accounts linked to this register
    cash_account = models.ForeignKey(
        'finance.FinancialAccount', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='register_cash',
        help_text='Cash drawer account for this register'
    )
    allowed_accounts = models.ManyToManyField(
        'finance.FinancialAccount', blank=True, related_name='register_allowed',
        help_text='Payment accounts available at this register (Wave, OM, Card, etc.)'
    )

    # Reserve account for excess cash transfer
    reserve_account = models.ForeignKey(
        'finance.FinancialAccount', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='register_reserve',
        help_text='Account to transfer excess cash to on close'
    )

    # Authorized users
    authorized_users = models.ManyToManyField(
        User, blank=True, related_name='authorized_registers',
        help_text='Users who can operate this register'
    )

    is_active = models.BooleanField(default=True)

    # Register opening mode
    OPENING_MODE_CHOICES = (
        ('STANDARD', 'Standard — Quick cash open'),
        ('ADVANCED', 'Advanced — Full reconciliation'),
    )
    opening_mode = models.CharField(
        max_length=20, choices=OPENING_MODE_CHOICES, default='STANDARD',
        help_text='How this register opens: standard (cash only) or advanced (full reconciliation)'
    )
    cashier_can_see_software = models.BooleanField(
        default=False,
        help_text='If true, cashier can see software amounts. If false, manager PIN required to reveal.'
    )

    # Per-register payment method configuration
    # Each entry: { key: str, label: str, accountId: int|null }
    payment_methods = models.JSONField(
        default=list, blank=True,
        help_text='Ordered list of payment methods for this register: [{key, label, accountId}]'
    )

    # Account Book — REQUIRED: register cannot open without this
    account_book = models.ForeignKey(
        'finance.FinancialAccount', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='register_account_book',
        help_text='Cashier Account Book (Livre de Caisse) linked to this register. REQUIRED to open.'
    )

    # Per-register overrides for global security rules (JSON patch)
    # e.g. { "requireCountOnClose": true, "lockRegisterOnClose": false }
    register_rules_override = models.JSONField(
        default=dict, blank=True,
        help_text='Per-register overrides for global POS security rules'
    )

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)


    class Meta:
        db_table = 'pos_register'
        unique_together = ('name', 'branch', 'organization')
        ordering = ['branch__name', 'name']

    def __str__(self):
        return f"{self.name} @ {self.branch.name}"

    @property
    def current_session(self):
        return self.sessions.filter(status='OPEN').first()

    @property
    def is_open(self):
        return self.sessions.filter(status='OPEN').exists()


class RegisterSession(TenantModel):
    """A shift/session on a register. Tracks open/close with cash counting."""
    STATUS_CHOICES = (
        ('OPEN', 'Open'),
        ('CLOSING', 'Closing'),
        ('CLOSED', 'Closed'),
        ('FORCE_CLOSED', 'Force Closed'),
    )

    register = models.ForeignKey(POSRegister, on_delete=models.CASCADE, related_name='sessions')
    cashier = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='register_sessions')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')

    # Opening
    opened_at = models.DateTimeField(auto_now_add=True)
    opening_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    opening_notes = models.TextField(null=True, blank=True)

    # Closing
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='closed_sessions')
    closing_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    expected_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    difference = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    closing_notes = models.TextField(null=True, blank=True)

    # Counters (auto-calculated on close)
    total_sales = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_transactions = models.IntegerField(default=0)
    total_cash_in = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_cash_out = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # ── Reconciliation Strategy Data ──
    # JSON: { account_id: { software: X, statement: Y, diff: Z } }
    reconciliation_data = models.JSONField(null=True, blank=True, default=dict,
        help_text='Per-account reconciliation: software vs real statement')

    # Address book balance (manual offline ledger)
    address_book_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Net balance from the cashier address book (in - out)')

    # Cash reconciliation
    cash_counted = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Actual physical cash counted by cashier')
    cash_expected = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Expected cash after calibration: opening + cash_sales + calibration_adjustments')
    cash_difference = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='cash_counted - cash_expected. Positive = excess, negative = shortage')

    # What happened with excesses/shortages
    excess_transferred_to = models.ForeignKey(
        'finance.FinancialAccount', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='session_excess',
        help_text='Where excess cash was transferred to')
    shortage_deducted_from = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='session_shortages',
        help_text='Cashier who was debited for the shortage')

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'pos_register_session'
        ordering = ['-opened_at']

    def __str__(self):
        return f"Session {self.id} - {self.register.name} ({self.status})"


class CashierAddressBook(TenantModel):
    """
    Cashier Daily Ledger ("Livre de Caisse")
    ─────────────────────────────────────────
    Tracks ALL money movements a cashier handles during their shift.
    Everything goes here: supplier payments, expenses, client payments,
    sales returns, register variances, partner contributions, etc.

    Philosophy: Keep business running without a manager present.
    Cashiers record everything freely. Owner/manager audits daily.
    Goal: Process all entries until balance = 0.
    """
    ENTRY_TYPE_CHOICES = (
        ('SUPPLIER_PAYMENT', 'Supplier Payment'),
        ('EXPENSE', 'Expense'),
        ('PARTNER_CAPITAL_IN', 'Partner Capital Injection'),
        ('PARTNER_CASH_IN', 'Partner Cash Transfer (In)'),
        ('PARTNER_CAPITAL_OUT', 'Partner Capital Withdrawal'),
        ('PARTNER_CASH_OUT', 'Partner Cash Transfer (Out)'),
        ('CLIENT_PAYMENT', 'Client Payment'),
        ('CLIENT_PREPAYMENT', 'Client Prepayment'),
        ('SALE_DEPOSIT', 'Sale Deposit'),
        ('SALES_RETURN', 'Sales Return / Refund'),
        ('CASH_OVERAGE', 'Cash Overage (Écart +)'),
        ('CASH_SHORTAGE', 'Cash Shortage (Écart -)'),
        ('MONEY_TRANSFER', 'Money Transfer'),
        ('OTHER_IN', 'Other (Money In)'),
        ('OTHER_OUT', 'Other (Money Out)'),
    )

    DIRECTION_CHOICES = (
        ('IN', 'Entrée'),
        ('OUT', 'Sortie'),
    )

    STATUS_CHOICES = (
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('NEED_INFO', 'Need More Info'),
        ('MODIFIED', 'Modified (Re-submitted)'),
    )

    # ── Core ──
    session = models.ForeignKey(RegisterSession, on_delete=models.CASCADE, related_name='address_book_entries')
    cashier = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='address_book_created')

    # ── Classification ──
    entry_type = models.CharField(max_length=30, choices=ENTRY_TYPE_CHOICES, default='OTHER_IN',
        help_text='Type of transaction — determines auto-linking after approval')
    direction = models.CharField(max_length=3, choices=DIRECTION_CHOICES, default='IN',
        help_text='Entrée (IN) or Sortie (OUT)')
    description = models.CharField(max_length=255, help_text='What was this payment for?')
    reference = models.CharField(max_length=100, null=True, blank=True,
        help_text='Reference number, receipt number, or link')
    amount_in = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Money received')
    amount_out = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Money paid out')

    # ── Linking (optional, depends on entry_type) ──
    supplier_id = models.IntegerField(null=True, blank=True,
        help_text='Contact ID of supplier (for SUPPLIER_PAYMENT)')
    supplier_name = models.CharField(max_length=255, null=True, blank=True,
        help_text='Supplier name for display')
    supplier_invoice_id = models.IntegerField(null=True, blank=True,
        help_text='Invoice ID for supplier payment')
    supplier_invoice_ref = models.CharField(max_length=100, null=True, blank=True,
        help_text='Invoice reference for display')
    client_id = models.IntegerField(null=True, blank=True,
        help_text='Contact ID of client (for CLIENT_PAYMENT / PREPAYMENT)')
    client_name = models.CharField(max_length=255, null=True, blank=True,
        help_text='Client name for display')
    client_invoice_id = models.IntegerField(null=True, blank=True,
        help_text='Invoice ID for client payment')
    client_invoice_ref = models.CharField(max_length=100, null=True, blank=True,
        help_text='Invoice reference for display')
    expense_category = models.CharField(max_length=100, null=True, blank=True,
        help_text='Expense category (for EXPENSE type)')
    partner_id = models.IntegerField(null=True, blank=True,
        help_text='Contact ID of partner')
    partner_name = models.CharField(max_length=255, null=True, blank=True,
        help_text='Partner/owner name')
    linked_order_id = models.IntegerField(null=True, blank=True,
        help_text='POS Order ID (for SALES_RETURN)')
    linked_order_ref = models.CharField(max_length=100, null=True, blank=True,
        help_text='POS Order reference (for SALES_RETURN)')
    target_account_id = models.IntegerField(null=True, blank=True,
        help_text='COA Account ID for direct posting after approval')

    # ── Approval Workflow ──
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='address_book_approved')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_notes = models.TextField(null=True, blank=True,
        help_text='Reason for rejection / info request by manager')
    cashier_response = models.TextField(null=True, blank=True,
        help_text='Cashier explanation after rejection or info request')

    # ── Visibility ──
    hidden_from_cashier = models.BooleanField(default=False,
        help_text='If True, only visible to managers (e.g. CASH_OVERAGE)')

    # ── Audit Trail ──
    original_entry_id = models.IntegerField(null=True, blank=True,
        help_text='If this is a modification, links to original entry')
    is_deleted = models.BooleanField(default=False,
        help_text='Soft-delete flag — keeps audit trail')
    deleted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='address_book_deleted')
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pos_cashier_address_book'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_entry_type_display()}] {self.description}: in={self.amount_in} out={self.amount_out} [{self.status}]"

    @property
    def net(self):
        return self.amount_in - self.amount_out

    def save(self, *args, **kwargs):
        # Auto-derive direction from entry_type
        OUT_TYPES = {'SUPPLIER_PAYMENT', 'EXPENSE', 'PARTNER_CAPITAL_OUT', 'PARTNER_CASH_OUT', 'SALES_RETURN', 'CASH_SHORTAGE', 'OTHER_OUT'}
        IN_TYPES = {'PARTNER_CAPITAL_IN', 'PARTNER_CASH_IN', 'CLIENT_PAYMENT', 'CLIENT_PREPAYMENT', 'SALE_DEPOSIT', 'CASH_OVERAGE', 'OTHER_IN'}
        if self.entry_type in OUT_TYPES:
            self.direction = 'OUT'
        elif self.entry_type in IN_TYPES:
            self.direction = 'IN'
        # MONEY_TRANSFER: direction is set manually (can be either)

        # Auto-hide cash overages from cashier
        if self.entry_type == 'CASH_OVERAGE':
            self.hidden_from_cashier = True
            self.status = 'APPROVED'

        super().save(*args, **kwargs)


class DailyAddressBookSnapshot(TenantModel):
    """
    Immutable daily snapshot of the Address Book.
    Created when register closes or on-demand by manager.
    Serves as legal/audit trail — cannot be modified after creation.
    """
    date = models.DateField()
    register = models.ForeignKey('POSRegister', on_delete=models.CASCADE, related_name='address_book_snapshots')
    session = models.ForeignKey(RegisterSession, on_delete=models.CASCADE, related_name='address_book_snapshots')
    cashier = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    # Totals
    total_in = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_out = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Counts
    pending_count = models.IntegerField(default=0)
    approved_count = models.IntegerField(default=0)
    rejected_count = models.IntegerField(default=0)

    # Immutable copy of all entries
    entries_json = models.JSONField(default=list, help_text='Full snapshot of all entries')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pos_daily_address_book_snapshot'
        ordering = ['-date']
        unique_together = [('organization', 'session', 'date')]

    def __str__(self):
        return f"Snapshot {self.date} - {self.register.name} (bal={self.balance})"


class SessionAccountReconciliation(TenantModel):
    """
    Per-account reconciliation record for a session close.
    Controlled accounts (Wave, OM, Bank) use the provider statement as truth.
    Any difference is calibrated to the cash account.
    """
    session = models.ForeignKey(RegisterSession, on_delete=models.CASCADE, related_name='account_reconciliations')
    account = models.ForeignKey('finance.FinancialAccount', on_delete=models.CASCADE)

    software_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Total recorded in software for this account during session')
    statement_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Real amount from provider statement')
    difference = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='software - statement. Positive = over-recorded, negative = under-recorded')
    calibrated_to_cash = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Amount moved to/from cash to calibrate. Negative = moved from cash')

    is_controlled = models.BooleanField(default=True,
        help_text='True = provider statement is truth (Wave, OM, Bank). False = manual (Cash)')
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'pos_session_account_reconciliation'
        unique_together = ('session', 'account')

    def __str__(self):
        return f"Recon {self.account.name}: SW={self.software_amount} ST={self.statement_amount}"


class POSSettings(TenantModel):
    """
    Organisation-wide POS configuration document.
    One per organisation.
    """
    # ── Delivery Confirmation Codes ──
    require_driver_pos_code = models.BooleanField(
        default=False,
        help_text='Driver must show a code to cashier when returning cash.'
    )
    require_client_delivery_code = models.BooleanField(
        default=False,
        help_text='Client receives a code; driver must enter it to confirm delivery.'
    )

    # ── SMS Provider ──
    SMS_PROVIDER_CHOICES = [
        ('none',             'Disabled'),
        ('twilio',           'Twilio'),
        ('africas_talking',  "Africa's Talking"),
        ('infobip',          'Infobip'),
        ('webhook',          'Generic Webhook / Custom'),
    ]
    sms_delivery_code_enabled = models.BooleanField(
        default=False,
        help_text='Send client_delivery_code to client via SMS when a delivery is created.'
    )
    sms_provider = models.CharField(
        max_length=30, choices=SMS_PROVIDER_CHOICES, default='none',
        help_text='SMS gateway provider.'
    )
    # Twilio: account_sid goes here; Africa\'s Talking: username goes here
    sms_account_sid = models.CharField(max_length=200, null=True, blank=True)
    # API key / auth token / API secret
    sms_api_key = models.CharField(max_length=500, null=True, blank=True)
    # Twilio: +1234567890 | Africa\'s Talking: shortcode or alpha sender | Infobip: sender name
    sms_sender_id = models.CharField(max_length=100, null=True, blank=True)
    # Infobip base URL or Generic Webhook URL
    sms_webhook_url = models.CharField(max_length=500, null=True, blank=True)

    # ── Loyalty Program ──
    loyalty_point_value = models.DecimalField(
        max_digits=12, decimal_places=4, default='1.0000',
        help_text='Monetary value of 1 loyalty point (e.g. 500 means 1 point = 500 of your currency).'
    )
    loyalty_earn_rate = models.DecimalField(
        max_digits=12, decimal_places=4, default='10.0000',
        help_text='Amount of currency spent to earn 1 loyalty point (e.g. 10000 means spend 10,000 to earn 1 point).'
    )

    # ── Stock Policy ──
    allow_negative_stock = models.BooleanField(
        default=False,
        help_text=(
            'When enabled: cashiers can add out-of-stock items freely (negative inventory allowed). '
            'When disabled: out-of-stock items are blocked; overselling shows a warning toast.'
        )
    )

    # ── Register Cash Account Isolation ──
    restrict_unique_cash_account = models.BooleanField(
        default=True,
        help_text=(
            'When enabled: each register must have its own unique cash account. '
            'A new cash account is auto-created under RegisterCash in the COA when creating a register. '
            'Prevents two registers from sharing the same cash ledger account.'
        )
    )

    # ── POS Connectivity Mode ──
    pos_offline_enabled = models.BooleanField(
        default=True,
        help_text=(
            'When enabled: POS can queue orders offline and sync when connection returns. '
            'When disabled: POS requires active internet — all operations blocked if offline.'
        )
    )

    class Meta:
        db_table = 'pos_settings'


    def __str__(self):
        return f"POS Settings ({self.organization})"
