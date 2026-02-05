The Core module serves as the "Spine" of the system, responsible for platform integrity checks, global settings, and essential infrastructure that doesn't belong to a specific business domain. It provides Global Coverage for security and tenant management.

## Workflow: System Integrity Verification (Core)
- **Goal**: Prevent the system from running on unsupported environments (PostgreSQL Philosophy).
- **Actors**: System Bootloader (Django `ready()` signal), `CoreService`.
- **Steps**:
    1. `apps.core.apps.CoreConfig.ready()` triggers on boot.
    2. `CoreService.verify_system_integrity()` executes.
    3. Scans `settings.DATABASES` for engine type.
    4. Validates environment variables (`APP_ENV`).
    5. If engine != PostgreSQL, `sys.exit(1)` is called immediately.
- **Data Movement**: Reads `settings.DATABASES`, `os.environ`.
- **Tables affected**: None.

## Workflow: Global Provisioning & Revocation
- **Goal**: Manage system-wide module availability and configuration.
- **Actors**: SaaS Administrator, `ModuleManager`.
- **Steps**:
    1. Administrator issues a `PUSH` or `REVOKE` command.
    2. `ModuleManager` validates the target (cannot revoke `core` or `coreplatform`).
    3. For `PUSH`: Module files are deployed and `SystemModule` registry is updated.
    4. For `REVOKE`: `OrganizationModule` records are toggled to `is_enabled=False`.
    5. Audit log is created in `SystemModuleLog` for history tracking.
- **Data Movement**: Manifest data to `SystemModule`, deployment logs to `SystemModuleLog`.
- **Tables affected**: `SystemModule`, `OrganizationModule`, `SystemModuleLog`.

- `SystemSetting`: Key-value store for global platform configurations.

## Global Operations
- **Push**: Update core settings system-wide.
- **Revoke**: Suspend non-critical features.
- **History & Rollback**: Revert configuration changes via log auditing.
- **Delete from System**: Only allowed for non-active configurations; hard-blocked for system-critical entities.
