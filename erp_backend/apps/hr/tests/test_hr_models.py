"""
HR Module — Model & Workflow Tests
====================================
Tests for Employee, Department, Shift, Attendance, and Leave models.
"""
from decimal import Decimal
from datetime import date, time, timedelta
from django.test import TestCase
from django.utils import timezone

from erp.models import Organization, User, Site
from apps.hr.models import Employee, Department, Shift, Attendance, Leave


class HRTestBase(TestCase):
    """Shared fixtures for HR tests."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="HR Test Org", slug="hr-test")
        cls.site = Site.objects.create(organization=cls.org, name="HQ", code="HQ")
        cls.user = User.objects.create_user(
            username="hr_admin", password="test123",
            email="hr@test.com", organization=cls.org,
        )


# =============================================================================
# EMPLOYEE
# =============================================================================


class TestEmployee(HRTestBase):
    """Tests for Employee model."""

    def test_create_employee(self):
        """Can create an employee with basic fields."""
        emp = Employee.objects.create(
            organization=self.org, employee_id="EMP-001",
            first_name="John", last_name="Doe",
            job_title="Engineer", salary=Decimal("5000.00"),
        )
        self.assertEqual(emp.employee_id, "EMP-001")
        self.assertEqual(emp.employee_type, "EMPLOYEE")

    def test_employee_str_with_names(self):
        """Employee __str__ should show full name."""
        emp = Employee.objects.create(
            organization=self.org, employee_id="EMP-002",
            first_name="Jane", last_name="Smith",
        )
        self.assertIn("Jane", str(emp))
        self.assertIn("Smith", str(emp))

    def test_employee_str_fallback(self):
        """Employee __str__ falls back to employee_id if no names."""
        emp = Employee.objects.create(
            organization=self.org, employee_id="EMP-003",
        )
        self.assertEqual(str(emp), "EMP-003")

    def test_partner_employee_type(self):
        """Can create a partner-type employee."""
        emp = Employee.objects.create(
            organization=self.org, employee_id="PART-001",
            first_name="Partner", employee_type="PARTNER",
        )
        self.assertEqual(emp.employee_type, "PARTNER")


# =============================================================================
# DEPARTMENT
# =============================================================================


class TestDepartment(HRTestBase):
    """Tests for Department model."""

    def test_create_department(self):
        """Can create a department."""
        dept = Department.objects.create(
            organization=self.org, name="Engineering", code="ENG",
        )
        self.assertEqual(dept.name, "Engineering")
        self.assertTrue(dept.is_active)

    def test_department_hierarchy(self):
        """Departments can have parent-child relationships."""
        parent = Department.objects.create(
            organization=self.org, name="Tech", code="TECH",
        )
        child = Department.objects.create(
            organization=self.org, name="Backend", code="BACK",
            parent=parent,
        )
        self.assertEqual(child.parent, parent)
        self.assertEqual(parent.sub_departments.count(), 1)

    def test_department_with_manager(self):
        """Department can have a manager."""
        emp = Employee.objects.create(
            organization=self.org, employee_id="MGR-001",
            first_name="Manager",
        )
        dept = Department.objects.create(
            organization=self.org, name="Sales", code="SALES",
            manager=emp,
        )
        self.assertEqual(dept.manager, emp)


# =============================================================================
# SHIFT
# =============================================================================


class TestShift(HRTestBase):
    """Tests for Shift model."""

    def test_create_shift(self):
        """Can create a shift with start/end times."""
        shift = Shift.objects.create(
            organization=self.org, name="Morning",
            start_time=time(8, 0), end_time=time(16, 0),
            break_minutes=60,
        )
        self.assertEqual(shift.name, "Morning")
        self.assertTrue(shift.is_active)

    def test_shift_duration_hours(self):
        """Duration should be calculated correctly (minus break)."""
        shift = Shift.objects.create(
            organization=self.org, name="Standard",
            start_time=time(9, 0), end_time=time(17, 0),
            break_minutes=60,
        )
        # 8 hours - 1 hour break = 7 hours
        self.assertAlmostEqual(shift.duration_hours, 7.0, places=1)

    def test_overnight_shift_duration(self):
        """Overnight shifts should calculate correctly."""
        shift = Shift.objects.create(
            organization=self.org, name="Night",
            start_time=time(22, 0), end_time=time(6, 0),
            break_minutes=30,
        )
        # 8 hours - 0.5 break = 7.5 hours
        self.assertAlmostEqual(shift.duration_hours, 7.5, places=1)

    def test_shift_str(self):
        """Shift __str__ should show name and times."""
        shift = Shift.objects.create(
            organization=self.org, name="Evening",
            start_time=time(14, 0), end_time=time(22, 0),
        )
        self.assertIn("Evening", str(shift))


# =============================================================================
# ATTENDANCE
# =============================================================================


class TestAttendance(HRTestBase):
    """Tests for Attendance model."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.emp = Employee.objects.create(
            organization=cls.org, employee_id="ATT-001",
            first_name="Attendee",
        )

    def test_create_attendance_record(self):
        """Can create a daily attendance record."""
        att = Attendance.objects.create(
            organization=self.org, employee=self.emp,
            date=date.today(), status="PRESENT",
        )
        self.assertEqual(att.status, "PRESENT")

    def test_hours_worked_calculation(self):
        """Hours worked should be computed from check-in/out."""
        now = timezone.now()
        att = Attendance.objects.create(
            organization=self.org, employee=self.emp,
            date=date.today(),
            check_in=now,
            check_out=now + timedelta(hours=8),
            status="PRESENT",
        )
        self.assertAlmostEqual(att.hours_worked, 8.0, places=1)

    def test_hours_worked_no_checkout(self):
        """No checkout should return 0 hours."""
        att = Attendance.objects.create(
            organization=self.org, employee=self.emp,
            date=date(2026, 1, 1),
            check_in=timezone.now(),
            status="PRESENT",
        )
        self.assertEqual(att.hours_worked, 0)

    def test_unique_per_employee_per_day(self):
        """Cannot have two attendance records for same employee on same day."""
        from django.db import IntegrityError
        d = date(2026, 6, 15)
        Attendance.objects.create(
            organization=self.org, employee=self.emp,
            date=d, status="PRESENT",
        )
        with self.assertRaises(IntegrityError):
            Attendance.objects.create(
                organization=self.org, employee=self.emp,
                date=d, status="LATE",
            )


