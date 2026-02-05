The Core module serves as the "Spine" of the system, responsible for platform integrity checks, global settings, and essential infrastructure that doesn't belong to a specific business domain. It provides Global Coverage for security and tenant management.

## Workflow: System Integrity Verification
- **Goal**: Prevent the system from running on unsupported environments.
- **Actors**: System Bootloader (Django `ready()` signal).
- **Steps**:
    1. `apps.core.apps.CoreConfig.ready()` triggers.
    2. `CoreService.verify_system_integrity()` executes.
    3. Checks `DATABASES` engine (must be PostgreSQL).
    4. If failure, `sys.exit(1)` to block start.
- **Data Movement**: Reads `settings.DATABASES`.
- **Tables affected**: None.

- `SystemSetting`: Key-value store for global platform configurations.

## Global Operations
- **Push**: Update core settings system-wide.
- **Revoke**: Suspend non-critical features.
- **History & Rollback**: Revert configuration changes via log auditing.
- **Delete from System**: Only allowed for non-active configurations; hard-blocked for system-critical entities.
