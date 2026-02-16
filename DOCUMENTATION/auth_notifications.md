# Phase 5: Auth & Notifications Documentation

This module covers the advanced authentication workflows and real-time notification system.

## 1. Registration Approval Workflow
Goal: Ensure only legitimate businesses can join the platform.

### Workflow
- **Data Read**: `Organization`, `User` (registration_status).
- **Data Saved**: `User` (registration_status, is_active), `Notification`.
- **Actors**: New Business Owner, SaaS Administrator.

1. **Submission**: User signs up via `/register`. `registration_status` is set to `PENDING`. `is_active` is `True` (to allow initial login but with limited access) or `False` (blocking access).
   - In our current implementation, we set `is_active=True` but the middleware/frontend will gate features based on `registration_status`.
2. **Review**: SaaS Admin accesses `/saas/organizations/registrations`.
3. **Action**: 
   - **Approve**: Sets status to `APPROVED`. Creates a `SUCCESS` notification for the user.
   - **Reject**: Sets status to `REJECTED`. Sets `is_active=False`.
   - **Correction**: Sets status to `CORRECTION_NEEDED`. User is notified to update details.

## 2. Forgot Password Flow
Goal: Secure self-service password recovery.

### Workflow
- **Data Read**: `User` (email).
- **Data Saved**: `User.password`.

1. **Request**: User enters email on `/forgot-password`.
2. **Token**: Backend generates a base64 UID and a secure token using Django's `default_token_generator`.
3. **Email**: (Logical) Link sent to user: `/reset-password?uid={uid}&token={token}`.
4. **Reset**: User enters new password on `/reset-password`. Backend verifies token before updating password.

## 3. Notification System
Goal: Real-time alerts for system events and transactional updates.

### Workflow
- **Data Read**: `Notification` model.
- **Data Saved**: `Notification` model (read_at).

- **Triggers**: Automated creation during business events (Approval, Rejection, Overrides).
- **Delivery**: Bell icon in `TopHeader` polls the `/api/notifications/` endpoint.
- **Interaction**: Users can mark individual items as read or mark all at once.

## 4. Role & Permission Builder
Goal: Granular access control for organizations.

### Workflow
- **Data Read**: `Role`, `Permission`.
- **Data Saved**: `Role.permissions` (M2M Link).

1. **Selection**: Admin chooses a Role from the side panel.
2. **Matrix**: UI displays a list of all system permissions grouped by module.
3. **Assignment**: Clicking a permission checkbox immediately updates the M2M link in the database via `/api/roles/{id}/`.

---

## Database Schema: Notification
| Column | Type | Purpose |
|--------|------|---------|
| user | ForeignKey(User) | Recipient |
| title | Char(255) | Alert headline |
| message | TextField | Detail content |
| type | Choice | INFO, SUCCESS, WARNING, ERROR |
| read_at | DateTime | Read tracking |
| created_at | DateTime | Sorting |
