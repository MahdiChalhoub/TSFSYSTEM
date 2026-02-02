# Tenant Dashboard Page

## Goal
The goal of this page is to serve as the entry point for the Tenant Dashboard. Currently, it redirects all users to the `/admin` interface, which serves as the unified dashboard for the application.

## Data Source
- None (Redirects immediately)

## Data Destination
- Redirects to `/admin`

## User Interaction
- None. The user is automatically redirected.

## Workflow
1. User navigates to `/tenant/[slug]/dashboard` (or is redirected there after login).
2. The page component executes and calls `redirect('/admin')`.
3. The user lands on the Admin Dashboard (`c:\tsfci\src\app\admin\page.tsx`).

## Reason for Redirection
The application uses a unified Admin interface (`/admin`) that adapts to the tenant context (Organization). Instead of maintaining a separate dashboard view, we reuse the robust Admin panel.
