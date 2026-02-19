"""
Notification Service
====================
Multi-channel notification delivery with template rendering,
preference checking, and async email sending via Celery.
"""
import logging
from django.conf import settings as django_settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Central service for sending notifications across channels.

    Usage:
        NotificationService.send(
            user=user,
            template_code='invoice_overdue',
            variables={'invoice_number': 'INV-001', 'amount': '500.00'},
            link='/finance/invoices/42'
        )
    """

    @staticmethod
    def send(user, template_code, variables=None, link=None, force_channels=None):
        """
        Send notification through all enabled channels for this user/type.

        Args:
            user: User instance
            template_code: Template code (e.g. 'invoice_overdue')
            variables: Dict of template variables
            link: Optional URL for in-app notification
            force_channels: List of channels to force (ignoring preferences)

        Returns:
            list of NotificationLog entries created
        """
        from erp.notification_models import (
            NotificationTemplate, NotificationPreference, NotificationLog
        )
        from erp.models import Notification

        variables = variables or {}
        logs = []

        # Determine which channels to use
        if force_channels:
            channels = force_channels
        else:
            channels = NotificationService._get_enabled_channels(
                user, template_code
            )

        for channel in channels:
            try:
                # Find template for this channel
                template = NotificationTemplate.objects.filter(
                    code=template_code,
                    channel=channel,
                    is_active=True,
                ).first()

                if template:
                    subject = template.render_subject(variables)
                    body = template.render_body(variables)
                else:
                    # Fallback: use template_code as subject
                    subject = template_code.replace('_', ' ').title()
                    body = str(variables)

                # Create log entry
                log = NotificationLog.objects.create(
                    user=user,
                    template=template,
                    channel=channel,
                    subject=subject,
                    body=body,
                    variables=variables,
                    status='QUEUED',
                )

                # Dispatch by channel
                if channel == 'IN_APP':
                    NotificationService._send_in_app(user, subject, body, link)
                    log.mark_sent()
                elif channel == 'EMAIL':
                    NotificationService._send_email(user, subject, body)
                    log.mark_sent()
                elif channel == 'SMS':
                    # Placeholder for SMS integration
                    logger.info(f"[SMS] Would send to {user}: {subject}")
                    log.mark_sent()
                elif channel == 'PUSH':
                    # Placeholder for push notification
                    logger.info(f"[PUSH] Would push to {user}: {subject}")
                    log.mark_sent()

                logs.append(log)

            except Exception as e:
                logger.error(f"[NotificationService] Failed {channel} for {user}: {e}")
                if 'log' in locals():
                    log.mark_failed(str(e))

        return logs

    @staticmethod
    def send_async(user_id, template_code, variables=None, link=None):
        """
        Queue notification for async delivery via Celery.
        """
        from erp.tasks import send_templated_notification
        send_templated_notification.delay(
            user_id=user_id,
            template_code=template_code,
            variables=variables or {},
            link=link,
        )

    @staticmethod
    def _get_enabled_channels(user, template_code):
        """Get list of enabled channels for user + notification type."""
        from erp.notification_models import NotificationPreference

        prefs = NotificationPreference.objects.filter(
            user=user,
            notification_type=template_code,
        )

        if prefs.exists():
            return [p.channel for p in prefs if p.is_enabled]
        else:
            # Default: IN_APP only if no preferences configured
            return ['IN_APP']

    @staticmethod
    def _send_in_app(user, subject, body, link=None):
        """Create an in-app notification record."""
        from erp.models import Notification

        Notification.objects.create(
            user=user,
            title=subject,
            message=body,
            type='INFO',
            link=link,
        )

    @staticmethod
    def _send_email(user, subject, body):
        """Send email notification."""
        if not user.email:
            logger.warning(f"[Email] User {user} has no email address")
            return

        try:
            send_mail(
                subject=subject,
                message=body,  # Plain text fallback
                html_message=body if '<' in body else None,  # HTML if contains tags
                from_email=django_settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            logger.info(f"[Email] Sent to {user.email}: {subject}")
        except Exception as e:
            logger.error(f"[Email] Failed to send to {user.email}: {e}")
            raise

    @staticmethod
    def get_user_preferences(user):
        """Get all notification preferences for a user, with defaults."""
        from erp.notification_models import NotificationPreference

        # All possible types
        all_types = dict(NotificationPreference.NOTIFICATION_TYPES)
        all_channels = ['IN_APP', 'EMAIL']

        prefs = {}
        existing = {
            (p.notification_type, p.channel): p.is_enabled
            for p in NotificationPreference.objects.filter(user=user)
        }

        for ntype, label in all_types.items():
            prefs[ntype] = {
                'label': label,
                'channels': {}
            }
            for channel in all_channels:
                key = (ntype, channel)
                if key in existing:
                    prefs[ntype]['channels'][channel] = existing[key]
                else:
                    # Default: IN_APP enabled, EMAIL disabled
                    prefs[ntype]['channels'][channel] = (channel == 'IN_APP')

        return prefs

    @staticmethod
    def update_preference(user, notification_type, channel, is_enabled):
        """Update or create a notification preference."""
        from erp.notification_models import NotificationPreference

        pref, created = NotificationPreference.objects.update_or_create(
            user=user,
            notification_type=notification_type,
            channel=channel,
            defaults={'is_enabled': is_enabled},
        )
        return pref
