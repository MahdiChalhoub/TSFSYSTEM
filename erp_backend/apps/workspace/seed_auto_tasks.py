"""
Auto-Task Engine — Complete Seed Catalog
========================================
Seeds 80+ auto-task rules across ALL modules.

Run: python manage.py shell < apps/workspace/seed_auto_tasks.py
Or call: seed_auto_tasks(organization)

Each rule creates:
1. A TaskTemplate (blueprint for the task)
2. An AutoTaskRule (trigger → template → assignment)
"""
import logging

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# CATALOG DEFINITION
# ─────────────────────────────────────────────────────────────────────────────
# Format per entry:
#   code, module, trigger_event, rule_type, name, task_title,
#   priority, estimated_minutes, default_points,
#   recurrence_interval, stale_threshold_days, chain_parent_code, description

AUTO_TASK_CATALOG = [

    # =========================================================================
    # 📦 INVENTORY MODULE (25 rules)
    # =========================================================================

    # ── Price Management ──
    ('INV-01', 'inventory', 'PRICE_CHANGE', 'EVENT',
     'Print price tag on price change',
     '🏷 Print updated price tag',
     'HIGH', 15, 2, None, 0, None,
     'When a product price is changed, create a task to print the new price tag '
     'from the printing engine. The tag should be printed and affixed on shelf.'),

    ('INV-02', 'inventory', 'PRICE_CHANGE', 'EVENT',
     'Apply updated price to POS terminal',
     '💻 Apply new price to POS',
     'HIGH', 5, 1, None, 0, 'INV-01',
     'After price tag is printed (INV-01 completed), apply the updated price '
     'to POS terminals. This ensures shelf price matches POS price.'),

    # ── Barcode Management ──
    ('INV-03', 'inventory', 'BARCODE_MISSING_PURCHASE', 'EVENT',
     'Print barcode for purchased product without barcode',
     '🔖 Print barcode labels (purchase)',
     'HIGH', 20, 2, None, 0, None,
     'When a product without a barcode is received from a purchase, print barcode '
     'labels with the PURCHASED QTY. Shelf manager prints and pastes on all items.'),

    ('INV-04', 'inventory', 'BARCODE_MISSING_TRANSFER', 'EVENT',
     'Print barcode for transferred product without barcode',
     '🔖 Print barcode labels (transfer)',
     'HIGH', 20, 2, None, 0, None,
     'When a product without a barcode is transferred to this warehouse, print '
     'barcode labels with the TRANSFER QTY. Labels pasted before shelving.'),

    ('INV-05', 'inventory', 'BARCODE_DAILY_CHECK', 'RECURRING',
     'Daily check: products without barcodes',
     '📋 Generate barcode labels for untagged products',
     'MEDIUM', 30, 2, 'DAILY', 0, None,
     'Every day at store opening, scan all products that still have no barcode '
     'and generate labels for them. Includes recently created products not yet purchased.'),

    # ── Product Lifecycle ──
    ('INV-06', 'inventory', 'PRODUCT_CREATED', 'EVENT',
     'Review new product data',
     '🔍 Review new product: details, category, price, supplier',
     'MEDIUM', 15, 1, None, 0, None,
     'When a new product is created, verify: correct category, accurate price, '
     'supplier linked, tax class assigned, barcode generated, unit of measure set.'),

    ('INV-07', 'inventory', 'PRODUCT_CREATED', 'EVENT',
     'Assign shelf location to new product',
     '📍 Assign shelf/bin location for new product',
     'LOW', 10, 1, None, 0, 'INV-06',
     'After product review (INV-06), assign it a warehouse zone, aisle, rack, '
     'shelf, and bin location for efficient picking and stocking.'),

    # ── Expiry Management ──
    ('INV-08', 'inventory', 'EXPIRY_APPROACHING', 'EVENT',
     'Alert: product expiring soon',
     '⚠️ Product expiry approaching — review shelf qty',
     'HIGH', 15, 2, None, 0, None,
     'Product is approaching expiry date per organization rules. Review current '
     'shelf quantity, consider promotions, mark down, or return to supplier.'),

    ('INV-09', 'inventory', 'PRODUCT_EXPIRED', 'EVENT',
     'Withdraw expired product from shelf',
     '🚫 Remove expired product from shelf → quarantine',
     'URGENT', 20, 3, None, 0, None,
     'Product has expired. IMMEDIATELY withdraw from sales shelf, move to '
     'quarantine area. Document quantity withdrawn. Notify manager for disposal.'),

    ('INV-10', 'inventory', 'PRODUCT_EXPIRED', 'EVENT',
     'Process expired product disposal',
     '📦 Process disposal / return of expired goods',
     'HIGH', 30, 2, None, 0, 'INV-09',
     'After expired product is quarantined (INV-09), process disposal: create '
     'inventory adjustment, contact supplier for return/credit, update records.'),

    # ── Stock Management ──
    ('INV-11', 'inventory', 'LOW_STOCK', 'EVENT',
     'Create purchase order for low stock',
     '📋 Create reorder for low-stock product',
     'HIGH', 15, 2, None, 0, None,
     'Stock has fallen below minimum threshold. Create a purchase order or '
     'internal transfer request to replenish. Check supplier lead times.'),

    ('INV-12', 'inventory', 'NEGATIVE_STOCK', 'EVENT',
     'Investigate negative stock',
     '🔴 Investigate negative stock — probable count error',
     'URGENT', 30, 3, None, 0, None,
     'Product has gone negative. This indicates a counting error, theft, or '
     'system bug. Perform immediate physical count and reconcile.'),

    ('INV-13', 'inventory', 'STOCK_ADJUSTMENT', 'EVENT',
     'Review stock adjustment justification',
     '📝 Review stock adjustment — verify justification',
     'MEDIUM', 15, 1, None, 0, None,
     'A stock adjustment was made. Review the reason, verify supporting documents, '
     'check for patterns (frequent adjustments on same product = possible issue).'),

    ('INV-14', 'inventory', 'INVENTORY_COUNT', 'RECURRING',
     'Weekly inventory count for high-value items',
     '📊 Perform weekly count: high-value & fast-moving items',
     'MEDIUM', 60, 3, 'WEEKLY', 0, None,
     'Weekly physical count of high-value products, fast-moving items, and products '
     'with recent discrepancies. Compare physical vs system. Flag variances > 2%.'),

    ('INV-15', 'inventory', 'INVENTORY_COUNT', 'RECURRING',
     'Monthly full inventory count',
     '📊 Monthly full physical inventory count',
     'HIGH', 240, 5, 'MONTHLY', 0, None,
     'Full physical inventory count of all products across all warehouse zones. '
     'Create counting session, assign zones to counters, verify all counts.'),

    # ── Data Quality ──
    ('INV-16', 'inventory', 'CUSTOM', 'RECURRING',
     'Daily data quality check',
     '🔍 Check product data quality: missing fields, duplicates',
     'LOW', 20, 1, 'DAILY', 0, None,
     'Daily audit of product data: find products missing images, descriptions, '
     'categories, suppliers, or tax classes. Flag duplicates by name or barcode.'),

    ('INV-17', 'inventory', 'CUSTOM', 'RECURRING',
     'Weekly shelf replenishment check',
     '📦 Check shelf stock vs backroom — replenish shelves',
     'MEDIUM', 45, 2, 'WEEKLY', 0, None,
     'Walk the floor, identify shelves with low display quantities. Pull stock '
     'from backroom to replenish. Follow FIFO (First In, First Out).'),

    # =========================================================================
    # 🛒 PURCHASING MODULE (18 rules)
    # =========================================================================

    ('PUR-01', 'purchasing', 'PURCHASE_NO_ATTACHMENT', 'EVENT',
     'Attach invoice copy to purchase',
     '📎 Attach supplier invoice copy to purchase',
     'HIGH', 10, 1, None, 0, None,
     'A purchase was entered without an invoice attachment. Scan or photograph '
     'the supplier invoice and attach it to the purchase record.'),

    ('PUR-02', 'purchasing', 'PURCHASE_ENTERED', 'EVENT',
     'Verify received quantities',
     '📋 Verify received quantities vs purchase order',
     'HIGH', 30, 2, None, 0, None,
     'Purchase received. Physically count all received items against the PO lines. '
     'Flag any shortages, overages, or damaged goods. Sign delivery note.'),

    ('PUR-03', 'purchasing', 'PURCHASE_ENTERED', 'EVENT',
     'Verify purchase prices',
     '💰 Verify prices vs supplier quotation/agreement',
     'HIGH', 15, 2, None, 0, None,
     'Check that all purchase line prices match the supplier quotation or '
     'price agreement. Flag any price increases or unexpected charges.'),

    ('PUR-04', 'purchasing', 'PURCHASE_ENTERED', 'EVENT',
     'Quality inspection on received goods',
     '🔬 Quality inspection: check condition & conformity',
     'MEDIUM', 20, 2, None, 0, None,
     'Inspect received goods for quality: check packaging integrity, product '
     'condition, expiry dates, labeling compliance. Reject non-conforming items.'),

    ('PUR-05', 'purchasing', 'PURCHASE_ENTERED', 'EVENT',
     'Shelve received products',
     '📦 Shelve received products in assigned locations',
     'MEDIUM', 30, 1, None, 0, 'PUR-02',
     'After quantity verification (PUR-02), shelve all received products in their '
     'assigned warehouse locations. Update bin quantities. Follow FIFO.'),

    ('PUR-06', 'purchasing', 'RECEIPT_VOUCHER', 'EVENT',
     'Create order from receipt voucher',
     '📝 Create purchase order from receipt voucher',
     'HIGH', 20, 2, None, 0, None,
     'A receipt/delivery voucher arrived. Create the corresponding purchase order '
     'if one does not exist. Match against existing POs if possible.'),

    ('PUR-07', 'purchasing', 'PO_APPROVED', 'EVENT',
     'Send approved PO to supplier',
     '📧 Send approved PO to supplier',
     'HIGH', 10, 1, None, 0, None,
     'Purchase order has been approved. Send it to the supplier via email, fax, '
     'or portal. Confirm delivery date and payment terms.'),

    ('PUR-08', 'purchasing', 'PROFORMA_RECEIVED', 'EVENT',
     'Check proforma vs budget',
     '📑 Review proforma: compare with budget & quotations',
     'HIGH', 20, 2, None, 0, None,
     'A proforma invoice was received from a supplier. Compare against budget, '
     'previous quotations, and market prices. Approve or negotiate.'),

    ('PUR-09', 'purchasing', 'TRANSFER_CREATED', 'EVENT',
     'Process transfer at destination',
     '🚚 Receive & verify incoming transfer',
     'HIGH', 30, 2, None, 0, None,
     'A transfer order was created targeting this warehouse. Prepare receiving area, '
     'count incoming items, verify against transfer document, shelve products.'),

    ('PUR-10', 'purchasing', 'ORDER_STALE', 'RECURRING',
     'Follow up on stale purchase orders',
     '⏰ Follow up: PO not confirmed after threshold',
     'HIGH', 15, 1, 'DAILY', 3, None,
     'Daily check for purchase orders stuck in DRAFT/SUBMITTED/ORDERED status '
     'beyond threshold days. Contact supplier or escalate internally.'),

    ('PUR-11', 'purchasing', 'ORDER_STALE', 'RECURRING',
     'Reminder: PO awaiting approval',
     '⏰ Reminder: PO awaiting approval',
     'HIGH', 5, 1, 'DAILY', 2, None,
     'Daily check for POs in SUBMITTED status waiting for approval beyond 2 days. '
     'Remind the approver to review and approve or reject.'),

    ('PUR-12', 'purchasing', 'NEW_SUPPLIER', 'EVENT',
     'Complete new supplier onboarding',
     '👤 Complete supplier profile & agreements',
     'MEDIUM', 30, 2, None, 0, None,
     'New supplier registered. Complete: business registration docs, tax ID, '
     'payment terms, delivery terms, return policy. Set up supplier price list.'),

    ('PUR-13', 'purchasing', 'DELIVERY_COMPLETED', 'EVENT',
     'Process completed delivery',
     '✅ Process delivery: verify, shelve, update records',
     'HIGH', 30, 2, None, 0, None,
     'Delivery completed. Verify all items against delivery note, update inventory '
     'records, shelve products, notify finance for payment processing.'),

    ('PUR-14', 'purchasing', 'CUSTOM', 'RECURRING',
     'Weekly supplier performance review',
     '📊 Review supplier delivery performance',
     'LOW', 30, 1, 'WEEKLY', 0, None,
     'Weekly review of supplier KPIs: on-time delivery rate, quality rejection '
     'rate, price competitiveness. Flag underperforming suppliers.'),

    ('PUR-15', 'purchasing', 'CUSTOM', 'RECURRING',
     'Reorder point planning',
     '📋 Review & update reorder points',
     'MEDIUM', 60, 2, 'MONTHLY', 0, None,
     'Monthly review of reorder points based on sales velocity, lead times, '
     'and seasonal trends. Adjust minimum stock levels accordingly.'),

    # =========================================================================
    # 💰 FINANCE MODULE (20 rules)
    # =========================================================================

    ('FIN-01', 'finance', 'CREDIT_SALE', 'EVENT',
     'Follow up on credit sale',
     '💳 Follow up: credit sale collection',
     'HIGH', 15, 2, None, 0, None,
     'A sale was processed on credit. Follow up with the client for payment. '
     'Check credit limit, payment history, and outstanding balance.'),

    ('FIN-02', 'finance', 'HIGH_VALUE_SALE', 'EVENT',
     'Manager review: high-value transaction',
     '💰 Manager review: high-value sale',
     'HIGH', 10, 2, None, 0, None,
     'Sale exceeded the high-value threshold. Manager must review: verify '
     'customer identity, confirm pricing, check discount authorization.'),

    ('FIN-03', 'finance', 'OVERDUE_INVOICE', 'RECURRING',
     'Follow up on overdue invoices',
     '⏰ Contact client: invoice overdue',
     'HIGH', 15, 2, 'DAILY', 0, None,
     'Daily scan for invoices past due date. Contact client via phone/email. '
     'Escalate after 7 days (2nd reminder), 15 days (warning), 30 days (legal).'),

    ('FIN-04', 'finance', 'PAYMENT_DUE_SUPPLIER', 'EVENT',
     'Prepare supplier payment',
     '💵 Prepare payment to supplier',
     'HIGH', 20, 2, None, 0, None,
     'Supplier payment is due. Verify invoice against PO and goods received. '
     'Prepare payment voucher, get approval, process payment.'),

    ('FIN-05', 'finance', 'RECEIPT_VOUCHER', 'EVENT',
     'Post receipt voucher to ledger',
     '📖 Post receipt to general ledger',
     'HIGH', 10, 1, None, 0, None,
     'Receipt voucher arrived. Create journal entry, post to appropriate GL '
     'accounts (debit goods, credit supplier). Verify tax calculations.'),

    ('FIN-06', 'finance', 'POS_RETURN', 'EVENT',
     'Review return/refund justification',
     '↩️ Review return: verify justification & approval',
     'MEDIUM', 15, 1, None, 0, None,
     'A POS return/refund was processed. Review: was it authorized? Does the '
     'reason match policy? Check for patterns (frequent returns = possible abuse).'),

    ('FIN-07', 'finance', 'CASHIER_DISCOUNT', 'EVENT',
     'Review cashier-applied discount',
     '🏷 Review discount: verify authorization',
     'MEDIUM', 10, 1, None, 0, None,
     'Cashier applied a discount on POS. Verify: was it within their authority? '
     'Does it match an active promotion? Flag unauthorized discounts.'),

    ('FIN-08', 'finance', 'DAILY_SUMMARY', 'RECURRING',
     'End-of-day financial summary',
     '📊 Generate & review daily financial summary',
     'HIGH', 20, 2, 'DAILY', 0, None,
     'End of business day. Generate daily sales summary, cash reconciliation, '
     'credit sales report, returns report. Verify cash count matches system.'),

    ('FIN-09', 'finance', 'BANK_STATEMENT', 'EVENT',
     'Reconcile bank statement',
     '🏦 Reconcile bank statement with ledger',
     'HIGH', 45, 3, None, 0, None,
     'New bank statement received. Match each bank transaction to a ledger entry. '
     'Identify unmatched items: outstanding checks, deposits in transit, errors.'),

    ('FIN-10', 'finance', 'MONTH_END', 'RECURRING',
     'Month-end close procedure',
     '📅 Month-end close: validate & finalize entries',
     'URGENT', 120, 5, 'MONTHLY', 0, None,
     'Month-end close: review all journal entries, perform accruals, verify '
     'outstanding items, generate trial balance, close the period.'),

    ('FIN-11', 'finance', 'LATE_PAYMENT', 'EVENT',
     'Escalate late payment',
     '🔴 Late payment detected — escalate collection',
     'HIGH', 15, 2, None, 0, None,
     'Payment is past the grace period. Escalate: formal reminder letter, '
     'consider suspension of credit terms, involve management.'),

    ('FIN-12', 'finance', 'NEW_INVOICE', 'EVENT',
     'Process incoming invoice',
     '🧾 Process incoming invoice',
     'MEDIUM', 15, 1, None, 0, None,
     'New invoice received. Match to PO and delivery note. Verify: quantities, '
     'prices, tax calculations, payment terms. Post to accounts payable.'),

    ('FIN-13', 'finance', 'CUSTOM', 'RECURRING',
     'Weekly cash flow review',
     '💸 Weekly cash flow forecast & review',
     'MEDIUM', 30, 2, 'WEEKLY', 0, None,
     'Review upcoming payables vs receivables. Forecast cash position for '
     'next 2 weeks. Flag potential shortfalls. Prioritize payments.'),

    ('FIN-14', 'finance', 'CUSTOM', 'RECURRING',
     'Quarterly tax preparation',
     '📋 Quarterly tax filing preparation',
     'HIGH', 120, 5, 'QUARTERLY', 0, None,
     'Prepare quarterly tax return: compile sales, purchases, VAT collected, '
     'VAT paid, withholdings. Verify against GL. Prepare filing documents.'),

    ('FIN-15', 'finance', 'CUSTOM', 'RECURRING',
     'Fixed asset depreciation',
     '🏢 Process monthly depreciation entries',
     'MEDIUM', 30, 2, 'MONTHLY', 0, None,
     'Calculate and post monthly depreciation for all fixed assets per their '
     'amortization schedules. Verify accumulated depreciation balances.'),

    # =========================================================================
    # 👥 CRM MODULE (12 rules)
    # =========================================================================

    ('CRM-01', 'crm', 'CLIENT_FOLLOWUP_DUE', 'RECURRING',
     'Client follow-up: strategy schedule',
     '📞 Client follow-up per strategy',
     'MEDIUM', 15, 1, 'DAILY', 0, None,
     'Daily check for clients whose follow-up strategy is due. Contact per '
     'the defined strategy: call, visit, email, or special offer.'),

    ('CRM-02', 'crm', 'SUPPLIER_FOLLOWUP_DUE', 'RECURRING',
     'Supplier follow-up: check orders & terms',
     '📞 Supplier follow-up: orders & pricing',
     'MEDIUM', 15, 1, 'WEEKLY', 0, None,
     'Weekly supplier follow-up: check pending orders, negotiate terms, '
     'review pricing agreements, discuss new products.'),

    ('CRM-03', 'crm', 'NEW_CLIENT', 'EVENT',
     'Welcome new client',
     '🤝 New client onboarding: welcome & profile setup',
     'MEDIUM', 20, 2, None, 0, None,
     'New client registered. Complete: welcome call/email, verify contact info, '
     'set up payment terms, assign credit limit, add to loyalty program.'),

    ('CRM-04', 'crm', 'CLIENT_INACTIVE', 'RECURRING',
     'Re-engage inactive clients',
     '📢 Re-engagement: client inactive > 30 days',
     'LOW', 15, 1, 'WEEKLY', 30, None,
     'Weekly scan for clients with no purchases in 30+ days. Send re-engagement '
     'offer, check if they switched to competitor, update CRM notes.'),

    ('CRM-05', 'crm', 'CLIENT_COMPLAINT', 'EVENT',
     'Respond to client complaint',
     '🔴 Respond to client complaint within 24h',
     'URGENT', 30, 3, None, 0, None,
     'Client filed a complaint. RESPOND WITHIN 24 HOURS. Investigate issue, '
     'contact client, offer resolution. Document in CRM.'),

    ('CRM-06', 'crm', 'ADDRESS_BOOK_VERIFY', 'RECURRING',
     'Daily address book verification',
     '📒 Verify & update contact information',
     'LOW', 30, 1, 'DAILY', 0, None,
     'Daily verification of contact records: check for incomplete profiles, '
     'outdated phone numbers, missing emails. Update from yesterday\'s interactions.'),

    ('CRM-07', 'crm', 'CUSTOM', 'RECURRING',
     'Monthly VIP client review',
     '⭐ Review VIP clients: satisfaction & retention',
     'MEDIUM', 45, 3, 'MONTHLY', 0, None,
     'Monthly review of top 20 clients by revenue. Check: purchase frequency, '
     'credit status, complaints, loyalty points. Schedule personal visits.'),

    ('CRM-08', 'crm', 'CUSTOM', 'RECURRING',
     'Quarterly client segmentation update',
     '📊 Update client segments & pricing tiers',
     'LOW', 60, 2, 'QUARTERLY', 0, None,
     'Quarterly review of client segments based on purchase volume, payment '
     'reliability, and growth trend. Update pricing tiers accordingly.'),

    # =========================================================================
    # 📋 SALES / POS MODULE (12 rules)
    # =========================================================================

    ('POS-01', 'sales', 'ORDER_COMPLETED', 'EVENT',
     'Post-sale verification check',
     '✅ Verify completed order: accuracy & accounting',
     'LOW', 5, 1, None, 0, None,
     'After order completes, verify: all items match receipt, payment method '
     'posted correctly, inventory decremented, journal entries balanced.'),

    ('POS-02', 'sales', 'NEGATIVE_STOCK', 'EVENT',
     'Investigate & replenish negative stock',
     '🔴 Negative stock sale: investigate immediately',
     'URGENT', 30, 3, None, 0, None,
     'A sale caused negative stock. This should not happen. Check: is physical '
     'stock actually available? Was there a counting error? Adjust if needed.'),

    ('POS-03', 'sales', 'CUSTOM', 'RECURRING',
     'Daily register close verification',
     '🏪 Verify all registers closed correctly',
     'HIGH', 15, 2, 'DAILY', 0, None,
     'End of day: verify all register sessions are closed, cash counts match, '
     'any discrepancies documented with explanation.'),

    ('POS-04', 'sales', 'CUSTOM', 'RECURRING',
     'Daily discount review',
     '🏷 Review all discounts applied today',
     'MEDIUM', 20, 1, 'DAILY', 0, None,
     'Daily review of all discounts: authorized vs unauthorized, total discount '
     'amount, discounts by cashier. Flag anomalies for investigation.'),

    ('POS-05', 'sales', 'CUSTOM', 'RECURRING',
     'Weekly sales performance analysis',
     '📈 Analyze weekly sales: trends, targets, gaps',
     'MEDIUM', 30, 2, 'WEEKLY', 0, None,
     'Weekly sales analysis: compare to target, identify top/bottom products, '
     'review margins, check promotion effectiveness.'),

    ('POS-06', 'sales', 'HIGH_VALUE_SALE', 'EVENT',
     'High-value sale: customer satisfaction follow-up',
     '⭐ Follow up on high-value customer',
     'MEDIUM', 10, 1, None, 0, None,
     'High-value sale completed. Follow up with customer: thank you call, '
     'request feedback, check product satisfaction, offer loyalty benefits.'),

    ('POS-07', 'sales', 'CUSTOM', 'RECURRING',
     'Quotation expiry check',
     '📝 Follow up on expiring quotations',
     'MEDIUM', 20, 1, 'DAILY', 7, None,
     'Daily check for quotations expiring within 7 days. Contact client to '
     'confirm or renew. Convert accepted quotations to orders.'),

    ('POS-08', 'sales', 'POS_RETURN', 'EVENT',
     'Restock returned items',
     '📦 Restock returned products to shelf',
     'MEDIUM', 15, 1, None, 0, None,
     'A POS return was processed. Inspect returned items: resalable? Return to '
     'shelf. Damaged? Move to quarantine. Update inventory accordingly.'),

    # =========================================================================
    # 👤 HR / SYSTEM MODULE (13 rules)
    # =========================================================================

    ('SYS-01', 'system', 'USER_REGISTRATION', 'EVENT',
     'Approve new user registration',
     '👤 Review & approve new user account',
     'HIGH', 10, 1, None, 0, None,
     'New user registration pending. Review: verify identity, confirm role, '
     'assign permissions, set password policy. Approve or reject.'),

    ('SYS-02', 'system', 'REPORT_NEEDS_REVIEW', 'EVENT',
     'Review flagged report',
     '📝 Review generated report — approval required',
     'MEDIUM', 15, 1, None, 0, None,
     'A report was generated with a review flag. Review content for accuracy, '
     'approve for distribution, or send back for corrections.'),

    ('SYS-03', 'system', 'ORDER_STALE', 'RECURRING',
     'Reminder: untreated orders',
     '⏰ Orders not treated after threshold days',
     'HIGH', 10, 1, 'DAILY', 3, None,
     'Daily scan for any order (sales, purchase, transfer) sitting in draft or '
     'submitted status beyond threshold. Notify responsible user.'),

    ('SYS-04', 'system', 'APPROVAL_PENDING', 'RECURRING',
     'Reminder: pending approvals',
     '⏰ Approvals pending beyond threshold',
     'HIGH', 10, 1, 'DAILY', 2, None,
     'Daily scan for items awaiting approval beyond threshold: POs, returns, '
     'adjustments, requests. Escalate to manager if needed.'),

    ('HR-01', 'hr', 'EMPLOYEE_ONBOARD', 'EVENT',
     'New employee onboarding',
     '🆕 Complete new employee onboarding checklist',
     'HIGH', 60, 3, None, 0, None,
     'New employee joined. Complete: system access setup, role assignment, '
     'training schedule, policy briefing, equipment distribution, buddy assignment.'),

    ('HR-02', 'hr', 'LEAVE_REQUEST', 'EVENT',
     'Review leave request',
     '📅 Review & approve/reject leave request',
     'MEDIUM', 5, 1, None, 0, None,
     'Employee submitted a leave request. Check: coverage available, no overlap '
     'with critical dates, remaining balance. Approve or discuss alternatives.'),

    ('HR-03', 'hr', 'ATTENDANCE_ANOMALY', 'RECURRING',
     'Investigate attendance anomaly',
     '🔍 Review attendance anomalies',
     'MEDIUM', 15, 1, 'DAILY', 0, None,
     'Daily scan for attendance issues: unexplained absences, repeated late '
     'arrivals, early departures. Follow up with employee/supervisor.'),

    ('HR-04', 'hr', 'CUSTOM', 'RECURRING',
     'Monthly payroll preparation',
     '💵 Prepare monthly payroll',
     'URGENT', 120, 5, 'MONTHLY', 0, None,
     'Monthly payroll: calculate earnings, deductions, overtime, bonuses. '
     'Verify attendance records, process tax withholdings, prepare payslips.'),

    ('HR-05', 'hr', 'CUSTOM', 'RECURRING',
     'Employee performance review due',
     '📋 Quarterly performance evaluation',
     'MEDIUM', 60, 3, 'QUARTERLY', 0, None,
     'Quarterly performance review: fill evaluation questionnaire, review KPIs, '
     'set goals for next quarter, discuss training needs.'),

    # ── Portal / Supplier ──
    ('SYS-05', 'system', 'CUSTOM', 'EVENT',
     'Review supplier portal proforma',
     '📑 Review supplier proforma from portal',
     'HIGH', 15, 2, None, 0, None,
     'A supplier submitted a proforma through the portal. Review pricing, '
     'quantities, delivery terms. Approve, negotiate, or reject.'),

    ('SYS-06', 'system', 'CUSTOM', 'EVENT',
     'Process supplier price change request',
     '💰 Review supplier price change request',
     'HIGH', 15, 2, None, 0, None,
     'A supplier requested a price change through the portal. Compare with '
     'market prices, impact on margins. Accept, counter-propose, or reject.'),

    ('SYS-07', 'system', 'CUSTOM', 'EVENT',
     'Client ticket received',
     '🎫 Respond to client support ticket',
     'HIGH', 20, 2, None, 0, None,
     'A client submitted a support ticket through the portal. Respond within '
     'SLA (24h). Investigate, resolve, and update ticket status.'),

    ('SYS-08', 'system', 'CUSTOM', 'RECURRING',
     'Weekly system health check',
     '🖥 System health: backup, storage, errors review',
     'LOW', 30, 1, 'WEEKLY', 0, None,
     'Weekly system audit: check backup status, storage usage, error logs, '
     'API response times, pending migrations. Document any issues.'),
]


