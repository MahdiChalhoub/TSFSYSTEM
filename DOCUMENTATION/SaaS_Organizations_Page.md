# SaaS Organizations Page Documentation

## Goal
The goal of this page is to provide a master interface for managing multi-tenant company instances (Organizations) within the SaaS platform. It allows administrators to view, activate/suspend, and provision new organization instances.

## Data Management

### Data READ
- **Source**: `getOrganizations()` server action.
- **Method**: API call fetching `organization` records with counts for `sites` and `users`.

### Organization Provisioning
- **Goal**: Register a new business and setup their initial workspace.
- **Method**: Django backend registration. `BusinessRegistrationView` handles the provisioning of the organization, a default site, and an initial Chart of Accounts skeleton.

## User Interaction Variables
- `orgs`: Array of organization objects fetched from the database.
- `loading`: Boolean state for initial data fetch.
- `newOrg`: Object containing `{ name, slug }` for the registration form.
- `isCreating`: Boolean state for the provisioning process.
- `open`: Boolean state for the registration dialog.

## Step-by-Step Workflow
1. **Initial Load**: The page calls `loadData()` on mount, which invokes `getOrganizations` and updates the `orgs` state.
2. **Toggle Status**:
   - User clicks the "Suspend" or "Activate" button on an organization card.
   - `handleToggle` is called, invoking `toggleOrganizationStatus`.
   - On success, a toast is shown and data is re-fetched.
3. **Provision New Instance**:
   - User clicks "Register New Organization".
   - A dialog opens where the user enters the "Business Legal Name" and "Unique URL Slug".
   - The slug is automatically formatted (lowercase, spaces to hyphens).
   - User clicks "Provision Now".
   - `handleCreate` is called, invoking `createOrganization`.
   - The system performs a transactional setup (Org -> Site -> Chart of Accounts).
   - On success, the dialog closes, a success toast appears, and the list is updated.

## Implementation Details
- **UI Components**: Uses `Card`, `Button`, `Badge`, `Dialog`, `Input`, and `Label` (custom implementation).
- **Icons**: Uses `Building`, `Plus`, `Zap`, `Trash2` from `lucide-react`.
- **Styling**: Premium dark-mode design using Tailwind CSS with glassmorphism effects and emerald accents.
- **Optimization**: Uses `revalidatePath` in server actions to ensure fresh data after mutations.
- **Data Integrity**: Uses backend database transactions for provisioning to ensure all related records (Site, Accounts) are created atomically.
