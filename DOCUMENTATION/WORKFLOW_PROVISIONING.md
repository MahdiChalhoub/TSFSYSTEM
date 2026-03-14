# Provisioning Workflow

## Goal
To initialize a fully functional multi-tenant organization in the ERP system. This includes setting up the legal entity, physical sites, fiscal periods, a standardized chart of accounts, and financial posting rules.

## Actors
- **SaaS Control Plane (Next.js)**: Triggers the provisioning via API when a new organization is created.
- **Django Provisioning Engine**: Executes the database logic to create the tenant skeleton.

## Steps
1.  **Organization Creation**: A new `Organization` record is created with a unique slug and UUID.
2.  **Site Initialization**: A 'Main Branch' `Site` is created as the default physical location.
3.  **Fiscal Infrastructure**: 
    - A `FiscalYear` is created for the current calendar year.
    - 12 `FiscalPeriod` records (months) are generated.
4.  **Chart of Accounts (COA) Deployment**:
    - Root accounts (ASSETS, LIABILITIES, etc.) are created.
    - Standard operational accounts (Inventory, AR, AP, Cash, Revenue, COGS) are seeded with specific codes.
5.  **Financial Account Setup**:
    - A "Cash Drawer" `FinancialAccount` is created and linked to the Ledger.
    - A "Main Bank" `FinancialAccount` is created.
6.  **Posting Rules Mapping**: 
    - The `ConfigurationService` scans the COA and maps the operational accounts to "Global Financial Settings" and "Posting Rules".
7.  **Warehouse Creation**: A "Main Warehouse" is created for the default site.

## Data Movement
- **Input**: `name`, `slug` from the Frontend.
- **Read**: Standard COA templates and global defaults.
- **Save**: Multiple records across: `Organization`, `Site`, `FiscalYear`, `FiscalPeriod`, `ChartOfAccount`, `FinancialAccount`, `SystemSettings`, `Warehouse`.

## Tables Affected
- `Organization`
- `Site`
- `FiscalYear`
- `FiscalPeriod`
- `ChartOfAccount`
- `FinancialAccount`
- `SystemSettings`
- `Warehouse`

## How it achieves its goal
By automating the complex setup of accounting and infrastructure, it ensures that every new tenant is "ready to trade" immediately without manual configuration, while maintaining strict data isolation via the `organization_id` foreign key.
