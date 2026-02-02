# Workflow: Server Startup

- **Goal**: Successfully initialize and run both the Next.js frontend and Django backend servers for the TSF ERP system.
- **Actors**: System Administrator / Developer.
- **Steps**:
    1. **Initialize Backend**: Navigate to `/erp_backend` and execute `python manage.py runserver`.
    2. **Initialize Frontend**: From the root directory, execute `npm run dev`.
    3. **Health Check**: Verify `http://localhost:8000/api/health/` returns a 200 OK and `http://localhost:3000` is accessible.
- **Data Movement**: The Next.js frontend sends API requests to the Django backend (port 8000) using the `erpFetch` utility.
- **Tables Affected**: N/A (Server startup phase).

## Maintenance Log (Fix applied on 2026-02-02)
- **Issue**: Django server failed to start due to missing `RoleViewSet` and `transaction` imports in `erp/views.py`.
- **Resolution**:
    - Added `from django.db import transaction` to `erp/views.py`.
    - Implemented `RoleViewSet` in `erp/views.py` to match `urls.py` expectations.
- **Verification**: `python manage.py runserver` now executes without errors.
