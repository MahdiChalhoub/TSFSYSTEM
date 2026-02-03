# Business Registration Workflow

## Goal
To provision a complete new Organization (Tenant) within the ERP system, including the initial Super Admin user, default settings, and structural isolation.

## Actors
- **Guest User**: The person registering the business.
- **Frontend System**: Next.js Application (Client & Server Action).
- **Backend System**: Django API.

## Steps
1. **Initiation**: User visits `/register/business`.
2. **Data Collection**: multiple steps collect Admin, Business, and Location data.
3. **Payload Construction**: Frontend constructs a `Multipart/Form-Data` payload including the Logo file.
4. **Transmission**: `registerBusinessAction` sends authentic request to Django `BusinessRegistrationView`.
5. **Validation (Backend)**:
   - Check if `slug` is unique.
   - Check if `admin_username` or `admin_email` are unique globally (or per system rules).
   - Validate optional fields (Website, Phone).
6. **Creation**:
   - `Organization` record created.
   - `User` (Super Admin) record created and linked to Organization.
   - Default `Site` (HQ) created.
   - Default `Role` (Owner) assigned.
   - `Logo` file saved to media storage.
7. **Response**: Backend returns `login_url` (e.g., `http://slug.domain.com/login`).
8. **Redirection**: Frontend redirects user to the new tenant context.

## Data Movement
- **Inputs**: Form Fields -> React State -> FormData -> Server Action.
- **API**: Server Action -> `POST /api/auth/register/business/` -> Django Serializer.
- **Storage**: Postgres (Organization, User tables), File System (Media/Logos).

## Tables Affected
- `erp_organization`
- `auth_user` (or Custom User table)
- `erp_employee` (if applicable)
- `erp_site`
