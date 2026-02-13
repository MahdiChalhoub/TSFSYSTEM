# GL Account Enforcement — Employee-Ledger Linking

## Goal
Every employee (and partner) must be linked to a General Ledger account before any financial transactions (payroll, dividends) can be processed.

## Data Flow

### Where Data is READ
- `Employee.linked_account_id` — references `ChartOfAccount.id`
- `EmployeeSerializer.linked_account` — returns `{id, code, name}` or `null`

### Where Data is SAVED
- `POST /api/employees/{id}/link-gl-account/` — auto-creates and links GL account
- `ChartOfAccount` — new sub-account created under parent `2200`
- `Employee.linked_account_id` — updated with new account ID

## Variables User Interacts With
- **Link GL** button on employee cards (red warning when missing)
- Green account code display when linked

## Step-by-Step Workflow

1. Admin opens **HR → Employees**
2. Employee cards show ledger account status:
   - **Green code** (e.g., `2200-0001`) = linked ✓
   - **Red "Link GL" button** with ⚠ icon = not linked
3. Admin clicks **Link GL** on a card
4. Server action calls `POST /api/employees/{id}/link-gl-account/`
5. Backend auto-creates sub-account under `2200 Accrued Payroll & Salaries`
6. Employee record updated with `linked_account_id`
7. Card refreshes to show green account code

## How the Page Achieves Its Goal
- **Visual warning**: Red `AlertTriangle` icon + "Link GL" button replaces the old gray "NO-GL" text
- **One-click fix**: Clicking "Link GL" auto-creates the correct payroll liability sub-account
- **Enforcement**: The `linked_account_id` is checked before any payroll transaction

## Files Modified

| File | Change |
|---|---|
| `apps/hr/views.py` | Added `link-gl-account` action on EmployeeViewSet |
| `apps/hr/serializers.py` | Added `linked_account` SerializerMethodField with code/name |
| `src/app/actions/people.ts` | Added `linkGLAccount()` server action |
| `src/app/(privileged)/hr/employees/manager.tsx` | Red GL warning + one-click Link GL button |

## API Endpoint

### `POST /api/employees/{id}/link-gl-account/`
- **Access**: Authenticated users
- **Response**: `{ "message": "...", "linked_account_id": 42, "linked_account_code": "2200-0001", "linked_account_name": "Payable to John Smith" }`
- **Error**: `400` if already linked, `503` if Finance module unavailable
