# Industry Vector & Currency Control

## Goal
To provide system-wide context and control over the business domain ("Industry Vector") and the "Base Currency" of an organization. This ensures that the platform adapts its terminology and financial representation based on the organization's specific needs.

## Data READ From
- **Industry Vector (Business Type)**: `saas/org-modules/business_types/`
- **Global Currencies**: `currencies/`
- **Organization Context**: `organizations/me/` (or via global organizations list)

## Data SAVED To
- **Organization Table**: `business_type_id` and `base_currency_id` columns in the `organization` table.
- **Provisioning Payload**: Included in the `org:provisioned` event sent to modules.

## Variables User Interacts With
- `business_type`: (SaaS Panel) Dropdown to select the "Industry Vector" (e.g., Luxury & Cosmetics, General Retail).
- `base_currency`: (SaaS Panel) Dropdown to select the primary operating currency (e.g., USD, EUR, LBP).

## Step-by-Step Workflow

### 1. Provisioning (SaaS Admin)
1. Navigate to **SaaS > Organizations**.
2. Click **Register Instance**.
3. Select an **Industry Vector** from the dropdown. This identifies the business vertical.
4. Select a **Base Currency**. This defines the financial context for all modules (Finance, Inventory, POS).
5. Click **Provision Now**.
6. The `ProvisioningService` saves these foreign keys and emits them in the `org:provisioned` event.

### 2. Global Identification (All Pages)
1. The `TopHeader` component fetches the active organization details.
2. If a `base_currency` is defined, a badge is displayed: `Currency: USD ($)`.
3. If an `industry_vector` is defined, a badge is displayed: `Vector: Luxury & Cosmetics`.
4. This allows users to immediately identify the context of the active tenant.

### 3. Inventory Integration
1. Navigate to **Inventory > Categories**.
2. The page fetches the current organization context.
3. A prominent Industry Vector badge is displayed in the categories header, reinforcing the business domain of the current inventory structure.

## How the System achieves its Goal
By integrating these controls at the kernel level (`Organization` model and `ProvisioningService`), the platform ensures that every module receives the correct business and financial context from the moment of creation. The frontend provides continuous visual feedback in the `TopHeader`, fulfilling the requirement to identify the currency on any page.
