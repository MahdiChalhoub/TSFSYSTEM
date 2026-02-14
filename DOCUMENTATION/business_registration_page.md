# Business Registration Page

## Goal
Allow new users to self-register a business (Organization) through a multi-step form. This creates the Organization, an Admin User, and a SaaS Client record.

## Data Flow

### READ
- **`GET /api/auth/config/`** — Fetches `BusinessType` (Industry Vector) and `GlobalCurrency` (Monetary Standard) lists for dropdown selection.
  - Source tables: `BusinessType`, `GlobalCurrency`

### WRITE
- **`POST /api/auth/register/business/`** — Creates Organization, Admin User, SaaSClient, and CRM Contact.
  - Target tables: `Organization`, `User`, `SaaSClient`, `Role`, `Contact` (CRM sync)

## Variables User Interacts With

### Step 1: Admin Setup
| Variable | Field Name | Required |
|----------|-----------|----------|
| First Name | `admin_first_name` | Yes |
| Last Name | `admin_last_name` | Yes |
| Username | `admin_username` | Yes |
| Email | `admin_email` | Yes |
| Password | `admin_password` | Yes (min 8 chars) |

### Step 2: Business Identity
| Variable | Field Name | Required |
|----------|-----------|----------|
| Business Name | `business_name` | Yes |
| Slug | `slug` | Yes (auto-generated from name) |
| Industry Vector | `business_type_id` | Yes (validated on Next click) |
| Currency | `currency_id` | No (defaults to id=1) |

### Step 3: Location & Intel
| Variable | Field Name | Required |
|----------|-----------|----------|
| Logo | `logo` | No (file upload) |
| Website | `website` | No |
| Business Email | `email` | Yes |
| Phone | `phone` | No |
| Address | `address` | No |
| City | `city` | No |
| Zip Code | `zip_code` | No |
| Country | `country` | No |
| State | `state` | No |

## Step-by-Step Workflow

1. User navigates to `/register/business`
2. Frontend calls `getPublicConfig()` → `GET /api/auth/config/` to populate dropdowns
3. User fills Step 1 (Admin credentials) → clicks Next
4. User fills Step 2 (Business name, slug, industry, currency) → clicks Next
5. User fills Step 3 (Location, logo, contact info) → clicks "Establish Global Federation"
6. Frontend `registerBusinessAction` sends FormData to `POST /api/auth/register/business/`
7. Backend validates via `BusinessRegistrationSerializer`
8. Backend provisions Organization, sets all fields (including `business_type`, `base_currency`)
9. Backend creates SaaSClient, Admin User with "Admin" role
10. Backend returns `{ login_url, token, user, organization }`
11. Frontend redirects to `login_url` (e.g., `/acme-corp/login`)

## How the Page Achieves Its Goal

The page uses a multi-step form with React state to manage navigation between steps. The form is wrapped in a Next.js Server Action (`registerBusinessAction`) that:
- Builds a `FormData` payload with all fields
- Sends it to the Django backend via `erpFetch`
- Handles error responses with field-level error display
- On success, redirects to the new workspace's login page

The backend `register_business_view` uses Django's `transaction.atomic()` to ensure all-or-nothing creation of Organization + User + Client records.
