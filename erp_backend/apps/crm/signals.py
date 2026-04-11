from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from apps.crm.models import RelationshipAssignment, InteractionLog, ScheduledActivity
from apps.crm.services.followup_service import FollowUpService

@receiver(post_save, sender=RelationshipAssignment)
def on_assignment_save(sender, instance, created, **kwargs):
    """
    Synchronize Contact.assigned_owner when a primary relationship assignment is created/updated.
    """
    if instance.is_active and instance.is_primary:
        contact = instance.contact
        # If this is the primary assignment, update the contact's owner
        if contact.assigned_owner != instance.assigned_to:
            contact.assigned_owner = instance.assigned_to
            contact.save(update_fields=['assigned_owner', 'updated_at'])

@receiver(post_save, sender=InteractionLog)
def on_interaction_save(sender, instance, created, **kwargs):
    """Recalculate metrics on new interaction."""
    if created:
        FollowUpService.update_contact_followup_metrics(instance.contact)
        instance.contact.save()

@receiver(post_delete, sender=InteractionLog)
def on_interaction_delete(sender, instance, **kwargs):
    """Recalculate metrics when interaction is removed."""
    FollowUpService.update_contact_followup_metrics(instance.contact)
    instance.contact.save()

@receiver(post_save, sender=ScheduledActivity)
def on_activity_save(sender, instance, **kwargs):
    """Recalculate metrics when activity status or date changes."""
    FollowUpService.update_contact_followup_metrics(instance.contact)
    instance.contact.save()
