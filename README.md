# TSFSYSTEM Platform

A modern, full-stack Enterprise Resource Planning (ERP), Point of Sale (POS), and eCommerce Suite built for performance and scale.

## 🏗️ Architecture & Tech Stack

TSFSYSTEM is structured as a decoupled architecture:
- **Frontend**: Next.js 15 (App Router), React, TailwindCSS
- **Backend**: Django 4, Django REST Framework
- **Database**: PostgreSQL 16
- **Cache & Async queues**: Redis + Celery
- **Infrastructure**: Docker, Nginx, Certbot

## 📦 Core Modules

The platform is divided into specialized modules managed by a rigorous Role-Based Access Control (RBAC) engine:
- **Finance & Accounting**: Chart of accounts, universal tax engine, VAT settlement, journal entries. 
- **Sales & POS**: Orchestrated multi-terminal POS system, omnichannel order tracking, physical register hardware support.
- **Inventory & Procurement**: Multi-warehouse transfers, DRAFT PO automated replenishment (Min/Max rules), stock ledger.
- **eCommerce (Supermarché)**: Multi-theme storefront engine with headless carts, client portal, quotes inbox, and webhook integrations.
- **CRM**: B2B and B2C contact management, pricing tiers.

## 🚀 Local Development Setup

### 1. Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.10+
- PostgreSQL client tools (optional, for local DB inspection)

### 2. Environment Variables
Copy the example environment file and customize it. Never commit `.env` or `.env.production` keys!
```bash
cp .env.example .env
```
Ensure your database credentials and secret keys are securely configured.

### 3. Running via Docker (Recommended)
You can start the entire infrastructure (DB, Redis, Backend, Frontend) with one command.
It may take 2-5 minutes to build images on the first run.
```bash
docker-compose up -d --build
```

### 4. Running Locally (Alternative)
First, start PostgreSQL and Redis via Docker or locally. Then:

**Backend:**
```bash
cd erp_backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**Frontend:**
```bash
npm install
npm run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000).
The backend API and Django Admin will be available at [http://localhost:8000](http://localhost:8000).

## 🛡️ Security & Roles
The application uses session-based and token-based authentication. Role Base Access Control (RBAC) is enforced simultaneously via React layout guards on the client and strictly inside Django viewsets on the server. Do not execute destructive operations without acquiring the appropriate `erp.Role`. 

## 🚢 Deployment
All deployments use strict Docker orchestration and require atomic migrations. See `PRODUCTION_DEPLOYMENT.md` for the official rollback procedures, database resilience instructions, and safe deployment guides.
