# Workflow: Independent Module Update (Windows-Style)

## Goal
Update a specific business module (e.g., Finance) without taking the system down or modifying the Kernel.

## Actors
- **Developer**: Prepares the module ZIP.
- **SaaS Admin**: Uploads the ZIP via the platform UI.
- **Module Manager (Kernel)**: Replaces files and applies migrations.

## Steps
1. **Preparation**: Developer generates a `.modpkg.zip` containing the new backend `apps/[code]` and frontend `frontend/` files.
2. **Upload**: Admin navigates to "Global Registry" -> "Upload Module".
3. **Integrity Check**: Kernel verifies `manifest.json` and checksum.
4. **Staging**: Kernel extracts ZIP to a temporary folder.
5. **Isolation Deploy**:
    - Backend files moved to `/apps/[code]`.
    - Frontend files moved to `/src/modules/[code]`.
6. **Persistence**: Kernel runs `call_command('migrate')`.
7. **Registry Update**: `SystemModule` record is updated with new version.
8. **Replay**: `ConnectorEngine` replays any buffered requests that occurred during the brief swap.

## Data Movement
- **Source**: Client Browser (ZIP upload).
- **Processing**: Django Backend.
- **Destination**: Filesystem (Isolation Zones) + PostgreSQL (Registry).
