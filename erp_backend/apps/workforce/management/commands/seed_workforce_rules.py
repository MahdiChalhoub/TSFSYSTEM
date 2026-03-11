from django.core.management.base import BaseCommand
from apps.workforce.models import ScoreRule, ScoreFamily, ScoreDimension, ScoreDirection, PriorityLevel, SeverityLevel, ConfidenceLevel
from erp.models import Organization

class Command(BaseCommand):
    help = 'Seeds default scoring rules for Workforce Intelligence & Scoring Engine'

    def handle(self, *args, **options):
        orgs = Organization.objects.all()
        if not orgs.exists():
            self.stdout.write(self.style.WARNING("No organizations found. Seeding rules for null organization template."))
            # Handle template seeding if needed

        for org in orgs:
            self.seed_org_rules(org)
            self.stdout.write(self.style.SUCCESS(f"Seeded rules for {org.name}"))

    def seed_org_rules(self, org):
        rules = [
            # ── CRM Rules ──────────────────────────────────────────
            {
                'code': 'CRM_FOLLOWUP_SUCCESS',
                'name': 'Successful Customer Follow-up',
                'module': 'crm',
                'event_code': 'followup_completed_success',
                'event_type': 'followup',
                'base_points': 10,
                'dimension': ScoreDimension.CUSTOMER_IMPACT,
                'score_family': ScoreFamily.PERFORMANCE,
                'direction': ScoreDirection.POSITIVE,
            },
            {
                'code': 'CRM_FOLLOWUP_FAILED',
                'name': 'Failed Customer Follow-up',
                'module': 'crm',
                'event_code': 'followup_completed_failed',
                'event_type': 'followup',
                'base_points': 5,
                'dimension': ScoreDimension.CUSTOMER_IMPACT,
                'score_family': ScoreFamily.PERFORMANCE,
                'direction': ScoreDirection.NEGATIVE,
            },
            {
                'code': 'CRM_FOLLOWUP_OVERDUE',
                'name': 'Overdue Follow-up Task',
                'module': 'crm',
                'event_code': 'followup_overdue',
                'event_type': 'followup',
                'base_points': 10,
                'dimension': ScoreDimension.TIMELINESS,
                'score_family': ScoreFamily.RELIABILITY,
                'direction': ScoreDirection.NEGATIVE,
                'default_priority': PriorityLevel.HIGH,
            },
            {
                'code': 'CRM_LEAD_CONVERTED',
                'name': 'Lead Converted to Customer',
                'module': 'crm',
                'event_code': 'lead_converted',
                'event_type': 'lead',
                'base_points': 25,
                'dimension': ScoreDimension.PRODUCTIVITY,
                'score_family': ScoreFamily.PERFORMANCE,
                'direction': ScoreDirection.POSITIVE,
            },

            # ── Sales Rules ──────────────────────────────────────────
            {
                'code': 'SALES_INVOICE_POSTED',
                'name': 'Invoice Created Correctly',
                'module': 'sales',
                'event_code': 'invoice_posted',
                'event_type': 'invoice',
                'base_points': 4,
                'dimension': ScoreDimension.ACCURACY,
                'score_family': ScoreFamily.PERFORMANCE,
                'direction': ScoreDirection.POSITIVE,
            },
            {
                'code': 'SALES_CASH_SHORTAGE',
                'name': 'Cash Shortage at POS Closing',
                'module': 'sales',
                'event_code': 'cash_shortage',
                'event_type': 'pos_session',
                'base_points': 30,
                'dimension': ScoreDimension.FINANCIAL_DISCIPLINE,
                'score_family': ScoreFamily.TRUST,
                'direction': ScoreDirection.NEGATIVE,
                'default_severity': SeverityLevel.CRITICAL,
            },

            # ── Finance Rules ──────────────────────────────────────────
            {
                'code': 'FINANCE_JOURNAL_POSTED',
                'name': 'Clean Journal Entry Posted',
                'module': 'finance',
                'event_code': 'journal_posted',
                'event_type': 'journal',
                'base_points': 5,
                'dimension': ScoreDimension.ACCURACY,
                'score_family': ScoreFamily.PERFORMANCE,
                'direction': ScoreDirection.POSITIVE,
            },
            
            # ── HR Rules ──────────────────────────────────────────
            {
                'code': 'HR_ATTENDANCE_LATE',
                'name': 'Late Arrival',
                'module': 'hr',
                'event_code': 'attendance_late',
                'event_type': 'attendance',
                'base_points': 3,
                'dimension': ScoreDimension.ATTENDANCE,
                'score_family': ScoreFamily.RELIABILITY,
                'direction': ScoreDirection.NEGATIVE,
            },
            {
                'code': 'HR_ATTENDANCE_ON_TIME',
                'name': 'On-Time Arrival (Streak)',
                'module': 'hr',
                'event_code': 'attendance_on_time',
                'event_type': 'attendance',
                'base_points': 2,
                'dimension': ScoreDimension.ATTENDANCE,
                'score_family': ScoreFamily.RELIABILITY,
                'direction': ScoreDirection.POSITIVE,
                'daily_cap': 2,
            },
            {
                'code': 'HR_ABSENCE_UNEXCUSED',
                'name': 'Unexcused Absence',
                'module': 'hr',
                'event_code': 'absence_unexcused',
                'event_type': 'attendance',
                'base_points': 15,
                'dimension': ScoreDimension.ATTENDANCE,
                'score_family': ScoreFamily.RELIABILITY,
                'direction': ScoreDirection.NEGATIVE,
                'default_severity': SeverityLevel.MAJOR,
                'is_critical_rule': True,
            },

            # ── Inventory Rules ──────────────────────────────────────
            {
                'code': 'INV_SHORTAGE_FOUND',
                'name': 'Stock Shortage Identified',
                'module': 'inventory',
                'event_code': 'stock_shortage',
                'event_type': 'stock_count',
                'base_points': 20,
                'dimension': ScoreDimension.INVENTORY_DISCIPLINE,
                'score_family': ScoreFamily.TRUST,
                'direction': ScoreDirection.NEGATIVE,
                'default_severity': SeverityLevel.MAJOR,
            },
            {
                'code': 'INV_COUNT_ACCURATE',
                'name': 'Accurate Stock Count Submitted',
                'module': 'inventory',
                'event_code': 'stock_count_accurate',
                'event_type': 'stock_count',
                'base_points': 8,
                'dimension': ScoreDimension.ACCURACY,
                'score_family': ScoreFamily.PERFORMANCE,
                'direction': ScoreDirection.POSITIVE,
            },
            {
                'code': 'INV_TRANSFER_COMPLETED',
                'name': 'Stock Transfer Completed On Time',
                'module': 'inventory',
                'event_code': 'transfer_completed_on_time',
                'event_type': 'transfer',
                'base_points': 5,
                'dimension': ScoreDimension.TIMELINESS,
                'score_family': ScoreFamily.RELIABILITY,
                'direction': ScoreDirection.POSITIVE,
            },
            {
                'code': 'INV_EXPIRY_WASTE',
                'name': 'Expired Stock Written Off',
                'module': 'inventory',
                'event_code': 'expiry_waste',
                'event_type': 'adjustment',
                'base_points': 25,
                'dimension': ScoreDimension.INVENTORY_DISCIPLINE,
                'score_family': ScoreFamily.TRUST,
                'direction': ScoreDirection.NEGATIVE,
                'default_severity': SeverityLevel.CRITICAL,
                'is_critical_rule': True,
            },

            # ── POS / Sales Rules ──────────────────────────────────────
            {
                'code': 'POS_SESSION_CLOSED_CLEAN',
                'name': 'POS Session Closed Without Discrepancy',
                'module': 'sales',
                'event_code': 'pos_session_closed_clean',
                'event_type': 'pos_session',
                'base_points': 10,
                'dimension': ScoreDimension.FINANCIAL_DISCIPLINE,
                'score_family': ScoreFamily.TRUST,
                'direction': ScoreDirection.POSITIVE,
            },
            {
                'code': 'POS_CASH_OVERAGE',
                'name': 'Cash Overage at POS Closing',
                'module': 'sales',
                'event_code': 'cash_overage',
                'event_type': 'pos_session',
                'base_points': 5,
                'dimension': ScoreDimension.FINANCIAL_DISCIPLINE,
                'score_family': ScoreFamily.TRUST,
                'direction': ScoreDirection.NEGATIVE,
            },
            {
                'code': 'POS_RETURN_APPROVED',
                'name': 'Customer Return Handled Correctly',
                'module': 'sales',
                'event_code': 'return_approved',
                'event_type': 'return',
                'base_points': 5,
                'dimension': ScoreDimension.CUSTOMER_IMPACT,
                'score_family': ScoreFamily.PERFORMANCE,
                'direction': ScoreDirection.POSITIVE,
            },

            # ── Workspace / Task Rules ──────────────────────────────────
            {
                'code': 'TASK_COMPLETED_EARLY',
                'name': 'Task Completed Before Deadline',
                'module': 'workspace',
                'event_code': 'task_completed_early',
                'event_type': 'task',
                'base_points': 8,
                'dimension': ScoreDimension.TIMELINESS,
                'score_family': ScoreFamily.PERFORMANCE,
                'direction': ScoreDirection.POSITIVE,
            },
            {
                'code': 'TASK_OVERDUE',
                'name': 'Task Missed Deadline',
                'module': 'workspace',
                'event_code': 'task_overdue',
                'event_type': 'task',
                'base_points': 10,
                'dimension': ScoreDimension.TIMELINESS,
                'score_family': ScoreFamily.RELIABILITY,
                'direction': ScoreDirection.NEGATIVE,
                'default_severity': SeverityLevel.MEDIUM,
            },
            {
                'code': 'CHECKLIST_COMPLETED',
                'name': 'Shift Checklist Completed',
                'module': 'workspace',
                'event_code': 'checklist_completed',
                'event_type': 'checklist',
                'base_points': 5,
                'dimension': ScoreDimension.COMPLIANCE,
                'score_family': ScoreFamily.COMPLIANCE,
                'direction': ScoreDirection.POSITIVE,
                'daily_cap': 10,
            },

            # ── Manual Adjustment Rules (requires 'can_be_manual') ─────
            {
                'code': 'MANUAL_BONUS',
                'name': 'Manager Bonus Award',
                'module': 'manual',
                'event_code': 'manual_bonus',
                'event_type': 'adjustment',
                'base_points': 10,
                'dimension': ScoreDimension.LEADERSHIP,
                'score_family': ScoreFamily.LEADERSHIP,
                'direction': ScoreDirection.POSITIVE,
                'can_be_manual': True,
                'monthly_cap': 100,
            },
            {
                'code': 'MANUAL_PENALTY',
                'name': 'Manager Penalty',
                'module': 'manual',
                'event_code': 'manual_penalty',
                'event_type': 'adjustment',
                'base_points': 10,
                'dimension': ScoreDimension.LEADERSHIP,
                'score_family': ScoreFamily.LEADERSHIP,
                'direction': ScoreDirection.NEGATIVE,
                'can_be_manual': True,
                'monthly_cap': 100,
                'requires_review': True,
            },

            # ── Procurement Rules ───────────────────────────────────
            {
                'code': 'PROC_PO_ON_TIME',
                'name': 'Purchase Order Received On Time',
                'module': 'procurement',
                'event_code': 'po_received_on_time',
                'event_type': 'po_receipt',
                'base_points': 8,
                'dimension': ScoreDimension.TIMELINESS,
                'score_family': ScoreFamily.RELIABILITY,
                'direction': ScoreDirection.POSITIVE,
            },
            {
                'code': 'PROC_PO_LATE',
                'name': 'Purchase Order Received Late',
                'module': 'procurement',
                'event_code': 'po_received_late',
                'event_type': 'po_receipt',
                'base_points': 12,
                'dimension': ScoreDimension.TIMELINESS,
                'score_family': ScoreFamily.RELIABILITY,
                'direction': ScoreDirection.NEGATIVE,
                'default_priority': PriorityLevel.HIGH,
            },

            # ── Workspace Overdue Task ──────────────────────────────
            {
                'code': 'WORKSPACE_TASK_OVERDUE',
                'name': 'Task Overdue Without Completion',
                'module': 'workspace',
                'event_code': 'task_overdue',
                'event_type': 'task',
                'base_points': 15,
                'dimension': ScoreDimension.TIMELINESS,
                'score_family': ScoreFamily.RELIABILITY,
                'direction': ScoreDirection.NEGATIVE,
                'default_severity': SeverityLevel.MAJOR,
                'requires_review': True,
            },

            # ── Finance Compliance ──────────────────────────────────
            {
                'code': 'FINANCE_UNAUTHORIZED_EXPENSE',
                'name': 'Unauthorized Expense Submission',
                'module': 'finance',
                'event_code': 'unauthorized_expense',
                'event_type': 'expense',
                'base_points': 20,
                'dimension': ScoreDimension.COMPLIANCE,
                'score_family': ScoreFamily.COMPLIANCE,
                'direction': ScoreDirection.NEGATIVE,
                'default_severity': SeverityLevel.CRITICAL,
                'is_critical_rule': True,
                'requires_review': True,
            },

            # ── Workspace Task Completed On Time ────────────────────
            {
                'code': 'WORKSPACE_TASK_ON_TIME',
                'name': 'Task Completed On Time',
                'module': 'workspace',
                'event_code': 'task_completed_on_time',
                'event_type': 'task',
                'base_points': 10,
                'dimension': ScoreDimension.TIMELINESS,
                'score_family': ScoreFamily.PERFORMANCE,
                'direction': ScoreDirection.POSITIVE,
                'daily_cap': 30,
            },

            # ── Workspace Task Completed Late ────────────────────────
            {
                'code': 'WORKSPACE_TASK_LATE',
                'name': 'Task Completed After Due Date',
                'module': 'workspace',
                'event_code': 'task_completed_late',
                'event_type': 'task',
                'base_points': 5,
                'dimension': ScoreDimension.TIMELINESS,
                'score_family': ScoreFamily.RELIABILITY,
                'direction': ScoreDirection.NEGATIVE,
            },
        ]

        for r_data in rules:
            ScoreRule.objects.update_or_create(
                organization=org,
                code=r_data['code'],
                defaults=r_data
            )