# =============================================================================
# LEAVE
# =============================================================================


class TestLeave(HRTestBase):
    """Tests for Leave model and approval workflow."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.emp = Employee.objects.create(
            organization=cls.org, employee_id="LEV-001",
            first_name="Leaver",
        )

    def test_create_leave_request(self):
        """Can create a leave request in PENDING status."""
        leave = Leave.objects.create(
            organization=self.org, employee=self.emp,
            leave_type="ANNUAL",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 5),
            reason="Vacation",
        )
        self.assertEqual(leave.status, "PENDING")
        self.assertEqual(leave.leave_type, "ANNUAL")

    def test_leave_duration_days(self):
        """Duration should include both start and end dates."""
        leave = Leave.objects.create(
            organization=self.org, employee=self.emp,
            leave_type="SICK",
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 3),
        )
        self.assertEqual(leave.duration_days, 3)

    def test_approve_leave(self):
        """Approval should set status, approver, and timestamp."""
        leave = Leave.objects.create(
            organization=self.org, employee=self.emp,
            leave_type="ANNUAL",
            start_date=date(2026, 8, 1),
            end_date=date(2026, 8, 5),
        )
        leave.approve(self.user)
        leave.refresh_from_db()
        self.assertEqual(leave.status, "APPROVED")
        self.assertEqual(leave.approved_by, self.user)
        self.assertIsNotNone(leave.approved_at)

    def test_reject_leave(self):
        """Rejection should set status and approver."""
        leave = Leave.objects.create(
            organization=self.org, employee=self.emp,
            leave_type="UNPAID",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 2),
        )
        leave.reject(self.user)
        leave.refresh_from_db()
        self.assertEqual(leave.status, "REJECTED")
        self.assertEqual(leave.approved_by, self.user)

    def test_single_day_leave(self):
        """Single day leave should have duration of 1."""
        leave = Leave.objects.create(
            organization=self.org, employee=self.emp,
            leave_type="SICK",
            start_date=date(2026, 4, 15),
            end_date=date(2026, 4, 15),
        )
        self.assertEqual(leave.duration_days, 1)
