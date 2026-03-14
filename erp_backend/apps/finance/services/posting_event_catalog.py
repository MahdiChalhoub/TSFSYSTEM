"""
Enterprise Posting Event Seed Data
===================================
~150 canonical financial events organized by module.document_type.line_role

This data seeds the PostingEvent table and serves as the governed event vocabulary.
"""

POSTING_EVENT_CATALOG = [
    # ═══════════════════════════════════════════════════════════════
    # SALES MODULE (~25 events)
    # ═══════════════════════════════════════════════════════════════

    # Sales Invoice
    {'code': 'sales.invoice.receivable', 'module': 'sales', 'document_type': 'invoice', 'line_role': 'receivable', 'normal_balance': 'DEBIT', 'criticality': 'CRITICAL', 'description': 'Accounts Receivable from sales invoice'},
    {'code': 'sales.invoice.revenue', 'module': 'sales', 'document_type': 'invoice', 'line_role': 'revenue', 'normal_balance': 'CREDIT', 'criticality': 'CRITICAL', 'description': 'Sales revenue recognition'},
    {'code': 'sales.invoice.discount', 'module': 'sales', 'document_type': 'invoice', 'line_role': 'discount', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Discount given on sales invoice'},
    {'code': 'sales.invoice.vat_output', 'module': 'sales', 'document_type': 'invoice', 'line_role': 'vat_output', 'normal_balance': 'CREDIT', 'criticality': 'CONDITIONAL', 'description': 'VAT collected / output tax on sales'},
    {'code': 'sales.invoice.rounding', 'module': 'sales', 'document_type': 'invoice', 'line_role': 'rounding', 'normal_balance': 'EITHER', 'criticality': 'OPTIONAL', 'description': 'Rounding difference on sales invoice'},
    {'code': 'sales.invoice.shipping_revenue', 'module': 'sales', 'document_type': 'invoice', 'line_role': 'shipping_revenue', 'normal_balance': 'CREDIT', 'criticality': 'OPTIONAL', 'description': 'Revenue from shipping/delivery charges'},
    {'code': 'sales.invoice.service_revenue', 'module': 'sales', 'document_type': 'invoice', 'line_role': 'service_revenue', 'normal_balance': 'CREDIT', 'criticality': 'OPTIONAL', 'description': 'Revenue from service-type items'},
    {'code': 'sales.invoice.advance_offset', 'module': 'sales', 'document_type': 'invoice', 'line_role': 'advance_offset', 'normal_balance': 'DEBIT', 'criticality': 'OPTIONAL', 'description': 'Offset customer advance/deposit against invoice'},
    {'code': 'sales.invoice.deposit_liability', 'module': 'sales', 'document_type': 'invoice', 'line_role': 'deposit_liability', 'normal_balance': 'CREDIT', 'criticality': 'OPTIONAL', 'description': 'Customer deposit held as liability'},
    {'code': 'sales.invoice.loyalty_liability', 'module': 'sales', 'document_type': 'invoice', 'line_role': 'loyalty_liability', 'normal_balance': 'CREDIT', 'criticality': 'OPTIONAL', 'description': 'Loyalty points liability from sales'},

    # Credit Notes
    {'code': 'sales.credit_note.receivable_reversal', 'module': 'sales', 'document_type': 'credit_note', 'line_role': 'receivable_reversal', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Reverse AR entry for credit note'},
    {'code': 'sales.credit_note.revenue_reversal', 'module': 'sales', 'document_type': 'credit_note', 'line_role': 'revenue_reversal', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Reverse revenue for credit note'},
    {'code': 'sales.credit_note.discount_reversal', 'module': 'sales', 'document_type': 'credit_note', 'line_role': 'discount_reversal', 'normal_balance': 'CREDIT', 'criticality': 'OPTIONAL', 'description': 'Reverse discount on credit note'},
    {'code': 'sales.credit_note.vat_output_reversal', 'module': 'sales', 'document_type': 'credit_note', 'line_role': 'vat_output_reversal', 'normal_balance': 'DEBIT', 'criticality': 'CONDITIONAL', 'description': 'Reverse VAT on credit note'},

    # Refunds
    {'code': 'sales.refund.cash', 'module': 'sales', 'document_type': 'refund', 'line_role': 'cash', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Cash refund to customer'},
    {'code': 'sales.refund.bank', 'module': 'sales', 'document_type': 'refund', 'line_role': 'bank', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Bank refund to customer'},
    {'code': 'sales.refund.receivable', 'module': 'sales', 'document_type': 'refund', 'line_role': 'receivable', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'AR offset for customer refund'},

    # Write-offs
    {'code': 'sales.writeoff.bad_debt_expense', 'module': 'sales', 'document_type': 'writeoff', 'line_role': 'bad_debt_expense', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Bad debt expense recognition'},
    {'code': 'sales.writeoff.receivable', 'module': 'sales', 'document_type': 'writeoff', 'line_role': 'receivable', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Write off uncollectible receivable'},

    # Commissions
    {'code': 'sales.commission.expense', 'module': 'sales', 'document_type': 'commission', 'line_role': 'expense', 'normal_balance': 'DEBIT', 'criticality': 'OPTIONAL', 'description': 'Sales commission expense'},
    {'code': 'sales.commission.payable', 'module': 'sales', 'document_type': 'commission', 'line_role': 'payable', 'normal_balance': 'CREDIT', 'criticality': 'OPTIONAL', 'description': 'Sales commission payable'},

    # ═══════════════════════════════════════════════════════════════
    # PURCHASES MODULE (~22 events)
    # ═══════════════════════════════════════════════════════════════

    # Purchase Invoice
    {'code': 'purchases.invoice.payable', 'module': 'purchases', 'document_type': 'invoice', 'line_role': 'payable', 'normal_balance': 'CREDIT', 'criticality': 'CRITICAL', 'description': 'Accounts Payable from purchase invoice'},
    {'code': 'purchases.invoice.expense', 'module': 'purchases', 'document_type': 'invoice', 'line_role': 'expense', 'normal_balance': 'DEBIT', 'criticality': 'CRITICAL', 'description': 'Purchase expense recognition'},
    {'code': 'purchases.invoice.inventory', 'module': 'purchases', 'document_type': 'invoice', 'line_role': 'inventory', 'normal_balance': 'DEBIT', 'criticality': 'CRITICAL', 'description': 'Inventory value from purchase'},
    {'code': 'purchases.invoice.vat_input', 'module': 'purchases', 'document_type': 'invoice', 'line_role': 'vat_input', 'normal_balance': 'DEBIT', 'criticality': 'CONDITIONAL', 'description': 'VAT recoverable / input tax on purchases'},
    {'code': 'purchases.invoice.discount', 'module': 'purchases', 'document_type': 'invoice', 'line_role': 'discount', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Discount earned on purchase invoice'},
    {'code': 'purchases.invoice.freight', 'module': 'purchases', 'document_type': 'invoice', 'line_role': 'freight', 'normal_balance': 'DEBIT', 'criticality': 'OPTIONAL', 'description': 'Freight / delivery fees on purchase'},
    {'code': 'purchases.invoice.rounding', 'module': 'purchases', 'document_type': 'invoice', 'line_role': 'rounding', 'normal_balance': 'EITHER', 'criticality': 'OPTIONAL', 'description': 'Rounding difference on purchase invoice'},

    # Purchase Returns
    {'code': 'purchases.return.payable_reversal', 'module': 'purchases', 'document_type': 'return', 'line_role': 'payable_reversal', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Reverse AP for purchase return'},
    {'code': 'purchases.return.inventory_reversal', 'module': 'purchases', 'document_type': 'return', 'line_role': 'inventory_reversal', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Reverse inventory for purchase return'},
    {'code': 'purchases.return.vat_input_reversal', 'module': 'purchases', 'document_type': 'return', 'line_role': 'vat_input_reversal', 'normal_balance': 'CREDIT', 'criticality': 'CONDITIONAL', 'description': 'Reverse VAT input for purchase return'},

    # Vendor Payments
    {'code': 'purchases.payment.cash', 'module': 'purchases', 'document_type': 'payment', 'line_role': 'cash', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Cash payment to vendor'},
    {'code': 'purchases.payment.bank', 'module': 'purchases', 'document_type': 'payment', 'line_role': 'bank', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Bank payment to vendor'},
    {'code': 'purchases.payment.payable', 'module': 'purchases', 'document_type': 'payment', 'line_role': 'payable', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'AP settlement for vendor payment'},

    # Vendor Credits
    {'code': 'purchases.vendor_credit.payable', 'module': 'purchases', 'document_type': 'vendor_credit', 'line_role': 'payable', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Reduce AP for vendor credit'},
    {'code': 'purchases.vendor_credit.expense_reversal', 'module': 'purchases', 'document_type': 'vendor_credit', 'line_role': 'expense_reversal', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Reverse expense for vendor credit'},
    {'code': 'purchases.vendor_credit.inventory_reversal', 'module': 'purchases', 'document_type': 'vendor_credit', 'line_role': 'inventory_reversal', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Reverse inventory for vendor credit'},

    # Purchase Write-offs
    {'code': 'purchases.writeoff.payable', 'module': 'purchases', 'document_type': 'writeoff', 'line_role': 'payable', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Write off vendor payable'},
    {'code': 'purchases.writeoff.expense', 'module': 'purchases', 'document_type': 'writeoff', 'line_role': 'expense', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Expense offset for vendor writeoff'},

    # ═══════════════════════════════════════════════════════════════
    # INVENTORY MODULE (~18 events)
    # ═══════════════════════════════════════════════════════════════

    # Stock Receipt
    {'code': 'inventory.receipt.inventory', 'module': 'inventory', 'document_type': 'receipt', 'line_role': 'inventory', 'normal_balance': 'DEBIT', 'criticality': 'CRITICAL', 'description': 'Inventory increase from goods receipt'},
    {'code': 'inventory.receipt.grni', 'module': 'inventory', 'document_type': 'receipt', 'line_role': 'grni', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Goods Received Not Invoiced (accrual)'},

    # Stock Issue / COGS
    {'code': 'inventory.issue.cogs', 'module': 'inventory', 'document_type': 'issue', 'line_role': 'cogs', 'normal_balance': 'DEBIT', 'criticality': 'CRITICAL', 'description': 'Cost of Goods Sold on sales issue'},
    {'code': 'inventory.issue.inventory', 'module': 'inventory', 'document_type': 'issue', 'line_role': 'inventory', 'normal_balance': 'CREDIT', 'criticality': 'CRITICAL', 'description': 'Inventory decrease on issue'},

    # Stock Adjustment
    {'code': 'inventory.adjustment.loss', 'module': 'inventory', 'document_type': 'adjustment', 'line_role': 'loss', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Inventory adjustment loss expense'},
    {'code': 'inventory.adjustment.gain', 'module': 'inventory', 'document_type': 'adjustment', 'line_role': 'gain', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Inventory adjustment gain income'},
    {'code': 'inventory.adjustment.inventory', 'module': 'inventory', 'document_type': 'adjustment', 'line_role': 'inventory', 'normal_balance': 'EITHER', 'criticality': 'STANDARD', 'description': 'Inventory value adjustment'},

    # Stock Transfer
    {'code': 'inventory.transfer.source_inventory', 'module': 'inventory', 'document_type': 'transfer', 'line_role': 'source_inventory', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Inventory decrease at source warehouse'},
    {'code': 'inventory.transfer.destination_inventory', 'module': 'inventory', 'document_type': 'transfer', 'line_role': 'destination_inventory', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Inventory increase at destination warehouse'},

    # Production / Manufacturing
    {'code': 'inventory.production.raw_material', 'module': 'inventory', 'document_type': 'production', 'line_role': 'raw_material', 'normal_balance': 'CREDIT', 'criticality': 'CONDITIONAL', 'description': 'Raw material consumption'},
    {'code': 'inventory.production.wip', 'module': 'inventory', 'document_type': 'production', 'line_role': 'wip', 'normal_balance': 'DEBIT', 'criticality': 'CONDITIONAL', 'description': 'Work In Progress during production'},
    {'code': 'inventory.production.finished_goods', 'module': 'inventory', 'document_type': 'production', 'line_role': 'finished_goods', 'normal_balance': 'DEBIT', 'criticality': 'CONDITIONAL', 'description': 'Finished goods from production'},
    {'code': 'inventory.production.variance', 'module': 'inventory', 'document_type': 'production', 'line_role': 'variance', 'normal_balance': 'EITHER', 'criticality': 'CONDITIONAL', 'description': 'Production cost variance'},

    # Write-offs / Expiry
    {'code': 'inventory.writeoff.inventory', 'module': 'inventory', 'document_type': 'writeoff', 'line_role': 'inventory', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Inventory writeoff (count/damage)'},
    {'code': 'inventory.writeoff.expense', 'module': 'inventory', 'document_type': 'writeoff', 'line_role': 'expense', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Expense from inventory writeoff'},
    {'code': 'inventory.expiry.inventory', 'module': 'inventory', 'document_type': 'expiry', 'line_role': 'inventory', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Inventory decrease from expired goods'},
    {'code': 'inventory.expiry.loss', 'module': 'inventory', 'document_type': 'expiry', 'line_role': 'loss', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Loss from expired inventory'},

    # ═══════════════════════════════════════════════════════════════
    # PAYMENTS MODULE (~14 events)
    # ═══════════════════════════════════════════════════════════════

    # Customer Payments
    {'code': 'payments.customer.cash', 'module': 'payments', 'document_type': 'customer', 'line_role': 'cash', 'normal_balance': 'DEBIT', 'criticality': 'CRITICAL', 'description': 'Cash received from customer'},
    {'code': 'payments.customer.bank', 'module': 'payments', 'document_type': 'customer', 'line_role': 'bank', 'normal_balance': 'DEBIT', 'criticality': 'CRITICAL', 'description': 'Bank deposit from customer payment'},
    {'code': 'payments.customer.receivable', 'module': 'payments', 'document_type': 'customer', 'line_role': 'receivable', 'normal_balance': 'CREDIT', 'criticality': 'CRITICAL', 'description': 'AR settlement from customer payment'},

    # Supplier Payments
    {'code': 'payments.supplier.cash', 'module': 'payments', 'document_type': 'supplier', 'line_role': 'cash', 'normal_balance': 'CREDIT', 'criticality': 'CRITICAL', 'description': 'Cash payment to supplier'},
    {'code': 'payments.supplier.bank', 'module': 'payments', 'document_type': 'supplier', 'line_role': 'bank', 'normal_balance': 'CREDIT', 'criticality': 'CRITICAL', 'description': 'Bank payment to supplier'},
    {'code': 'payments.supplier.payable', 'module': 'payments', 'document_type': 'supplier', 'line_role': 'payable', 'normal_balance': 'DEBIT', 'criticality': 'CRITICAL', 'description': 'AP settlement for supplier payment'},

    # Payment Fees
    {'code': 'payments.fee.bank_charge', 'module': 'payments', 'document_type': 'fee', 'line_role': 'bank_charge', 'normal_balance': 'DEBIT', 'criticality': 'OPTIONAL', 'description': 'Bank charge / service fee'},
    {'code': 'payments.fee.processor_fee', 'module': 'payments', 'document_type': 'fee', 'line_role': 'processor_fee', 'normal_balance': 'DEBIT', 'criticality': 'OPTIONAL', 'description': 'Payment processor fee'},

    # Adjustments
    {'code': 'payments.adjustment.receivable', 'module': 'payments', 'document_type': 'adjustment', 'line_role': 'receivable', 'normal_balance': 'EITHER', 'criticality': 'STANDARD', 'description': 'AR adjustment (over/underpayment)'},
    {'code': 'payments.adjustment.payable', 'module': 'payments', 'document_type': 'adjustment', 'line_role': 'payable', 'normal_balance': 'EITHER', 'criticality': 'STANDARD', 'description': 'AP adjustment (over/underpayment)'},

    # Refund Flows
    {'code': 'payments.refund.cash', 'module': 'payments', 'document_type': 'refund', 'line_role': 'cash', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Cash refund outflow'},
    {'code': 'payments.refund.bank', 'module': 'payments', 'document_type': 'refund', 'line_role': 'bank', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Bank refund outflow'},

    # ═══════════════════════════════════════════════════════════════
    # TAX ENGINE (~15 events)
    # ═══════════════════════════════════════════════════════════════

    {'code': 'tax.vat.output', 'module': 'tax', 'document_type': 'vat', 'line_role': 'output', 'normal_balance': 'CREDIT', 'criticality': 'CONDITIONAL', 'description': 'VAT collected (output tax)'},
    {'code': 'tax.vat.input', 'module': 'tax', 'document_type': 'vat', 'line_role': 'input', 'normal_balance': 'DEBIT', 'criticality': 'CONDITIONAL', 'description': 'VAT deductible (input tax)'},
    {'code': 'tax.vat.payable', 'module': 'tax', 'document_type': 'vat', 'line_role': 'payable', 'normal_balance': 'CREDIT', 'criticality': 'CONDITIONAL', 'description': 'Net VAT payable to government'},
    {'code': 'tax.vat.recoverable', 'module': 'tax', 'document_type': 'vat', 'line_role': 'recoverable', 'normal_balance': 'DEBIT', 'criticality': 'CONDITIONAL', 'description': 'VAT credit / refund receivable'},
    {'code': 'tax.vat.adjustment', 'module': 'tax', 'document_type': 'vat', 'line_role': 'adjustment', 'normal_balance': 'EITHER', 'criticality': 'OPTIONAL', 'description': 'VAT period adjustment'},
    {'code': 'tax.vat.suspense', 'module': 'tax', 'document_type': 'vat', 'line_role': 'suspense', 'normal_balance': 'EITHER', 'criticality': 'OPTIONAL', 'description': 'VAT suspense / pending classification'},

    # Withholding
    {'code': 'tax.withholding.sales', 'module': 'tax', 'document_type': 'withholding', 'line_role': 'sales', 'normal_balance': 'CREDIT', 'criticality': 'CONDITIONAL', 'description': 'Withholding tax on sales'},
    {'code': 'tax.withholding.purchases', 'module': 'tax', 'document_type': 'withholding', 'line_role': 'purchases', 'normal_balance': 'DEBIT', 'criticality': 'CONDITIONAL', 'description': 'Withholding tax on purchases'},
    {'code': 'tax.withholding.payable', 'module': 'tax', 'document_type': 'withholding', 'line_role': 'payable', 'normal_balance': 'CREDIT', 'criticality': 'CONDITIONAL', 'description': 'Withholding tax payable to government'},

    # AIRSI / Local taxes
    {'code': 'tax.airsi.purchases', 'module': 'tax', 'document_type': 'airsi', 'line_role': 'purchases', 'normal_balance': 'DEBIT', 'criticality': 'CONDITIONAL', 'description': 'AIRSI withheld on purchase'},
    {'code': 'tax.airsi.payable', 'module': 'tax', 'document_type': 'airsi', 'line_role': 'payable', 'normal_balance': 'CREDIT', 'criticality': 'CONDITIONAL', 'description': 'AIRSI payable to DGI'},
    {'code': 'tax.airsi.expense', 'module': 'tax', 'document_type': 'airsi', 'line_role': 'expense', 'normal_balance': 'DEBIT', 'criticality': 'CONDITIONAL', 'description': 'AIRSI recognized as expense'},

    # Tax settlements
    {'code': 'tax.settlement.vat_payable', 'module': 'tax', 'document_type': 'settlement', 'line_role': 'vat_payable', 'normal_balance': 'DEBIT', 'criticality': 'CONDITIONAL', 'description': 'VAT settlement — clear payable'},
    {'code': 'tax.settlement.vat_recoverable', 'module': 'tax', 'document_type': 'settlement', 'line_role': 'vat_recoverable', 'normal_balance': 'CREDIT', 'criticality': 'CONDITIONAL', 'description': 'VAT settlement — clear recoverable'},
    {'code': 'tax.settlement.reverse_charge', 'module': 'tax', 'document_type': 'settlement', 'line_role': 'reverse_charge', 'normal_balance': 'EITHER', 'criticality': 'CONDITIONAL', 'description': 'VAT reverse charge mechanism'},

    # ═══════════════════════════════════════════════════════════════
    # TREASURY MODULE (~10 events)
    # ═══════════════════════════════════════════════════════════════

    {'code': 'treasury.cash.deposit', 'module': 'treasury', 'document_type': 'cash', 'line_role': 'deposit', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Cash deposit to bank'},
    {'code': 'treasury.cash.withdrawal', 'module': 'treasury', 'document_type': 'cash', 'line_role': 'withdrawal', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Cash withdrawal from bank'},
    {'code': 'treasury.bank.deposit', 'module': 'treasury', 'document_type': 'bank', 'line_role': 'deposit', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Bank deposit received'},
    {'code': 'treasury.bank.withdrawal', 'module': 'treasury', 'document_type': 'bank', 'line_role': 'withdrawal', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Bank withdrawal/transfer'},
    {'code': 'treasury.bank.transfer', 'module': 'treasury', 'document_type': 'bank', 'line_role': 'transfer', 'normal_balance': 'EITHER', 'criticality': 'STANDARD', 'description': 'Inter-bank transfer'},
    {'code': 'treasury.fx.gain', 'module': 'treasury', 'document_type': 'fx', 'line_role': 'gain', 'normal_balance': 'CREDIT', 'criticality': 'CONDITIONAL', 'description': 'Foreign exchange gain'},
    {'code': 'treasury.fx.loss', 'module': 'treasury', 'document_type': 'fx', 'line_role': 'loss', 'normal_balance': 'DEBIT', 'criticality': 'CONDITIONAL', 'description': 'Foreign exchange loss'},
    {'code': 'treasury.reconciliation.adjustment', 'module': 'treasury', 'document_type': 'reconciliation', 'line_role': 'adjustment', 'normal_balance': 'EITHER', 'criticality': 'OPTIONAL', 'description': 'Bank reconciliation adjustment'},

    # ═══════════════════════════════════════════════════════════════
    # FIXED ASSETS MODULE (~10 events)
    # ═══════════════════════════════════════════════════════════════

    {'code': 'assets.purchase.asset', 'module': 'assets', 'document_type': 'purchase', 'line_role': 'asset', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Fixed asset acquisition'},
    {'code': 'assets.purchase.payable', 'module': 'assets', 'document_type': 'purchase', 'line_role': 'payable', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Payable for asset purchase'},
    {'code': 'assets.purchase.vat_input', 'module': 'assets', 'document_type': 'purchase', 'line_role': 'vat_input', 'normal_balance': 'DEBIT', 'criticality': 'CONDITIONAL', 'description': 'VAT on asset purchase'},
    {'code': 'assets.depreciation.expense', 'module': 'assets', 'document_type': 'depreciation', 'line_role': 'expense', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Depreciation/amortization expense'},
    {'code': 'assets.depreciation.accumulated', 'module': 'assets', 'document_type': 'depreciation', 'line_role': 'accumulated', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Accumulated depreciation'},
    {'code': 'assets.disposal.asset', 'module': 'assets', 'document_type': 'disposal', 'line_role': 'asset', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Remove disposed asset value'},
    {'code': 'assets.disposal.accumulated', 'module': 'assets', 'document_type': 'disposal', 'line_role': 'accumulated', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Clear accumulated depreciation on disposal'},
    {'code': 'assets.disposal.gain', 'module': 'assets', 'document_type': 'disposal', 'line_role': 'gain', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Gain on asset disposal'},
    {'code': 'assets.disposal.loss', 'module': 'assets', 'document_type': 'disposal', 'line_role': 'loss', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Loss on asset disposal'},

    # ═══════════════════════════════════════════════════════════════
    # EQUITY & CAPITAL MODULE (~8 events)
    # ═══════════════════════════════════════════════════════════════

    {'code': 'equity.capital.contribution', 'module': 'equity', 'document_type': 'capital', 'line_role': 'contribution', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Owner capital contribution'},
    {'code': 'equity.capital.withdrawal', 'module': 'equity', 'document_type': 'capital', 'line_role': 'withdrawal', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Owner capital withdrawal / draw'},
    {'code': 'equity.dividend.declaration', 'module': 'equity', 'document_type': 'dividend', 'line_role': 'declaration', 'normal_balance': 'DEBIT', 'criticality': 'OPTIONAL', 'description': 'Dividend declared'},
    {'code': 'equity.dividend.payment', 'module': 'equity', 'document_type': 'dividend', 'line_role': 'payment', 'normal_balance': 'CREDIT', 'criticality': 'OPTIONAL', 'description': 'Dividend payment'},
    {'code': 'equity.retained_earnings.transfer', 'module': 'equity', 'document_type': 'retained_earnings', 'line_role': 'transfer', 'normal_balance': 'EITHER', 'criticality': 'STANDARD', 'description': 'Transfer to/from retained earnings'},

    # ═══════════════════════════════════════════════════════════════
    # ADJUSTMENT MODULE (~10 events)
    # ═══════════════════════════════════════════════════════════════

    {'code': 'adjustment.journal.debit', 'module': 'adjustment', 'document_type': 'journal', 'line_role': 'debit', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Manual journal debit adjustment'},
    {'code': 'adjustment.journal.credit', 'module': 'adjustment', 'document_type': 'journal', 'line_role': 'credit', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Manual journal credit adjustment'},
    {'code': 'adjustment.accrual.expense', 'module': 'adjustment', 'document_type': 'accrual', 'line_role': 'expense', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Accrued expense'},
    {'code': 'adjustment.accrual.revenue', 'module': 'adjustment', 'document_type': 'accrual', 'line_role': 'revenue', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Accrued revenue'},
    {'code': 'adjustment.deferral.expense', 'module': 'adjustment', 'document_type': 'deferral', 'line_role': 'expense', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Deferred expense (prepayment)'},
    {'code': 'adjustment.deferral.revenue', 'module': 'adjustment', 'document_type': 'deferral', 'line_role': 'revenue', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Deferred revenue (unearned)'},
    {'code': 'adjustment.provision.expense', 'module': 'adjustment', 'document_type': 'provision', 'line_role': 'expense', 'normal_balance': 'DEBIT', 'criticality': 'STANDARD', 'description': 'Provision expense'},
    {'code': 'adjustment.provision.liability', 'module': 'adjustment', 'document_type': 'provision', 'line_role': 'liability', 'normal_balance': 'CREDIT', 'criticality': 'STANDARD', 'description': 'Provision liability'},
]

# Legacy mapping: old flat codes → new 3-level codes (backward compat)
LEGACY_EVENT_MAP = {
    'sales.receivable': 'sales.invoice.receivable',
    'sales.revenue': 'sales.invoice.revenue',
    'sales.income': 'sales.invoice.revenue',
    'sales.vat_collected': 'sales.invoice.vat_output',
    'sales.cogs': 'inventory.issue.cogs',
    'sales.inventory': 'inventory.receipt.inventory',
    'sales.round_off': 'sales.invoice.rounding',
    'sales.discount': 'sales.invoice.discount',
    'purchases.payable': 'purchases.invoice.payable',
    'purchases.expense': 'purchases.invoice.expense',
    'purchases.inventory': 'purchases.invoice.inventory',
    'purchases.vat_recoverable': 'purchases.invoice.vat_input',
    'purchases.vat_suspense': 'tax.vat.suspense',
    'purchases.airsi_payable': 'tax.airsi.payable',
    'purchases.airsi': 'tax.airsi.purchases',
    'purchases.reverse_charge_vat': 'tax.settlement.reverse_charge',
    'purchases.discount_earned': 'purchases.invoice.discount',
    'purchases.delivery_fees': 'purchases.invoice.freight',
    'inventory.adjustment': 'inventory.adjustment.inventory',
    'inventory.transfer': 'inventory.transfer.source_inventory',
    'suspense.reception': 'inventory.receipt.grni',
    'tax.vat_payable': 'tax.vat.payable',
    'tax.vat_refund_receivable': 'tax.vat.recoverable',
    'automation.customerRoot': 'sales.invoice.receivable',
    'automation.supplierRoot': 'purchases.invoice.payable',
    'automation.payrollRoot': 'adjustment.journal.debit',
    'fixedAssets.depreciationExpense': 'assets.depreciation.expense',
    'fixedAssets.accumulatedDepreciation': 'assets.depreciation.accumulated',
    'partners.capital': 'equity.capital.contribution',
    'partners.loan': 'adjustment.journal.debit',
    'partners.withdrawal': 'equity.capital.withdrawal',
    'equity.capital': 'equity.capital.contribution',
    'equity.draws': 'equity.capital.withdrawal',
}
