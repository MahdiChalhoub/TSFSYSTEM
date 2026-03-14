# HR Frontend Pages Documentation

## Overview
Four frontend pages for the HR module, linked from the sidebar under the HR section.

## Pages

### 1. Departments (`/hr/departments`)

**Goal**: Manage organizational hierarchy — create, edit, delete departments with parent-child relationships.

**Data Read From**: `GET /api/departments/` and `GET /api/employees/`

**Data Saved To**: `POST/PATCH/DELETE /api/departments/`

**Variables User Interacts With**:
- name (text), code (text), parent department (select), manager (select from employees)

**Workflow**:
1. Page loads all departments and employees
2. Stats cards show Total, Active, Root departments
3. Hierarchical tree renders departments with indentation by parent
4. User can add/edit/delete departments via inline form
5. Manager badges and parent breadcrumbs shown on each card

**Design**: Violet accent, hierarchical tree layout, `Building2` icon

---

### 2. Shifts (`/hr/shifts`)

**Goal**: Define work shifts with time windows and break durations for scheduling.

**Data Read From**: `GET /api/shifts/`

**Data Saved To**: `POST/PATCH/DELETE /api/shifts/`

**Variables User Interacts With**:
- name (text), start_time (time), end_time (time), break_duration_minutes (number)

**Workflow**:
1. Page loads all shifts
2. Stats cards show Total, Morning, Night shift counts
3. Card grid displays each shift with start/end/break info
4. User can add/edit/delete shifts via inline form

**Design**: Amber accent, card grid layout, `Clock`/`Sun`/`Moon` icons

---

### 3. Attendance (`/hr/attendance`)

**Goal**: Track employee check-in/check-out with real-time on-site monitoring.

**Data Read From**: `GET /api/attendance/`, `GET /api/employees/`, `GET /api/shifts/`

**Data Saved To**: `POST /api/attendance/`, `POST /api/attendance/{id}/check-in/`, `POST /api/attendance/{id}/check-out/`

**Variables User Interacts With**:
- employee (select), shift (select), date (date), check-in/check-out buttons

**Workflow**:
1. Page loads attendance records, employees, and shifts
2. Stats cards show Total Records, Today's count, On-site Now
3. Table displays records with status (Pending → On-site → Completed)
4. Filter tabs: Today / All Records
5. User clicks "Check In" then "Check Out" buttons per row
6. New records created via form with employee, shift, and date

**Design**: Emerald accent, table layout, `Fingerprint`/`LogIn`/`LogOut` icons

---

### 4. Leave Requests (`/hr/leaves`)

**Goal**: Submit, review, approve, or reject employee leave applications.

**Data Read From**: `GET /api/leaves/`, `GET /api/employees/`

**Data Saved To**: `POST /api/leaves/`, `POST /api/leaves/{id}/approve/`, `POST /api/leaves/{id}/reject/`

**Variables User Interacts With**:
- employee (select), leave_type (select: ANNUAL/SICK/MATERNITY/PATERNITY/UNPAID/COMPENSATORY/OTHER)
- start_date (date), end_date (date), reason (textarea)
- Approve/Reject buttons for pending requests

**Workflow**:
1. Page loads all leave requests and employees
2. Stats cards show Total, Pending, Approved, Rejected counts
3. Filter tabs: All, Pending, Approved, Rejected
4. Card list displays each request with employee name, leave type badge, date range, status
5. Pending requests show Approve (green) and Reject (rose) action buttons

**Design**: Rose accent, card list layout, `CalendarOff` icon

---

## Server Actions

**File**: `src/app/actions/hr.ts`

| Function | HTTP | Endpoint |
|----------|------|----------|
| `getDepartments()` | GET | `departments/` |
| `createDepartment(data)` | POST | `departments/` |
| `updateDepartment(id, data)` | PATCH | `departments/{id}/` |
| `deleteDepartment(id)` | DELETE | `departments/{id}/` |
| `getShifts()` | GET | `shifts/` |
| `createShift(data)` | POST | `shifts/` |
| `updateShift(id, data)` | PATCH | `shifts/{id}/` |
| `deleteShift(id)` | DELETE | `shifts/{id}/` |
| `getAttendance()` | GET | `attendance/` |
| `createAttendance(data)` | POST | `attendance/` |
| `checkIn(id)` | POST | `attendance/{id}/check-in/` |
| `checkOut(id)` | POST | `attendance/{id}/check-out/` |
| `getLeaves()` | GET | `leaves/` |
| `createLeave(data)` | POST | `leaves/` |
| `approveLeave(id)` | POST | `leaves/{id}/approve/` |
| `rejectLeave(id)` | POST | `leaves/{id}/reject/` |
