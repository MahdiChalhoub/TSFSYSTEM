# Auth Portal Documentation

## Overview
The Auth Portal provides a unified tactical interface for user authentication, employee registration, and business founding (SaaS provisioning). It is designed with a premium "Vantage OS" aesthetic, featuring glassmorphism, ambient background elements, and robust validation feedback.

## Pages

### 1. Landing Page (`/landing/page.tsx`)
**Goal:** Direct users to the correct tactical entry point (Login, Signup, or Founding).
**Read Data From:**
- `checkWorkspace` (Server Action): Verifies existence of a tenant slug.
**Save Data To:**
- Redirection to tenant-specific domains or sub-routes.
**User Interactions:**
- Mode switching (Login, Signup, Founder).
- Workspace ID discovery/input.
- Business Name & Slug input (for founding).
**Workflow:**
1. User selects a mode.
2. If Login/Signup: User enters Workspace ID -> System verifies existence -> Redirects to `subdomain.domain/login`.
3. If Founder: User enters Business Name -> System sluggifies and checks uniqueness -> Redirects to `/register/business`.
4. Handles duplicate slug suggestions using `generateSuggestions`.

### 2. Login Page (`/(auth)/login/page.tsx`)
**Goal:** Authenticate personnel into their specific operational instance.
**Read Data From:**
- `getPublicConfig` (Server Action): Fetches tenant logo, name, and operational sites.
- `loginAction` (Server Action): Authenticates credentials against Django.
**Save Data To:**
- `auth_token` cookie: Session management.
**User Interactions:**
- Personnel ID (Username) input.
- Security Key (Password) input.
- Operational Base (Site) selection.
**Workflow:**
1. System resolves tenant from Host header.
2. User enters credentials.
3. `loginAction` validates with Django.
4. If successful, sets `auth_token` and redirects to `/admin`.
5. If failure (e.g., Pending Approval), displays specific tactical error messages.

### 3. User Registration Page (`/(auth)/register/user/page.tsx`)
**Goal:** Enable new personnel to request system access.
**Read Data From:**
- `getPublicConfig`: Fetches public roles marked as `is_public_requestable`.
**Save Data To:**
- Django `User` (Status: PENDING) and `Employee` records.
**User Interactions:**
- Name, Email, Username, Password.
- Requested Role selection (filtered by public status).
- Personal details (Phone, DOB).
**Workflow:**
1. User fills registration form.
2. `registerUserAction` sends data to Django.
3. Django creates a PENDING user (inactive).
4. Page displays "Enlistment Submitted" and instructs user to wait for admin authorization.

### 4. Business Founding Page (`/(auth)/register/business/page.tsx`)
**Goal:** Initialize a new autonomous enterprise federation.
**Read Data From:**
- `getPublicConfig`: Fetches business types and currencies.
**Save Data To:**
- Django `Organization`, `Site`, `Role` (Super Admin), `User` (Admin), and `Employee`.
**User Interactions:**
- Business Industry, Currency, Contact Email.
- Workspace Slug (ID).
- Super Admin credentials.
**Workflow:**
1. User provides enterprise parameters.
2. `registerBusinessAction` triggers backend provisioning engine.
3. Django creates the entire organizational hierarchy.
4. Success state redirects to the new workspace's login panel.

## Error Handling Standards
- **Duplicate Collision:** Slug conflicts during founding trigger automated suggestions.
- **Pending Authorization:** Login attempts by unapproved users are met with a "Security Clearance Required" status.
- **Uplink Failure:** JSON-structured errors from the backend are parsed and displayed as tactical alerts with Lucide iconography.
