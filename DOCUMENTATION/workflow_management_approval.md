# Management Approval Workflow

## Goal
The goal of this workflow is to provide organization administrators (Managers/Tenant Owners) with a secure, centralized terminal to review, validate, and authorize new user registrations. It ensures that no user can gain access to an organization's sensitive ERP data without manual verification.

## Actors
1. **New User**: Registers via the onboarding flow; their account remains locked (`is_active=False`) until approved.
2. **Manager / Org Admin**: Reviews pending requests and decides on the outcome (Approve, Reject, or Correction).

## Step-by-Step Workflow
1. **Registration**: A user completes the sign-up form. A `User` record is created with `registration_status='PENDING'` and `is_active=False`.
2. **Review**: The Manager navigates to `/admin/users/approvals`. 
3. **Data Loading**: The page calls `fetchPendingUsers()` which retrieves all `PENDING` and `NEEDS_CORRECTION` users for the current organization.
4. **Approve**: If the Manager clicks "Approve", a request is sent to the backend. The user's status becomes `APPROVED` and `is_active` becomes `True`, enabling immediate system access.
5. **Correction**: If information is missing, the Manager clicks "Request Correction". A modal prompts for notes. The user status becomes `NEEDS_CORRECTION` and the provided instructions are saved to `correction_notes`.
6. **Reject**: If the request is fraudulent or incorrect, the Manager rejects the user, setting status to `REJECTED`.

## Data Movement
- **READ**: 
  - `User` table: Fetches identity, email, and registration status.
  - `Employee` table: Fetches contact details (Phone, Nationality) linked via `User`.
- **WRITE**:
  - `User.registration_status`: Updates based on decision.
  - `User.is_active`: Bitwise toggle for system access.
  - `User.correction_notes`: Stores management feedback for the user.

## Affected Tables
- **User** (`erp.models.User`): Primary identity table.
- **Employee** (`erp.models.Employee`): Supplemental HR data table.

## Security Compliance
- **Rule 2 Security**: All validation happens server-side in `views_manager.py`.
- **Rule 10 Security**: Authorization checks are performed on the server; managers can only see users matching their own `organization_id`.
- **Rule 1 Security**: Authentication is mandatory for the Management Terminal.
