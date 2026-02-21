"""
ERP Background Tasks
====================
Celery tasks for automated background processing.
All tasks are tenant-aware and use database transactions.
"""
from celery import shared_task
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


# ── Invoice Overdue Detection ─────────────────────────────────

@shared_task(name='erp.tasks.check_overdue_invoices')
def check_overdue_invoices():
    """
    Scan all invoices past due_date and mark as OVERDUE.
    Runs every hour via Celery Beat.
    """
    from apps.finance.invoice_service import InvoiceService
    count = InvoiceService.check_overdue_invoices()
    logger.info(f"[Task] check_overdue_invoices: {count} invoices marked overdue")
    return {'overdue_count': count}


# ── Stock Level Monitoring ────────────────────────────────────

@shared_task(name='erp.tasks.check_low_stock')
def check_low_stock():
    """
    Scan all products for stock level anomalies and create StockAlerts.
    Runs every 6 hours via Celery Beat.
    """
    from erp.models import Organization

    total_alerts = 0
    try:
        from apps.inventory.alert_models import StockAlertService
        for org in Organization.objects.all():
            alerts = StockAlertService.scan_organization(org)
            total_alerts += len(alerts)
    except ImportError:
        logger.warning("[Task] StockAlertService not available — skipping stock check")

    logger.info(f"[Task] check_low_stock: {total_alerts} new alerts created")
    return {'new_alerts': total_alerts}


# ── Daily Analytics Warm-up ───────────────────────────────────

@shared_task(name='erp.tasks.warm_analytics_cache')
def warm_analytics_cache():
    """
    Pre-compute analytics data for dashboards.
    Runs daily at 02:00.
    """
    from erp.models import Organization
    from django.db.models import Sum, Count, Q
    from django.core.cache import cache

    orgs_processed = 0
    for org in Organization.objects.all():
        org_id = str(org.id)
        try:
            # Invoice stats
            from apps.finance.invoice_models import Invoice
            invoices = Invoice.objects.filter(organization=org)
            stats = {
                'total_invoices': invoices.count(),
                'outstanding': float(invoices.filter(
                    status__in=['SENT', 'PARTIAL_PAID', 'OVERDUE']
                ).aggregate(s=Sum('balance_due'))['s'] or 0),
                'overdue_count': invoices.filter(status='OVERDUE').count(),
                'collected': float(invoices.aggregate(s=Sum('paid_amount'))['s'] or 0),
            }
            cache.set(f'analytics:invoice:{org_id}', stats, 86400)
        except Exception as e:
            logger.warning(f"[Task] Failed analytics for org {org_id}: {e}")

        orgs_processed += 1

    logger.info(f"[Task] warm_analytics_cache: {orgs_processed} organizations refreshed")
    return {'orgs_processed': orgs_processed}


# ── Audit Log Cleanup ─────────────────────────────────────────

@shared_task(name='erp.tasks.cleanup_old_audit_logs')
def cleanup_old_audit_logs(days=90):
    """
    Delete audit log entries older than N days.
    Runs weekly on Sundays at 03:00.
    """
    from datetime import timedelta

    cutoff = timezone.now() - timedelta(days=days)
    deleted = 0

    try:
        from erp.models import ForensicAuditLog
        result = ForensicAuditLog.objects.filter(timestamp__lt=cutoff).delete()
        deleted = result[0] if result else 0
    except Exception as e:
        logger.warning(f"[Task] Failed audit log cleanup: {e}")

    logger.info(f"[Task] cleanup_old_audit_logs: {deleted} entries removed (>{days} days)")
    return {'deleted': deleted, 'cutoff_days': days}


# ── Database Backup Trigger ───────────────────────────────────

@shared_task(name='erp.tasks.generate_daily_backup')
def generate_daily_backup():
    """
    Trigger a database backup.
    This is a placeholder — actual backup logic depends on hosting provider.
    Can be extended to:
    - Run pg_dump
    - Upload to S3/GCS
    - Send notification on completion/failure
    """
    import subprocess
    from django.conf import settings

    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    logger.info(f"[Task] generate_daily_backup: triggered at {timestamp}")

    # Placeholder: log intent, actual backup depends on deployment
    return {
        'timestamp': timestamp,
        'status': 'triggered',
        'note': 'Extend with pg_dump or cloud backup integration'
    }


# ── Send Notification (for Phase 2.2) ────────────────────────

@shared_task(name='erp.tasks.send_notification')
def send_notification(user_id, title, message, notification_type='INFO', link=None):
    """
    Create an in-app notification asynchronously.
    Will be extended in Phase 2.2 to support email/SMS channels.
    """
    from erp.models import Notification, User

    try:
        user = User.objects.get(id=user_id)
        Notification.objects.create(
            user=user,
            title=title,
            message=message,
            type=notification_type,
            link=link,
        )
        logger.info(f"[Task] Notification sent to user {user_id}: {title}")
        return {'status': 'sent', 'user_id': user_id}
    except User.DoesNotExist:
        logger.warning(f"[Task] send_notification: user {user_id} not found")
        return {'status': 'failed', 'reason': 'user not found'}


