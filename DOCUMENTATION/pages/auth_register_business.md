# Business Registration Page

## Goal
To allow new business owners to register their organization in the Vantage OS federation, establishing a new tenant with a dedicated subdomain and super admin account.

## Data Sources
- **READ**: 
  - `getPublicConfig()` from `onboarding.ts` (fetches Business Types and Currencies).
  - User Input (Form Data).
- **WRITE**: 
  - `registerBusinessAction` (Server Action) -> Django Backend (`/api/auth/register/business/`).

## Interactive Variables
- **Administrator Details**: First Name, Last Name, Username, Email, Password.
- **Business Identity**: Business Name, Slug (subdomain), Industry Vector (Business Type), Currency.
- **Infrastructure**: Logo (Image), Website (URL), Phone, Address, City, Zip Code, Country, State.

## Workflow
1. **Admin Setup (Step 1)**: User provides personal credentials for the Super Admin account.
2. **Business Identity (Step 2)**: User defines the business name and subdomain. Passwords and basic info are validated locally.
3. **Location & Intel (Step 3)**: User uploads branding (Logo) and provides physical location details.
4. **Submission**: All data is aggregated into a `FormData` object (to support file upload) and sent to the server action.
5. **Provisioning**: On success, the backend provisions the tenant and returns a `login_url`.
6. **Redirection**: The user is shown a success animation and redirected to their new tenant login page.

## Key Features
- **Multi-Step Wizard**: Broken down into 3 logical steps for better UX.
- **Visual Feedback**: Ribbon stepper and dynamic validation errors.
- **File Upload**: Supports Logo upload via `FormData`.
- **Validation**: Fields like Website and Phone are optional but validated if provided.
- **Controlled Select Components**: Business Type and Currency use React state (`businessTypeId`, `currencyId`) to avoid HTML5 validation issues with hidden fields in multi-step forms.

## Technical Notes
- **Select Validation Fix (v1.2.8-b720)**: The `business_type_id` and `currency_id` Select components use controlled state instead of HTML5 `required` attribute. This prevents the "invalid form control is not focusable" browser error that occurs when required hidden fields exist in multi-step forms.
