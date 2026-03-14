# Documentation: New Module Workflow

## Goal
To provide a standardized path for adding new features (Engine mode) to the Dajingo platform without polluting the core logic (Kernel mode).

## Actors
- Developers creating business features.
- AI Agents assisting in modular development.

## Data Movement
- **Manifest**: Read by the Module Manager to register permissions and capabilities.
- **Organization Context**: Injected via headers to all module-specific API calls.

## Steps
1. **Manifest Creation**: Explicitly defines the module's metadata.
2. **Backend Isolation**: Uses the `apps/` namespace in Django.
3. **Multi-tenancy Enforcement**: Ensures every record is tied to an organization.
4. **Frontend Dynamic Mounting**: Loads the module code only when accessed.

## Tables Affected
- `erp.Organization` (Relationships)
- Module-specific tables created during migrations.

## How it achieves its goal
It enforces strict isolation between the core platform and business extensions, allowing the platform to grow indefinitely without becoming a monolith.
