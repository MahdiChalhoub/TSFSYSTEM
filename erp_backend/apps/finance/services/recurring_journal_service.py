"""
Recurring Journal Service — Generates journal entries from templates.

Designed to be called by a scheduler (celery, cron, management command)
or manually triggered from the UI.
"""
import logging
from datetime import timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class RecurringJournalService:
    """Generates JEs from recurring templates."""

    @staticmethod
    def process_due_templates(organization=None):
        """
        Process all templates that are due for execution.
        Called by scheduler. Returns number of JEs created.
        """
        from apps.finance.models import RecurringJournalTemplate
        from django.utils import timezone as tz

        today = tz.now().date()
        qs = RecurringJournalTemplate.objects.filter(
            status='ACTIVE',
            next_run_date__lte=today,
        )
        if organization:
            qs = qs.filter(organization=organization)

        created = 0
        for template in qs:
            try:
                RecurringJournalService.execute_template(template)
                created += 1
            except Exception as e:
                logger.error(f"RecurringJournalService: Failed {template.name}: {e}")
                # Log the failure
                from apps.finance.models import RecurringJournalExecution
                RecurringJournalExecution.objects.create(
                    organization=template.organization,
                    template=template,
                    execution_date=today,
                    occurrence_number=template.occurrences_created + 1,
                    status='FAILED',
                    error_message=str(e),
                )

        logger.info(f"RecurringJournalService: Processed {created} templates.")
        return created

    @staticmethod
    def execute_template(template, override_date=None):
        """
        Execute a single recurring template — create a JE from its lines.
        """
        from apps.finance.models import RecurringJournalExecution
        from apps.finance.services.ledger_core import LedgerCoreMixin

        if template.is_expired:
            template.status = 'EXPIRED'
            template.save()
            raise ValidationError(f"Template '{template.name}' has expired.")

        execution_date = override_date or template.next_run_date or timezone.now().date()

        # Build lines from template
        lines = []
        for tl in template.lines.all():
            lines.append({
                'account_id': tl.account_id,
                'debit': tl.debit,
                'credit': tl.credit,
                'description': tl.description or template.description,
                'partner_type': tl.partner_type,
                'partner_id': tl.partner_id,
                'cost_center': tl.cost_center,
            })

        if not lines:
            raise ValidationError(f"Template '{template.name}' has no lines.")

        with transaction.atomic():
            status = 'POSTED' if template.auto_post else 'DRAFT'

            je = LedgerCoreMixin.create_journal_entry(
                organization=template.organization,
                transaction_date=execution_date,
                description=f"[Recurring] {template.name}",
                lines=lines,
                status=status,
                scope=template.scope,
                journal_type=template.journal_type,
                source_module='finance',
                source_model='RecurringJournalTemplate',
                source_id=template.id,
                internal_bypass=True,
            )

            # Log execution
            template.occurrences_created += 1
            RecurringJournalExecution.objects.create(
                organization=template.organization,
                template=template,
                journal_entry=je,
                execution_date=execution_date,
                occurrence_number=template.occurrences_created,
                status='SUCCESS',
            )

            # Advance next_run_date
            template.next_run_date = RecurringJournalService._next_date(
                execution_date, template.frequency
            )
            template.last_generated_at = timezone.now()

            # Check expiry
            if template.is_expired:
                template.status = 'COMPLETED'

            template.save()

            logger.info(
                f"RecurringJournalService: Created JE {je.reference} from "
                f"template '{template.name}' (#{template.occurrences_created})"
            )
            return je

    @staticmethod
    def _next_date(current_date, frequency):
        """Compute the next occurrence date."""
        freq_map = {
            'DAILY': timedelta(days=1),
            'WEEKLY': timedelta(weeks=1),
            'MONTHLY': relativedelta(months=1),
            'QUARTERLY': relativedelta(months=3),
            'SEMI_ANNUAL': relativedelta(months=6),
            'ANNUAL': relativedelta(years=1),
        }
        delta = freq_map.get(frequency, relativedelta(months=1))
        return current_date + delta
