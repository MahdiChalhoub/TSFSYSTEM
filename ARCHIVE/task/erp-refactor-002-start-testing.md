# Task: start server to start test
Module: ERP Refactor
Status: IN_PROGRESS

## Description
Start the hybrid environment (Next.js + Django) and prepare for testing the multi-tenant SaaS foundation and ERP logic.

## Steps
1. [x] Start Django Backend Server (Port 8000)
2. [x] Start Next.js Frontend Server (Port 3000)
3. [x] Apply Django Migrations (`python manage.py migrate`)
4. [/] Apply Prisma Schema (`npx prisma db push`)
5. [ ] Seed Test Data
6. [ ] Verify SaaS Panel Access (`/admin/saas/organizations`)
7. [ ] Test ERP Proxy Bridge
