# Database Table: User

## Table Purpose
Handles authentication, identity, and organizational belonging for all personnel in the federation. Supports multi-tenancy by isolating users within organizations.

## Columns
- `id`: UUID (Primary Key)
- `username`: String (Unique globally)
- `email`: String
- `password`: Hashed String
- `first_name`: String
- `last_name`: String
- `organization_id`: UUID (FK to Organization, Null for SaaS Admin)
- `role_id`: Integer (FK to Role)
- `home_site_id`: Integer (FK to Site)
- `is_active`: Boolean
- `is_staff`: Boolean (Access to internal systems)
- `is_superuser`: Boolean (Full global control)
- `registration_status`: Enum ('PENDING', 'APPROVED', 'REJECTED')
- `created_at`: DateTime
- `updated_at`: DateTime

## Relationships
- **Belongs to**: `Organization` (Many-to-One)
- **Assigned to**: `Role` (Many-to-One)
- **Home Base**: `Site` (Many-to-One)
- **Work History**: `Employee` record (One-to-One)

## Which Pages Read From It
- `/(auth)/login/page.tsx`: Verifies credentials.
- `/admin/layout.tsx`: Fetches profile for TopHeader display.
- `/admin/saas/organizations/page.tsx`: Counts users per organization.
- `/admin/settings/users/page.tsx`: Lists and manages enterprise users.

## Which Pages Write To It
- `/(auth)/register/business/page.tsx`: Creates Owner (Super Admin).
- `/(auth)/register/user/page.tsx`: Creates new applicant (PENDING status).
- `/admin/settings/users/page.tsx`: Managerial profile updates.
- `/admin/saas/users/page.tsx`: Global staff management.
