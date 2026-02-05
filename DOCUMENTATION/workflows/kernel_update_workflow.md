# Workflow: System Kernel (OS) Update

## Goal
Update the core platform infrastructure (Security, API Center, Connector Engine) globally using a unified ZIP package.

## Actors
- **SaaS Platform Admin**: Executes the update via the **Kernel Updates** panel.
- **Kernel Manager**: The backend authority that validates and applies the update.

## Steps
1. **Preparation**: A new version of the platform is packaged as `vX.X.X.kernel.zip`.
2. **Upload**: The Admin uploads the ZIP in the **Kernel Updates** UI.
3. **Staging**: The system extracts the ZIP to a temporary directory and verifies its integrity and version compatibility.
4. **Application**: Upon Admin confirmation, the Kernel:
    - Overwrites core files in the system root (protected zones).
    - Runs any necessary global schema migrations.
    - Updates the System Registry with the new version.
5. **Success**: The platform is instantly upgraded. Modules remain isolated and continue to function through the Connector.

## Critical Notes
- **ZIP Only**: No `git pull` is required on the server. The ZIP package contains all code needed.
- **Global Impact**: Unlike module updates, a Kernel update affects the entire platform and all organizations.
- **Self-Healing**: The process uses atomic staging to ensure the system never enters an inconsistent state.