# ─────────────────────────────────────────────────────────────────────────────
# SEED FUNCTION
# ─────────────────────────────────────────────────────────────────────────────

def seed_auto_tasks(organization):
    """
    Seed all 80+ auto-task rules for an organization.
    Skips rules that already exist (by code).
    Returns (created_count, skipped_count).
    """
    from apps.workspace.models import AutoTaskRule, TaskTemplate, TaskCategory

    created = 0
    skipped = 0

    # Pre-create module categories if they don't exist
    category_map = {}
    module_categories = {
        'inventory':  ('Inventory', '#22c55e', 'Package'),
        'purchasing': ('Purchasing', '#3b82f6', 'ShoppingCart'),
        'finance':    ('Finance', '#f59e0b', 'DollarSign'),
        'crm':        ('CRM', '#8b5cf6', 'Users'),
        'sales':      ('Sales', '#f43f5e', 'Briefcase'),
        'hr':         ('HR', '#06b6d4', 'UserCheck'),
        'system':     ('System', '#6b7280', 'Settings'),
    }
    for mod_key, (name, color, icon) in module_categories.items():
        cat, _ = TaskCategory.objects.get_or_create(
            organization=organization,
            name=name,
            defaults={'color': color, 'icon': icon, 'is_active': True}
        )
        category_map[mod_key] = cat

    # Build lookups for chain parents (by code)
    chain_parent_map = {}  # code → AutoTaskRule

    for entry in AUTO_TASK_CATALOG:
        (code, module, trigger_event, rule_type, name, task_title,
         priority, estimated_minutes, default_points,
         recurrence_interval, stale_threshold_days, chain_parent_code,
         description) = entry

        # Skip if already exists for this org
        if AutoTaskRule.objects.filter(organization=organization, code=code).exists():
            skipped += 1
            continue

        # Create template
        tmpl = TaskTemplate.objects.create(
            organization=organization,
            name=task_title,
            default_priority=priority,
            estimated_minutes=estimated_minutes,
            default_points=default_points,
            is_recurring=(rule_type == 'RECURRING'),
            recurrence_rule=recurrence_interval,
            is_active=True,
        )

        # Resolve chain parent
        chain_parent = chain_parent_map.get(chain_parent_code) if chain_parent_code else None

        # Create rule
        rule = AutoTaskRule.objects.create(
            organization=organization,
            code=code,
            module=module,
            trigger_event=trigger_event,
            rule_type=rule_type,
            name=name,
            template=tmpl,
            conditions={},
            priority=priority,
            recurrence_interval=recurrence_interval if rule_type == 'RECURRING' else None,
            stale_threshold_days=stale_threshold_days,
            chain_parent=chain_parent,
            is_active=True,
            is_system_default=True,
        )

        chain_parent_map[code] = rule
        created += 1

    logger.info(f"Auto-task seed: {created} created, {skipped} skipped for {organization}")
    return created, skipped
