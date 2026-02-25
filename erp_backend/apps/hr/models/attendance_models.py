from django.db import models
from erp.models import TenantModel

class Shift(TenantModel):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, null=True, blank=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.IntegerField(default=0)
    site = models.ForeignKey('erp.Site', on_delete=models.SET_NULL, null=True, blank=True, related_name='shifts')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'shift'

    def __str__(self):
        return f"{self.name} ({self.start_time}–{self.end_time})"

    @property
    def duration_hours(self):
        from datetime import datetime, timedelta
        start = datetime.combine(datetime.today(), self.start_time)
        end = datetime.combine(datetime.today(), self.end_time)
        if end < start:
            end += timedelta(days=1)
        total = (end - start).total_seconds() / 3600
        return total - (self.break_minutes / 60)

class Attendance(TenantModel):
    STATUS_CHOICES = (
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('LATE', 'Late'),
        ('LEAVE', 'On Leave'),
        ('HALF_DAY', 'Half Day'),
    )
    employee = models.ForeignKey('hr.Employee', on_delete=models.CASCADE, related_name='attendance_records')
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
        if self.check_in and self.check_out:
            delta = self.check_out - self.check_in
            return round(delta.total_seconds() / 3600, 2)
        return 0
