"""
HR Module Models
Extracted from Kernel (erp/models.py) → Module Layer (apps/hr/models.py)
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel, User


class Employee(TenantModel):
    EMPLOYEE_TYPE_CHOICES = [
        ('EMPLOYEE', 'Employee'),
        ('PARTNER', 'Partner'),
        ('BOTH', 'Partner & Employee'),
    ]

    employee_id = models.CharField(max_length=100, unique=True)
    first_name = models.CharField(max_length=255, null=True, blank=True)
    last_name = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    job_title = models.CharField(max_length=255, null=True, blank=True)
    employee_type = models.CharField(max_length=10, choices=EMPLOYEE_TYPE_CHOICES, default='EMPLOYEE')
    salary = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    # Decoupled from finance module — uses IntegerField to avoid hard dependency
    linked_account_id = models.IntegerField(null=True, blank=True, db_column='linked_account_id')
    dividends_account_id = models.IntegerField(null=True, blank=True, help_text='GL account for dividends payable (partners only)')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, db_column='user_id')
    home_site = models.ForeignKey('erp.Site', on_delete=models.SET_NULL, null=True, blank=True)
    address_line = models.TextField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'employee'

    def __str__(self):
        return f"{self.first_name or ''} {self.last_name or ''}".strip() or self.employee_id


class Department(TenantModel):
    """Organizational department with hierarchical structure."""
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, null=True, blank=True)
    manager = models.ForeignKey(
        'Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_departments'
    )
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sub_departments'
    )
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'department'

    def __str__(self):
        return f"{self.code or ''} {self.name}".strip()


class Shift(TenantModel):
    """Work shift definition."""
    name = models.CharField(max_length=100, help_text='e.g. Morning, Evening, Night')
    code = models.CharField(max_length=20, null=True, blank=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.IntegerField(default=0, help_text='Break duration in minutes')
    site = models.ForeignKey(
        'erp.Site', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='shifts'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'shift'

    def __str__(self):
        return f"{self.name} ({self.start_time}–{self.end_time})"

    @property
    def duration_hours(self):
        """Calculate shift duration in hours."""
        from datetime import datetime, timedelta
        start = datetime.combine(datetime.today(), self.start_time)
        end = datetime.combine(datetime.today(), self.end_time)
        if end < start:
            end += timedelta(days=1)
        total = (end - start).total_seconds() / 3600
        return total - (self.break_minutes / 60)


class Attendance(TenantModel):
    """Daily attendance record for an employee."""
    STATUS_CHOICES = (
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('LATE', 'Late'),
        ('LEAVE', 'On Leave'),
        ('HALF_DAY', 'Half Day'),
    )

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='attendance_records'
    )
    date = models.DateField()
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PRESENT')
    shift = models.ForeignKey(Shift, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'attendance'
        unique_together = ['employee', 'date']
        ordering = ['-date']

    def __str__(self):
        return f"{self.employee} | {self.date} | {self.status}"

    @property
    def hours_worked(self):
        """Calculate hours worked from check-in to check-out."""
        if self.check_in and self.check_out:
            delta = self.check_out - self.check_in
            return round(delta.total_seconds() / 3600, 2)
        return 0


class Leave(TenantModel):
    """Employee leave request with approval workflow."""
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

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='leave_requests'
    )
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPES)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_leaves'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'leave_request'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.employee} | {self.leave_type} | {self.start_date} to {self.end_date}"

    @property
    def duration_days(self):
        """Calculate leave duration in days."""
        return (self.end_date - self.start_date).days + 1

    def approve(self, user):
        """Approve this leave request."""
        from django.utils import timezone
        self.status = 'APPROVED'
        self.approved_by = user
        self.approved_at = timezone.now()
        self.save(update_fields=['status', 'approved_by', 'approved_at'])

    def reject(self, user):
        """Reject this leave request."""
        self.status = 'REJECTED'
        self.approved_by = user
        self.save(update_fields=['status', 'approved_by'])
