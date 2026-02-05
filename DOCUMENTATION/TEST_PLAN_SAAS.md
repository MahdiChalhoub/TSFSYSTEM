# SaaS Foundation Test Plan

This plan outlines how to verify the Hybrid SaaS Architecture (Next.js + Django + PostgreSQL).

## 1. Database Initialization
- [ ] **Frontend Environment**: 
    - Verify `.env.local` or `.env.production` has correct `DATABASE_URL` if needed, although primary data is via `erpFetch`.
- [ ] **Django (ERP Core)**:
    - Ensure `erp_backend/core/settings.py` has the correct `DATABASES` config.
    - Run `cd erp_backend ; python manage.py makemigrations erp ; python manage.py migrate`.

## 2. Multi-Tenant Seeding
- [ ] **Trigger Seeder**: Run the `seedTestData` action (accessible via the Admin Setup page).
- [ ] **Verify Linkage**: 
    - Open database and check that `Organization` "TSF Global" exists.
    - Check that `Products` and `Sites` have a non-null `organizationId` pointing to "TSF Global".

## 3. SaaS Control Panel Functional Test
- [ ] **Navigate to SaaS Panel**: Go to `http://localhost:3000/admin/saas/organizations`.
- [ ] **Create New Tenant**: Use the "Register New Organization" button.
- [ ] **Suspend/Activate**: Toggle the status of an organization and verify it persists in the DB.

## 4. API Gateway Proxy Bridge
- [ ] **Run Django Server**: `cd erp_backend ; python manage.py runserver 8000`.
- [ ] **Test Proxy Route**: 
    - Use Postman or a simple `fetch` or `curl` on `http://localhost:3000/api/erp/proxy/some-endpoint`.
    - Verify that the request is successfully forwarded to Django and returns a response.

## 5. Tenant Isolation (Row Level)
- [ ] **Data Leak Check**:
    - Log in as a User from "Org A".
    - Try to fetch records (e.g., Products) from "Org B" via API.
    - Expected Result: 403 Forbidden or empty set (depending on implementation).
