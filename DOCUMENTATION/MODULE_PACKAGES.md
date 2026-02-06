# Package Storage Center Module

## Goal
Centralized package management system for uploading, storing, and deploying kernel/frontend/module packages.

## Module Files

### Backend (`erp_backend/apps/packages/`)
| File | Purpose |
|------|---------|
| `manifest.json` | Module metadata and permissions |
| `apps.py` | Django app configuration |
| `models.py` | `PackageUpload` model (tracks uploaded packages) |
| `views.py` | API ViewSet for CRUD and deployment |
| `serializers.py` | DRF serializers |
| `deployer.py` | Atomic deployment service |
| `urls.py` | URL routing |

### Frontend (`src/modules/packages/`)
| File | Purpose |
|------|---------|
| `manifest.json` | Frontend module config |
| `page.tsx` | React UI component |

## Data Flow

### READ
- `PackageUpload` table - list all uploaded packages

### WRITE
- `PackageUpload` table - create on upload, update on deploy/rollback

## API Endpoints

| Endpoint | Method | Action |
|----------|--------|--------|
| `/api/packages/` | GET | List packages |
| `/api/packages/upload/` | POST | Upload package |
| `/api/packages/{id}/apply/` | POST | Deploy package |
| `/api/packages/{id}/rollback/` | POST | Rollback deployment |
| `/api/packages/{id}/schedule/` | POST | Schedule deployment |
| `/api/packages/stats/` | GET | Get statistics |

## Package Types
- `kernel` - Backend Django kernel updates
- `frontend` - Next.js frontend updates
- `module` - Business module packages

## Export Command
```bash
python manage.py export_module packages --output ../releases
```
Outputs: `releases/packages_1.0.0.modpkg.zip`
