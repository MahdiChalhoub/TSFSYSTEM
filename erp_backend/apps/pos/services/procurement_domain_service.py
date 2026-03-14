"""
ProcurementDomainService — Unified Procurement Core
=====================================================
Central orchestration layer that unifies quick purchases and formal POs
under one procurement backbone. Both workflows share:
  - Tax context resolution
  - Posting rules resolution
  - Inventory updates
  - Event emission
  - Audit trail

Architecture:
  - Quick purchase = shortcut policy (immediate receipt + posting)
  - Formal PO = governed policy (13-state lifecycle with approval chain)

This service delegates to specialized sub-services:
  - PurchaseService (legacy, for quick_purchase internals — being migrated)
  - GoodsReceiptService (apps/inventory)
  - ThreeWayMatchService (existing, being hardened)
  - ReturnsService (existing)
  - LedgerService (apps/finance)
  - StockService (apps/inventory)
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


from erp.connector_registry import connector


class ProcurementDomainService:
    """
    Unified procurement core — orchestrates all procurement operations
    regardless of whether the source is a quick purchase or formal PO.
    """

    # ─── DOCUMENT CREATION ──────────────────────────────────────────────

    @staticmethod
    def create_document(organization, mode, user=None, **kwargs):
        """
        Create a procurement document.

        Args:
            mode: 'QUICK' | 'FORMAL'
            QUICK → delegates to PurchaseService.quick_purchase() (immediate)
            FORMAL → creates PurchaseOrder in DRAFT status
        """
        if mode == 'QUICK':
            return ProcurementDomainService._create_quick(organization, user, **kwargs)
        elif mode == 'FORMAL':
            return ProcurementDomainService._create_formal(organization, user, **kwargs)
        else:
            raise ValidationError(f"Unknown procurement mode: {mode}")

    @staticmethod
    def _create_quick(organization, user, **kwargs):
        """Quick purchase — immediate receipt + posting in one atomic op."""
        from apps.pos.services.purchase_service import PurchaseService
        return PurchaseService.quick_purchase(
            organization=organization,
            supplier_id=kwargs['supplier_id'],
            warehouse_id=kwargs['warehouse_id'],
            site_id=kwargs['site_id'],
            scope=kwargs.get('scope', 'OFFICIAL'),
            invoice_price_type=kwargs.get('invoice_price_type', 'HT'),
            vat_recoverable=kwargs.get('vat_recoverable', True),
            lines=kwargs['lines'],
            notes=kwargs.get('notes'),
            ref_code=kwargs.get('ref_code'),
            user=user,
            **{k: v for k, v in kwargs.items() if k not in [
                'supplier_id', 'warehouse_id', 'site_id', 'scope',
                'invoice_price_type', 'vat_recoverable', 'lines',
                'notes', 'ref_code'
            ]}
        )

    @staticmethod
    def _create_formal(organization, user, **kwargs):
        """Formal PO — creates draft with lines."""
        from apps.pos.models import PurchaseOrder, PurchaseOrderLine

        with transaction.atomic():
            lines_data = kwargs.pop('lines', [])

            po = PurchaseOrder(
                organization=organization,
                supplier_id=kwargs.get('supplier'),
                supplier_name=kwargs.get('supplier_name', ''),
                site_id=kwargs.get('site') or None,
                warehouse_id=kwargs.get('warehouse') or None,
                status='DRAFT',
                priority=kwargs.get('priority', 'NORMAL'),
                purchase_sub_type=kwargs.get('purchase_sub_type', 'STANDARD'),
                supplier_ref=kwargs.get('supplier_ref', ''),
                expected_date=kwargs.get('expected_date') or None,
                currency=kwargs.get('currency', 'XOF'),
                shipping_cost=Decimal(str(kwargs.get('shipping_cost', 0))),
                discount_amount=Decimal(str(kwargs.get('discount_amount', 0))),
                notes=kwargs.get('notes', ''),
                internal_notes=kwargs.get('internal_notes', ''),
                invoice_policy=kwargs.get('invoice_policy', 'RECEIVED_QTY'),
                payment_term_id=kwargs.get('payment_term') or None,
                assigned_driver_id=kwargs.get('assigned_driver') or None,
                created_by=user,
            )
            po.save()

            for idx, line_data in enumerate(lines_data):
                PurchaseOrderLine.objects.create(
                    organization=organization,
                    order=po,
                    product_id=line_data.get('product') or line_data.get('product_id'),
                    quantity=Decimal(str(line_data.get('quantity', 1))),
                    unit_price=Decimal(str(line_data.get('unit_price', 0))),
                    tax_rate=Decimal(str(line_data.get('tax_rate', 0))),
                    discount_percent=Decimal(str(line_data.get('discount_percent', 0))),
                    sort_order=idx,
                )

            po.recalculate_totals()
            return po

    # ─── STATUS TRANSITIONS ─────────────────────────────────────────────

    @staticmethod
    def update_status(organization, po_id, new_status, user=None, reason=None):
        """
        Unified status transition with validation, approval check, and event emission.
        """
        from apps.pos.models import PurchaseOrder

        with transaction.atomic():
            po = PurchaseOrder.objects.select_for_update().get(
                id=po_id, organization=organization
            )

            old_status = po.status

            # Validate transition
            po.transition_to(new_status, user=user, reason=reason)

            # Execute side effects based on transition
            ProcurementDomainService._execute_transition_side_effects(
                po, old_status, new_status, user, reason
            )

            return po

    @staticmethod
    def _execute_transition_side_effects(po, old_status, new_status, user, reason):
        """
        Side-effects matrix — executes business logic for each transition.

        Transition Side-Effects Table:
        ─────────────────────────────────────────────────────────────────────
        DRAFT → SUBMITTED       | PO# assigned, lines frozen, PURCHASE_ENTERED event
        SUBMITTED → APPROVED    | Approval audit, budget commitment, PO_APPROVED event
        APPROVED → SENT         | order_date set, supplier/prices frozen, PO_SENT event
        SENT → CONFIRMED        | Supplier acknowledgment recorded
        CONFIRMED → IN_TRANSIT  | dispatched_at set, tracking info expected
        * → PARTIALLY_RECEIVED  | GRN created, stock updated, accrual posted
        * → RECEIVED            | Final stock, DELIVERY_COMPLETED event
        RECEIVED → INVOICED     | Invoice + 3-way match, AP recognized
        INVOICED → COMPLETED    | Hard lock, final analytics
        * → CANCELLED           | Release budget, cancel pending, PO_CANCELLED event
        """
        events_to_emit = []

        # ── SUBMITTED ───────────────────────────────────────────────────
        if new_status == 'SUBMITTED':
            events_to_emit.append(('PURCHASE_ENTERED', {
                'po_number': po.po_number,
                'amount': float(po.total_amount or 0),
                'site_id': po.site_id,
                'supplier': str(po.supplier_name),
            }))

        # ── APPROVED ────────────────────────────────────────────────────
        elif new_status == 'APPROVED':
            # Budget commitment (if budget system active)
            ProcurementDomainService._try_commit_budget(po)

            events_to_emit.append(('PO_APPROVED', {
                'po_number': po.po_number,
                'amount': float(po.total_amount or 0),
            }))

        # ── SENT ────────────────────────────────────────────────────────
        elif new_status == 'SENT':
            if not po.order_date:
                po.order_date = timezone.now()
                po.save(update_fields=['order_date'])

        # ── RECEIVED ────────────────────────────────────────────────────
        elif new_status == 'RECEIVED':
            events_to_emit.append(('DELIVERY_COMPLETED', {
                'po_number': po.po_number,
                'amount': float(po.total_amount or 0),
            }))
            # Check if invoice is attached
            if not po.invoice:
                events_to_emit.append(('PURCHASE_NO_ATTACHMENT', {
                    'po_number': po.po_number,
                }))

            # ── WISE: Score buyer on procurement timeliness ──────────────
            try:
                from kernel.events import emit_event
                now = timezone.now()
                is_on_time = (
                    po.expected_date is None
                    or now.date() <= po.expected_date
                )
                event_name = 'procurement.po.on_time' if is_on_time else 'procurement.po.late'
                emit_event(event_name, {
                    'po_id':          po.id,
                    'po_number':      po.po_number,
                    'buyer_user_id':  po.created_by_id,
                    'expected_date':  po.expected_date.isoformat() if po.expected_date else None,
                    'received_date':  now.date().isoformat(),
                    'is_on_time':     is_on_time,
                    'supplier':       str(po.supplier_name),
                    'organization_id':      po.organization_id,
                }, aggregate_type='purchase_order', aggregate_id=po.id)
            except Exception:
                pass  # WISE scoring must never block the transition

        # ── CANCELLED ───────────────────────────────────────────────────
        elif new_status == 'CANCELLED':
            ProcurementDomainService._try_release_budget(po)
            events_to_emit.append(('PO_CANCELLED', {
                'po_number': po.po_number,
                'reason': reason or '',
            }))

        # Emit all events (fire-and-forget)
        for event_type, context in events_to_emit:
            ProcurementDomainService.emit_events(
                po.organization, event_type, **context
            )

    # ─── RECEIVING (via GoodsReceipt) ────────────────────────────────────

    @staticmethod
    def receive(organization, po_id, lines, warehouse_id, user=None, **kwargs):
        """
        Unified receiving — creates a GoodsReceipt document linked to the PO.

        This replaces the old PO-line-centric receiving with proper GRN documents:
        - Creates GoodsReceipt(mode='PO_BASED')
        - Creates GoodsReceiptLine per product
        - Updates PurchaseOrderLine.qty_received
        - Calls StockService for inventory updates
        - Posts accrual entry (DR Inventory, CR GRNI)
        - Checks receipt completeness → auto-transitions PO status
        """
        from apps.pos.models import PurchaseOrder, PurchaseOrderLine

        GoodsReceipt = connector.require('inventory.goods_receipt.get_model', org_id=0, source='pos')
        GoodsReceiptLine = connector.require('inventory.goods_receipt.get_line_model', org_id=0, source='pos')

        if not GoodsReceipt or not GoodsReceiptLine:
            raise ValidationError("GoodsReceipt models not available. Check inventory module.")

        with transaction.atomic():
            po = PurchaseOrder.objects.select_for_update().get(
                id=po_id, organization=organization
            )

            if po.status not in ('SENT', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'):
                raise ValidationError(
                    f"PO status '{po.status}' is not eligible for receiving. "
                    f"Expected: SENT, CONFIRMED, IN_TRANSIT, or PARTIALLY_RECEIVED."
                )

            Warehouse = connector.require('inventory.warehouses.get_model', org_id=0, source='pos')
            if not Warehouse:
                raise ValidationError("Inventory module is required for receiving.")
            warehouse = Warehouse.objects.get(id=warehouse_id, organization=organization)

            # Create GoodsReceipt header
            grn = GoodsReceipt(
                organization=organization,
                mode='PO_BASED',
                status='IN_PROGRESS',
                purchase_order=po,
                warehouse=warehouse,
                supplier=po.supplier,
                supplier_ref=kwargs.get('supplier_delivery_ref', ''),
                received_by=user,
                notes=kwargs.get('notes', ''),
            )
            grn.save()

            total_received_value = Decimal('0')
            events_to_emit = []

            for line_data in lines:
                po_line = PurchaseOrderLine.objects.select_for_update().get(
                    id=line_data['line_id'], order=po
                )

                qty_received = Decimal(str(line_data.get('quantity', 0)))
                qty_damaged = Decimal(str(line_data.get('qty_damaged', 0)))
                qty_rejected = Decimal(str(line_data.get('qty_rejected', 0)))
                qty_missing = Decimal(str(line_data.get('qty_missing', 0)))

                if qty_received <= 0 and qty_damaged <= 0 and qty_rejected <= 0:
                    continue

                # Tolerance check
                from erp.services import ConfigurationService as settings_service
                tolerance = Decimal('0.05')  # default 5%
                if settings_service:
                    try:
                        global_settings = settings_service.get_global_settings(organization)
                        tolerance = Decimal(str(
                            global_settings.get('po_over_receipt_tolerance', 5)
                        )) / 100
                    except Exception:
                        pass

                total_arrived = po_line.qty_received + qty_received + qty_damaged + qty_rejected
                max_allowed = po_line.quantity * (1 + tolerance)
                if total_arrived > max_allowed:
                    raise ValidationError(
                        f"Over-receipt for {po_line.product}: "
                        f"total {total_arrived} exceeds max allowed {max_allowed} "
                        f"(tolerance: {tolerance * 100}%)"
                    )

                # Create GRN line
                grn_line = GoodsReceiptLine(
                    organization=organization,
                    receipt=grn,
                    product=po_line.product,
                    po_line=po_line,
                    qty_ordered=po_line.quantity,
                    qty_received=qty_received,
                    qty_rejected=qty_rejected,
                    expiry_date=line_data.get('expiry_date'),
                    batch_number=line_data.get('batch_number'),
                    line_status='RECEIVED' if qty_received > 0 else 'REJECTED',
                    rejection_reason=line_data.get('rejection_reason', 'NOT_REJECTED'),
                    rejection_notes=line_data.get('receipt_notes'),
                )
                grn_line.save()

                # Update PO line quantities
                po_line.qty_received += qty_received
                po_line.qty_damaged += qty_damaged
                po_line.qty_rejected += qty_rejected
                po_line.qty_missing += qty_missing
                if line_data.get('receipt_notes'):
                    po_line.receipt_notes = (
                        f"{po_line.receipt_notes or ''}\n{line_data['receipt_notes']}"
                    ).strip()
                po_line.save()

                # Update inventory (accepted qty only)
                if qty_received > 0:
                    StockService = connector.require(
                        'inventory.services.get_stock_service', org_id=0, source='pos'
                    )
                    if StockService:
                        StockService.receive_stock(
                            organization=organization,
                            product=po_line.product,
                            warehouse=warehouse,
                            quantity=qty_received,
                            cost_price_ht=po_line.unit_price,
                            reference=f"GRN-{grn.receipt_number}",
                            scope=kwargs.get('scope', 'OFFICIAL'),
                        )
                    total_received_value += qty_received * po_line.unit_price

                # Check for barcode
                if not po_line.product.barcode:
                    events_to_emit.append(('BARCODE_MISSING_PURCHASE', {
                        'product_name': po_line.product.name,
                        'product_id': po_line.product_id,
                        'qty': float(qty_received),
                    }))

            # Finalize GRN
            grn.status = 'COMPLETED'
            grn.save()

            # Post accrual entry (DR Inventory, CR GRNI)
            if total_received_value > 0:
                ProcurementDomainService._post_receipt_accrual(
                    po, warehouse, total_received_value,
                    grn_ref=grn.receipt_number,
                    scope=kwargs.get('scope', 'OFFICIAL'),
                    user=user,
                )

            # Auto-update PO status
            po.check_receipt_completeness()

            # Emit events
            for event_type, context in events_to_emit:
                ProcurementDomainService.emit_events(
                    po.organization, event_type, **context
                )

            # If fully received, fire DELIVERY_COMPLETED
            if po.status == 'RECEIVED':
                ProcurementDomainService.emit_events(
                    po.organization, 'DELIVERY_COMPLETED',
                    po_number=po.po_number,
                    amount=float(po.total_amount or 0),
                )
                if not po.invoice:
                    ProcurementDomainService.emit_events(
                        po.organization, 'PURCHASE_NO_ATTACHMENT',
                        po_number=po.po_number,
                    )

            return grn

    # ─── INVOICING ──────────────────────────────────────────────────────

    @staticmethod
    def invoice(organization, po_id, invoice_data, user=None):
        """
        Unified invoicing — creates invoice, runs 3-way match, persists results.
        """
        from apps.pos.services.purchase_service import PurchaseService
        from apps.pos.services.three_way_match_service import ThreeWayMatchService
        from apps.pos.models.procurement_governance_models import (
            ThreeWayMatchResult, ThreeWayMatchLine
        )

        with transaction.atomic():
            # Delegate core invoice creation to existing service
            invoice = PurchaseService.invoice_po(
                organization=organization,
                order_id=po_id,
                invoice_number=invoice_data.get('invoice_number'),
                user=user,
            )

            # Persist 3-way match result
            from apps.pos.models import PurchaseOrder
            po = PurchaseOrder.objects.get(id=po_id, organization=organization)

            is_valid, violations = ThreeWayMatchService.validate_invoice(invoice)

            match_result = ThreeWayMatchResult.objects.create(
                organization=organization,
                purchase_order=po,
                invoice=invoice,
                status='MATCHED' if is_valid else 'DISPUTED',
                payment_blocked=not is_valid,
                violations=violations,
                matched_by=user,
                summary={
                    'is_valid': is_valid,
                    'violation_count': len(violations),
                },
            )

            # Persist per-line match data
            for line in po.lines.all():
                ThreeWayMatchLine.objects.create(
                    organization=organization,
                    match_result=match_result,
                    purchase_order_line=line,
                    product=line.product,
                    ordered_qty=line.quantity,
                    declared_qty=line.supplier_declared_qty,
                    received_qty=line.qty_received,
                    invoiced_qty=line.qty_invoiced,
                    ordered_unit_price=line.unit_price,
                    invoiced_unit_price=line.unit_price,  # TODO: use actual invoice line price
                    qty_variance=line.qty_received - line.quantity,
                    price_variance=Decimal('0'),  # TODO: compute from invoice
                    amount_variance=(line.qty_received - line.quantity) * line.unit_price,
                )

            return invoice, match_result

    # ─── POSTING ────────────────────────────────────────────────────────

    @staticmethod
    def post_to_ledger(organization, document_id, document_type, posting_context):
        """
        Unified posting rules resolution.
        All procurement posting flows through this method.
        """
        LedgerService = connector.require('finance.services.get_ledger_service', org_id=0, source='pos')
        from erp.services import ConfigurationService

        if not LedgerService or not ConfigurationService:
            raise ValidationError("Finance module not available for ledger posting.")

        rules = ConfigurationService.get_posting_rules(organization)
        return rules, LedgerService

    @staticmethod
    def _post_receipt_accrual(po, warehouse, total_value, grn_ref, scope, user):
        """Post receipt accrual entry: DR Inventory, CR GRNI (Reception Suspense)."""
        LedgerService = connector.require('finance.services.get_ledger_service', org_id=0, source='pos')
        from erp.services import ConfigurationService

        if not LedgerService or not ConfigurationService:
            logger.warning(f"Cannot post receipt accrual: Finance module unavailable")
            return

        rules = ConfigurationService.get_posting_rules(po.organization)
        inv_acc = rules.get('purchases', {}).get('inventory')
        susp_acc = rules.get('suspense', {}).get('reception')

        if not inv_acc or not susp_acc:
            logger.warning(
                f"Cannot post receipt accrual: "
                f"'purchases.inventory' or 'suspense.reception' not configured"
            )
            return

        LedgerService.create_journal_entry(
            organization=po.organization,
            transaction_date=timezone.now(),
            description=f"GRN Receipt: PO {po.po_number} | Warehouse: {warehouse.name}",
            reference=f"GRN-{grn_ref}",
            status='POSTED',
            scope=scope,
            site_id=warehouse.parent_id or warehouse.id,
            user=user,
            lines=[
                {
                    "account_id": inv_acc,
                    "debit": total_value,
                    "credit": Decimal('0'),
                    "description": "Inventory value increase (receipt accrual)"
                },
                {
                    "account_id": susp_acc,
                    "debit": Decimal('0'),
                    "credit": total_value,
                    "description": "Goods Received Not Invoiced (GRNI)"
                },
            ]
        )

    # ─── BUDGET CONTROL ─────────────────────────────────────────────────

    @staticmethod
    def check_budget(organization, po):
        """
        Check if a PO can be approved within available budget.
        Returns (is_ok, warnings: list[str]).
        """
        from apps.pos.models.procurement_governance_models import ProcurementBudget

        warnings = []
        today = timezone.now().date()

        # Find applicable budgets
        budgets = ProcurementBudget.objects.filter(
            organization=organization,
            is_active=True,
            period_start__lte=today,
            period_end__gte=today,
        )

        # Check site-specific budget
        if po.site_id:
            site_budgets = budgets.filter(site_id=po.site_id)
            for budget in site_budgets:
                remaining = budget.available_amount
                if po.total_amount and po.total_amount > remaining:
                    warnings.append(
                        f"PO exceeds '{budget.name}' budget by "
                        f"{po.total_amount - remaining:,.0f} "
                        f"(available: {remaining:,.0f}, PO: {po.total_amount:,.0f})"
                    )
                elif budget.is_over_warning:
                    warnings.append(
                        f"Budget '{budget.name}' at {budget.utilization_pct}% utilization"
                    )

        is_ok = len([w for w in warnings if 'exceeds' in w]) == 0
        return is_ok, warnings

    @staticmethod
    def _try_commit_budget(po):
        """Attempt to create a budget commitment on PO approval."""
        try:
            from apps.pos.models.procurement_governance_models import (
                ProcurementBudget, BudgetCommitment
            )
            today = timezone.now().date()
            budgets = ProcurementBudget.objects.filter(
                organization=po.organization,
                is_active=True,
                period_start__lte=today,
                period_end__gte=today,
            )
            if po.site_id:
                budgets = budgets.filter(
                    models.Q(site_id=po.site_id) | models.Q(site__isnull=True)
                )

            for budget in budgets:
                if po.total_amount:
                    BudgetCommitment.objects.create(
                        organization=po.organization,
                        purchase_order=po,
                        budget=budget,
                        committed_amount=po.total_amount,
                    )
                    budget.committed_amount += po.total_amount
                    budget.save(update_fields=['committed_amount'])
                    break  # commit to first matching budget
        except Exception as e:
            logger.warning(f"Budget commitment skipped for PO {po.id}: {e}")

    @staticmethod
    def _try_release_budget(po):
        """Release budget commitment on PO cancellation."""
        try:
            from apps.pos.models.procurement_governance_models import BudgetCommitment
            commitments = BudgetCommitment.objects.filter(
                purchase_order=po, released_at__isnull=True
            )
            for commitment in commitments:
                commitment.released_amount = commitment.committed_amount
                commitment.released_at = timezone.now()
                commitment.save()

                budget = commitment.budget
                budget.committed_amount -= commitment.net_commitment
                budget.save(update_fields=['committed_amount'])
        except Exception as e:
            logger.warning(f"Budget release skipped for PO {po.id}: {e}")

    # ─── APPROVAL ENGINE ────────────────────────────────────────────────

    @staticmethod
    def resolve_approval_policy(organization, po):
        """
        Determine which approval policy applies to this PO.
        Uses the kernel ApprovalPolicy + ApprovalPolicyStep system.
        Falls back to single-level approval if no policy configured.

        Returns: (required_levels: int, policy: ApprovalPolicy | None)
        """
        try:
            from kernel.lifecycle.models import ApprovalPolicy, ApprovalPolicyStep

            policy = ApprovalPolicy.objects.filter(
                organization=organization,
                txn_type='PURCHASE_ORDER',
            ).first()

            if not policy:
                # Fallback: check legacy TransactionVerificationPolicy
                from erp.models import TransactionVerificationPolicy, ApprovalRule
                legacy = TransactionVerificationPolicy.objects.filter(
                    organization=organization,
                    transaction_type__code='PURCHASE_ORDER',
                    is_active=True,
                ).first()

                if legacy and legacy.mode == 'RULED':
                    # Evaluate rules
                    rules = ApprovalRule.objects.filter(
                        policy=legacy, is_active=True
                    ).order_by('-priority')
                    for rule in rules:
                        if ProcurementDomainService._evaluate_rule(rule, po):
                            return rule.required_levels, None

                if legacy:
                    return legacy.get_required_levels(
                        amount=float(po.total_amount or 0)
                    ), None

                return 1, None  # Default: single approval

            required = policy.min_level_required
            steps = ApprovalPolicyStep.objects.filter(policy=policy).order_by('level')
            return max(required, steps.count()), policy

        except Exception as e:
            logger.warning(f"Approval policy resolution failed: {e}")
            return 1, None

    @staticmethod
    def _evaluate_rule(rule, po):
        """Evaluate a JSON-condition ApprovalRule against a PO."""
        conditions = rule.conditions or {}
        for key, value in conditions.items():
            if key == 'amount__gt':
                if not (po.total_amount and po.total_amount > Decimal(str(value))):
                    return False
            elif key == 'amount__lt':
                if not (po.total_amount and po.total_amount < Decimal(str(value))):
                    return False
            elif key == 'priority':
                if po.priority != value:
                    return False
            elif key == 'purchase_sub_type':
                if po.purchase_sub_type != value:
                    return False
        return True

    # ─── EVENT EMISSION ─────────────────────────────────────────────────

    @staticmethod
    def emit_events(organization, event_type, **context):
        """
        Unified event emission — workspace tasks, notifications, audit trail.
        Fire-and-forget: never blocks the procurement operation.
        """
        try:
            trigger = connector.require('workspace.events.trigger_purchasing', org_id=0, source='pos')
            if trigger:
                trigger(
                    org_id=organization.id, organization=organization, event=event_type,
                    **context,
                )
        except Exception as e:
            logger.warning(f"Event emission failed (non-blocking): {event_type} — {e}")

    # ─── VENDOR PERFORMANCE ─────────────────────────────────────────────

    @staticmethod
    def compute_supplier_score(organization, supplier_id, period_start, period_end):
        """
        Compute weighted vendor performance score.

        Formula:
            Score = 30% OTD + 20% fill_rate + 15% (100 - damage_rate)
                  + 10% (100 - rejection_rate) + 10% lead_time_score
                  + 10% price_competitiveness + 5% (100 - dispute_rate)
        """
        from apps.pos.models import PurchaseOrder, PurchaseOrderLine
        from apps.pos.models.procurement_governance_models import (
            SupplierPerformanceSnapshot, DisputeCase
        )
        from django.db.models import Sum, Count
        from django.db.models.functions import Coalesce

        pos = PurchaseOrder.objects.filter(
            organization=organization,
            supplier_id=supplier_id,
            created_at__date__gte=period_start,
            created_at__date__lte=period_end,
        ).exclude(status='CANCELLED')

        total_pos = pos.count()
        if total_pos == 0:
            return None

        # Single aggregate for total PO value
        total_po_value = pos.aggregate(
            total=Coalesce(Sum('total_amount'), Decimal('0'))
        )['total']

        # On-time delivery rate
        on_time = pos.filter(
            status__in=['RECEIVED', 'INVOICED', 'COMPLETED'],
        ).filter(
            received_date__lte=models.F('expected_date')
        ).count()
        on_time_delivery_rate = (on_time / total_pos * 100) if total_pos > 0 else 0

        # Fill rate — single aggregate across all PO lines (no N+1)
        line_stats = PurchaseOrderLine.objects.filter(
            order__in=pos,
            organization=organization,
        ).aggregate(
            total_ordered=Coalesce(Sum('quantity'), Decimal('0')),
            total_received=Coalesce(Sum('qty_received'), Decimal('0')),
            total_damaged=Coalesce(Sum('qty_damaged'), Decimal('0')),
            total_rejected=Coalesce(Sum('qty_rejected'), Decimal('0')),
        )

        total_ordered = line_stats['total_ordered']
        total_received = line_stats['total_received']
        total_damaged = line_stats['total_damaged']
        total_rejected = line_stats['total_rejected']

        fill_rate = float(total_received / total_ordered * 100) if total_ordered > 0 else 0
        damage_rate = float(total_damaged / total_ordered * 100) if total_ordered > 0 else 0
        rejection_rate = float(total_rejected / total_ordered * 100) if total_ordered > 0 else 0

        # Dispute rate
        disputes = DisputeCase.objects.filter(
            organization=organization,
            purchase_order__supplier_id=supplier_id,
            opened_at__date__gte=period_start,
            opened_at__date__lte=period_end,
        ).count()
        dispute_rate = (disputes / total_pos * 100) if total_pos > 0 else 0

        # Composite score
        score = (
            Decimal('0.30') * Decimal(str(on_time_delivery_rate))
            + Decimal('0.20') * Decimal(str(fill_rate))
            + Decimal('0.15') * (100 - Decimal(str(damage_rate)))
            + Decimal('0.10') * (100 - Decimal(str(rejection_rate)))
            + Decimal('0.10') * Decimal('50')  # Lead time placeholder
            + Decimal('0.10') * Decimal('50')  # Price competitiveness placeholder
            + Decimal('0.05') * (100 - Decimal(str(dispute_rate)))
        ).quantize(Decimal('0.01'))

        snapshot = SupplierPerformanceSnapshot.objects.create(
            organization=organization,
            supplier_id=supplier_id,
            period_start=period_start,
            period_end=period_end,
            total_pos=total_pos,
            total_po_value=total_po_value,
            on_time_delivery_rate=Decimal(str(on_time_delivery_rate)).quantize(Decimal('0.01')),
            fill_rate=Decimal(str(fill_rate)).quantize(Decimal('0.01')),
            damage_rate=Decimal(str(damage_rate)).quantize(Decimal('0.01')),
            rejection_rate=Decimal(str(rejection_rate)).quantize(Decimal('0.01')),
            dispute_rate=Decimal(str(dispute_rate)).quantize(Decimal('0.01')),
            score=score,
        )

        return snapshot

    # ─── LOCKING MATRIX ─────────────────────────────────────────────────

    EDITABLE_FIELDS_BY_STATUS = {
        'DRAFT':              '*',  # All fields editable
        'SUBMITTED':          {'notes', 'internal_notes', 'priority'},
        'APPROVED':           {'notes', 'internal_notes'},
        'REJECTED':           {'notes', 'internal_notes'},
        'SENT':               {'notes', 'internal_notes', 'tracking_number', 'tracking_url'},
        'CONFIRMED':          {'notes', 'internal_notes', 'tracking_number', 'tracking_url', 'expected_date'},
        'IN_TRANSIT':         {'notes', 'internal_notes', 'tracking_number', 'tracking_url'},
        'PARTIALLY_RECEIVED': {'notes', 'internal_notes'},
        'RECEIVED':           {'notes', 'internal_notes'},
        'PARTIALLY_INVOICED': {'notes'},
        'INVOICED':           {'notes'},
        'COMPLETED':          set(),   # Nothing editable
        'CANCELLED':          set(),   # Nothing editable
    }

    @staticmethod
    def check_field_editability(po, field_names):
        """
        Validate that the given fields can be edited in the PO's current status.
        Returns list of blocked fields.
        """
        allowed = ProcurementDomainService.EDITABLE_FIELDS_BY_STATUS.get(po.status, set())
        if allowed == '*':
            return []
        return [f for f in field_names if f not in allowed and f != 'status']