# ── Templated Notification (Multi-Channel) ────────────────────

@shared_task(name='erp.tasks.send_templated_notification')
def send_templated_notification(user_id, template_code, variables=None, link=None):
    """
    Send a notification through the NotificationService.
    Respects user preferences for channel selection.
    """
    from erp.models import User

    try:
        user = User.objects.get(id=user_id)
        from erp.notification_service import NotificationService
        logs = NotificationService.send(
            user=user,
            template_code=template_code,
            variables=variables or {},
            link=link,
        )
        logger.info(f"[Task] Templated notification '{template_code}' sent to user {user_id} via {len(logs)} channels")
        return {'status': 'sent', 'channels': len(logs)}
    except Exception as e:
        logger.error(f"[Task] Failed to send templated notification: {e}")
        return {'status': 'failed', 'error': str(e)}


# ── Daily Digest ──────────────────────────────────────────────

@shared_task(name='erp.tasks.send_daily_digest')
def send_daily_digest():
    """
    Send a daily digest email to users with unread notifications.
    Runs daily at 08:00.
    """
    from erp.models import User, Notification
    from erp.notification_service import NotificationService
    from datetime import timedelta

    yesterday = timezone.now() - timedelta(days=1)
    sent_count = 0

    for user in User.objects.filter(is_active=True).exclude(email=''):
        unread = Notification.objects.filter(
            user=user,
            read_at__isnull=True,
            created_at__gte=yesterday,
        )
        if unread.count() == 0:
            continue

        summary_items = [f"• {n.title}" for n in unread[:10]]
        body = (
            f"You have {unread.count()} unread notification(s) from the last 24 hours:\n\n"
            + "\n".join(summary_items)
            + "\n\nLog in to view details."
        )

        try:
            NotificationService._send_email(
                user=user,
                subject=f"Daily Digest: {unread.count()} unread notifications",
                body=body,
            )
            sent_count += 1
        except Exception as e:
            logger.warning(f"[Task] Daily digest failed for {user}: {e}")

    logger.info(f"[Task] send_daily_digest: sent to {sent_count} users")
    return {'sent_count': sent_count}


# ── Scheduled Report Execution ────────────────────────────────

@shared_task(name='erp.tasks.run_scheduled_reports')
def run_scheduled_reports():
    """
    Check for scheduled reports whose cron matches current time and execute them.
    Runs every hour via Celery Beat.
    """
    from erp.models import Organization

    executed = 0
    try:
        from apps.finance.report_models import ReportDefinition
        from apps.finance.report_service import ReportService

        for report_def in ReportDefinition.objects.filter(is_scheduled=True, is_active=True):
            org_id = str(report_def.organization_id)
            service = ReportService(org_id)
            result = service.run_and_export(report_def)

            if result.get('file_path') and report_def.email_recipients:
                # Send report via email
                from django.core.mail import EmailMessage
                email = EmailMessage(
                    subject=f"Scheduled Report: {report_def.name}",
                    body=f"Report '{report_def.name}' generated with {result.get('row_count', 0)} rows.",
                    to=report_def.email_recipients,
                )
                email.attach_file(result['file_path'])
                try:
                    email.send()
                except Exception as e:
                    logger.warning(f"[Task] Failed to email report {report_def.name}: {e}")

            executed += 1
    except ImportError:
        logger.warning("[Task] Report models not available — skipping scheduled reports")

    logger.info(f"[Task] run_scheduled_reports: {executed} reports executed")
    return {'executed': executed}


# ── On-Demand Report Execution (Background) ──────────────────

@shared_task(name='erp.tasks.run_report_async', bind=True, max_retries=2)
def run_report_async(self, report_def_id, organization_id, export_format='EXCEL'):
    """
    Run a report in the background and store the result.
    Called from ReportViewSet.run with background=True.
    """
    try:
        from apps.finance.report_models import ReportDefinition, ReportExecution
        from apps.finance.report_service import ReportService

        report_def = ReportDefinition.objects.get(pk=report_def_id)
        service = ReportService(organization_id)
        result = service.run_and_export(report_def, export_format=export_format)

        # Record execution
        ReportExecution.objects.create(
            report=report_def,
            organization_id=organization_id,
            status='SUCCESS' if 'file_path' in result else 'FAILED',
            row_count=result.get('row_count', 0),
            file_path=result.get('file_path', ''),
            error_message=result.get('error', ''),
        )

        logger.info(f"[Task] run_report_async: {report_def.name} completed ({result.get('row_count', 0)} rows)")
        return result

    except Exception as exc:
        logger.error(f"[Task] run_report_async failed: {exc}")
        try:
            from apps.finance.report_models import ReportDefinition, ReportExecution
            ReportExecution.objects.create(
                report_id=report_def_id,
                organization_id=organization_id,
                status='FAILED',
                error_message=str(exc),
            )
        except Exception:
            pass
        raise self.retry(exc=exc, countdown=30)
