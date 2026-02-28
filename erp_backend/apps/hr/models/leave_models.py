from django.db import models
from django.core.exceptions import ValidationError
from erp.models import TenantModel, User

class Leave(TenantModel):
    LEAVE_TYPES = (
        ('ANNUAL', 'Annual Leave'),
        ('SICK', 'Sick Leave'),
        ('UNPAID', 'Unpaid Leave'),
        ('MATERNITY', 'Maternity Leave'),
        ('PATERNITY', 'Paternity Leave'),
        ('COMPENSATORY', 'Compensatory Off'),
        ('OTHER', 'Other'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    )
    employee = models.ForeignKey('hr.Employee', on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPES)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_leaves')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'leave_request'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.employee} | {self.leave_type} | {self.start_date} to {self.end_date}"

    def save(self, *args, **kwargs):
        bypass = kwargs.pop('force_audit_bypass', False)
        if self.pk and not bypass:
            original = Leave.objects.get(pk=self.pk)
            if original.status in ('APPROVED', 'REJECTED'):
                # Only allow status transitions (e.g. APPROVED -> CANCELLED)
                allowed_fields = {'status'}
                changed = {f for f in ['leave_type', 'start_date', 'end_date', 'reason', 'employee_id']
                           if getattr(original, f) != getattr(self, f)}
                if changed:
                    raise ValidationError(f"Immutable HR: Cannot modify fields {changed} on a {original.status} leave request.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status in ('APPROVED', 'REJECTED'):
            raise ValidationError(f"Immutable HR: Cannot delete a {self.status} leave request. Cancel it instead.")
        super().delete(*args, **kwargs)

    @property
    def duration_days(self):
        return (self.end_date - self.start_date).days + 1

    def approve(self, user):
        from django.utils import timezone
        self.status = 'APPROVED'
        self.approved_by = user
        self.approved_at = timezone.now()
        self.save(update_fields=['status', 'approved_by', 'approved_at'])

    def reject(self, user):
        self.status = 'REJECTED'
        self.approved_by = user
        self.save(update_fields=['status', 'approved_by'])
