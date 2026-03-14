# Package Storage & Deployment Center

## Goal
Unified cloud storage and deployment system for uploading, managing, and deploying kernel (backend/frontend) and module packages. Features progress tracking, package vault history, and scheduled deployment.

## Data Sources
- **READ**: 
  - `GET /api/packages/` - List all packages
  - `GET /api/packages/{id}/` - Package details
  - `GET /api/packages/stats/` - Deployment statistics
- **WRITE**: 
  - `POST /api/packages/upload/` - Upload package
  - `POST /api/packages/{id}/apply/` - Apply package
  - `POST /api/packages/{id}/schedule/` - Schedule deployment
  - `POST /api/packages/{id}/rollback/` - Rollback to backup
  - `DELETE /api/packages/{id}/` - Delete package

## Interactive Variables
- **Package Type**: kernel, frontend, module
- **Package Status**: uploading, ready, scheduled, applying, applied, failed, rolled_back
- **Scheduled For**: Optional datetime for scheduled deployment

## Workflow
1. **Upload**: Drag-drop ZIP onto upload zone → progress tracked → stored in vault
2. **Review**: View package details, changelog, version in vault table
3. **Apply**: Click "Apply" → atomic swap with backup → post-deploy hooks (migrations/restart)
4. **Rollback**: Click "Rollback" → restore from backup

## Package Types

| Type | Extension | Contents | Post-Deploy |
|------|-----------|----------|-------------|
| Backend Kernel | `.kernel.zip` | `erp/`, `manage.py`, `update.json` | Django migrations |
| Frontend Kernel | `.frontend.zip` | `.next/`, `public/`, `frontend_update.json` | PM2 restart |
| Module | `.module.zip` | `apps/{module}/`, `manifest.json` | Module registration |

## Key Features
- **Chunked Upload**: Large file support with progress bar
- **Package Vault**: Historical record of all uploaded packages
- **Atomic Swap**: Deploy with automatic backup and rollback capability
- **Scheduled Deployment**: Choose when to apply (maintenance windows)
- **Zero SSH**: No server access required for deployment

## Packaging Commands

```powershell
# Package backend kernel
.\package_kernel.ps1 -Version "1.2.9"

# Package frontend kernel  
.\package_frontend_kernel.ps1 -Version "1.2.9"
```
