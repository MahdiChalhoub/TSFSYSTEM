# HR (Human Resources) Module

## Overview
Complete HR management system:
- Employee records and profiles
- Attendance tracking
- Leave management
- Payroll processing
- Performance reviews
- Recruitment and onboarding
- Document management
- Organizational structure

**Location**: `erp_backend/apps/hr/` + `src/app/(privileged)/hr/`

## Features
- **Employee Management**: Complete employee records with documents
- **Attendance**: Clock in/out, timesheet tracking
- **Leave Management**: Request, approve, track vacations/sick leave
- **Payroll**: Calculate wages, deductions, taxes, generate payslips
- **Performance**: Set goals, conduct reviews, track KPIs
- **Recruitment**: Job postings, applicant tracking
- **Onboarding**: Checklists for new hires
- **Documents**: Store contracts, certifications, policies
- **Org Chart**: Hierarchical organizational structure

## Models

### Employee
Core employee record.

**Key Fields**:
- `employee_number` - Unique ID
- `first_name`, `last_name` - Name
- `email`, `phone` - Contact
- `department` - Department assignment
- `job_title` - Position
- `manager` - Reporting manager
- `hire_date` - Start date
- `employment_type` - FULL_TIME, PART_TIME, CONTRACT
- `salary` - Base salary
- `pay_frequency` - WEEKLY, BIWEEKLY, MONTHLY
- `is_active` - Active status

### Attendance
Time tracking.

**Key Fields**:
- `employee` - Employee reference
- `date` - Attendance date
- `clock_in` - Clock in time
- `clock_out` - Clock out time
- `hours_worked` - Calculated hours
- `status` - PRESENT, ABSENT, LATE, HALF_DAY

### LeaveRequest
Vacation/sick leave requests.

**Key Fields**:
- `employee` - Employee requesting
- `leave_type` - VACATION, SICK, PERSONAL
- `start_date`, `end_date` - Leave period
- `days` - Number of days
- `status` - PENDING, APPROVED, REJECTED
- `approved_by` - Manager who approved
- `reason` - Leave reason

### Payroll
Payroll processing.

**Key Fields**:
- `employee` - Employee paid
- `pay_period_start`, `pay_period_end` - Period
- `base_pay` - Base salary for period
- `overtime` - Overtime pay
- `bonuses` - Bonus amounts
- `deductions` - Tax, insurance, etc.
- `net_pay` - Take-home pay
- `payment_date` - Pay date

## API Endpoints

### GET /api/hr/employees/
List employees.

### POST /api/hr/leave-requests/
Submit leave request.

### POST /api/hr/payroll/calculate/
Calculate payroll for period.

## Events Published

### `hr.employee_hired`
**Trigger**: New employee added
**Subscribers**: IT (create accounts), Finance (setup in payroll)

### `hr.leave_approved`
**Trigger**: Leave request approved
**Subscribers**: Calendar (block dates), Workforce planning

---

**Last Updated**: 2026-03-14
**Status**: Production Ready
