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
- `POST /api/employees/{id}/link-gl-account/` with optional `{ "employee_type": "..." }`
- `ChartOfAccount` — new sub-accounts under 2121, 3001, or 3200
- `Employee.linked_account_id` + `Employee.dividends_account_id` updated

## Step-by-Step Workflow

1. Admin opens **HR → Employees**
2. Employee cards show GL account status:
   - **Green code** (e.g., `2121-0001`) = linked ✓
   - **Purple DIV code** = dividends account linked (partners) ✓
   - **Three buttons** (Employee / Partner / Both) = not yet linked
3. Admin clicks the appropriate type button on a card
4. Server action calls `POST /api/employees/{id}/link-gl-account/`
5. Backend creates the correct sub-accounts based on type
6. Employee record updated with account IDs
7. Card refreshes to show green account code + type badge

## Files Modified

| File | Change |
|---|---|
| `apps/hr/models.py` | Added `employee_type` (EMPLOYEE/PARTNER/BOTH) + `dividends_account_id` |
| `apps/hr/views.py` | `link-gl-account` routes to correct COA section by type |
| `apps/hr/serializers.py` | Returns `linked_account` + `dividends_account` details |
| `apps/hr/migrations/0002_*` | `employee_type` field |
| `apps/hr/migrations/0003_*` | `dividends_account_id` field |
| `src/app/actions/people.ts` | `linkGLAccount(id, type)` server action |
| `src/app/(privileged)/hr/employees/page.tsx` | Maps `employeeType`, `dividendsAccount` |
| `src/app/(privileged)/hr/employees/manager.tsx` | 3 type-selector buttons + dividends display |

## API Endpoint

### `POST /api/employees/{id}/link-gl-account/`
- **Body** (optional): `{ "employee_type": "EMPLOYEE" | "PARTNER" | "BOTH" }`
- **Response**: `{ "message": "...", "linked_account_id": 42, "linked_account_code": "2121-0001", "dividends_account_id": 43, "dividends_account_code": "3200-0001", ... }`
- **Error**: `400` if already linked, `503` if Finance module unavailable
