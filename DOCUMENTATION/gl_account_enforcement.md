# GL Account Enforcement — Employee-Ledger Linking

## Goal
Every employee/partner must have linked GL accounts before financial transactions are processed. 
The system auto-creates the correct COA sub-accounts based on the person's type.

## COA Routing Logic

| Type | Main Account | Parent | Dividends Account | Parent |
|---|---|---|---|---|
| **EMPLOYEE** | Payable — Name | `2121 Salaries Payable` (LIABILITY) | — | — |
| **PARTNER** | Capital — Name | `3001 Capital` (EQUITY) | Dividends — Name | `3200 Dividends` (EQUITY) |
| **BOTH** | Payable — Name | `2121 Salaries Payable` | Dividends — Name | `3200 Dividends` |

## Data Flow

### Where Data is READ
- `Employee.linked_account_id` → main GL account (payroll or capital)
- `Employee.dividends_account_id` → dividends payable (partners only)
- `Employee.employee_type` → EMPLOYEE, PARTNER, or BOTH
- `EmployeeSerializer.linked_account` → `{id, code, name}` or `null`
- `EmployeeSerializer.dividends_account` → `{id, code, name}` or `null`

### Where Data is SAVED
- `POST /api/employees/` → creates employee with auto-GL based on type
- `POST /api/employees/{id}/link-gl-account/` → links GL for existing employees
- `ChartOfAccount` → new sub-accounts under 2121, 3001, or 3200
- `Employee.linked_account_id` + `Employee.dividends_account_id` updated

## Variables User Interacts With
- **Employee Type** radio selector (Employee / Partner / Both) on creation form
- **Link GL** buttons on employee cards (only shown for real employees, not standalone users)
- Green account code display when linked
- Purple dividends code for partners

## Step-by-Step Workflow

### Creating a New Employee
1. Admin opens **HR → Employees** → clicks **+ Add Employee**
2. Fills in personal info, branch, role
3. Selects **Person Category**: Employee, Partner, or Both
4. Submits form
5. Backend auto-creates correct GL sub-accounts based on type
6. Employee card shows green account code(s) immediately

### Linking GL for Existing Employees
1. Employee cards show GL account status:
   - **Green code** (e.g., `2121-0001`) = linked ✓
   - **Purple DIV code** = dividends account linked (partners) ✓
   - **Three buttons** (Employee / Partner / Both) = not yet linked
   - **N/A** = standalone user (must Complete Profile first)
2. Admin clicks the appropriate type button on a card
3. Backend creates the correct sub-accounts
4. Card refreshes to show account codes

## Files Modified

| File | Change |
|---|---|
| `apps/hr/models.py` | Added `employee_type` (EMPLOYEE/PARTNER/BOTH) + `dividends_account_id` |
| `apps/hr/views.py` | `create` + `link-gl-account` both route COA by type |
| `apps/hr/serializers.py` | Returns `linked_account` + `dividends_account` details |
| `apps/hr/migrations/0002_*` | `employee_type` field |
| `apps/hr/migrations/0003_*` | `dividends_account_id` field |
| `src/app/actions/people.ts` | `linkGLAccount(id, type)` + `createEmployee` passes type |
| `src/app/(privileged)/hr/employees/page.tsx` | Maps `employeeType`, `dividendsAccount` |
| `src/app/(privileged)/hr/employees/manager.tsx` | Type buttons + standalone guard |
| `src/app/(privileged)/hr/employees/form.tsx` | Person Category radio selector |

## API Endpoints

### `POST /api/employees/`
Creates employee with auto-GL. Body includes `employee_type`.

### `POST /api/employees/{id}/link-gl-account/`
Links GL for existing employee. Optional body: `{ "employee_type": "EMPLOYEE" | "PARTNER" | "BOTH" }`.
