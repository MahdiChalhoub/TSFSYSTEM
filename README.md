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

---

## 🧪 Testing & Validation

TSFSYSTEM includes comprehensive testing infrastructure:

### **Quick Start**
```bash
# Run integration tests
python manage.py test tests.integration

# Run performance tests
python manage.py test tests.performance

# Run load tests
python scripts/load_test.py --users 50 --duration 120
```

### **Documentation**
- **[QUICK_START.md](QUICK_START.md)** - 5-minute quick start guide
- **[INTEGRATION_TESTING_GUIDE.md](INTEGRATION_TESTING_GUIDE.md)** - Complete testing guide
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Production deployment procedures
- **[TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md)** - Problem resolution guide
- **[SYSTEM_VALIDATION_CHECKLIST.md](SYSTEM_VALIDATION_CHECKLIST.md)** - Production readiness checklist

### **Architecture Documentation**
- **[KERNEL_OS_V2_COMPLETE.md](KERNEL_OS_V2_COMPLETE.md)** - Kernel OS v2.0 architecture
- **[ENFORCEMENT_COMPLETE.md](ENFORCEMENT_COMPLETE.md)** - Module boundaries enforcement
- **[EVENT_CONTRACTS_COMPLETE.md](EVENT_CONTRACTS_COMPLETE.md)** - Event-driven architecture

### **Test Coverage**
- ✅ **Integration Tests**: 8 test classes covering all Kernel OS components
- ✅ **Performance Tests**: 10+ test classes with performance benchmarks
- ✅ **Load Tests**: Multi-user simulation with detailed metrics
- ✅ **Architecture Enforcement**: Automated violation detection

---

## 🏛️ Kernel OS v2.0

TSFSYSTEM is built on **Kernel OS v2.0**, a sophisticated ERP kernel providing:

### **Core Subsystems**
1. **Tenancy System** - Multi-tenant isolation with automatic query filtering
2. **RBAC Engine** - Role-based access control with permission inheritance
3. **Audit System** - Comprehensive change tracking and audit trails
4. **Event Bus** - Event-driven architecture with outbox pattern
5. **Configuration Engine** - Dynamic per-tenant configuration
6. **Contract System** - Event schema validation and documentation
7. **Module Loader** - Dynamic module enable/disable
8. **Observability** - Metrics collection and performance monitoring

### **Key Features**
- ✅ Multi-tenant data isolation
- ✅ Event-driven inter-module communication
- ✅ Automatic audit logging
- ✅ Dynamic module loading
- ✅ Contract-based event validation
- ✅ Performance monitoring
- ✅ Architecture enforcement

### **Architecture Enforcement**
```bash
# Check for architecture violations
python3 .ai/enforcement/enforce.py check

# Install pre-commit hook
bash .ai/enforcement/install.sh
```

---

## 📊 Performance Benchmarks

TSFSYSTEM meets strict performance targets:

| Operation | Target | Status |
|-----------|--------|--------|
| Tenant isolation query | <10ms | ✅ Tested |
| Event emission | <20ms | ✅ Tested |
| Permission check | <10ms | ✅ Tested |
| Audit log write | <10ms | ✅ Tested |
| Contract validation | <5ms | ✅ Tested |
| API endpoint | <200ms | ✅ Load tested |

Run benchmarks:
```bash
./scripts/benchmark.sh
```

---

## 🎯 Production Readiness

Before production deployment:

1. ✅ Run all integration tests
2. ✅ Run performance tests
3. ✅ Run load tests
4. ✅ Complete [SYSTEM_VALIDATION_CHECKLIST.md](SYSTEM_VALIDATION_CHECKLIST.md)
5. ✅ Follow [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
6. ✅ Configure monitoring
7. ✅ Set up backup procedures

---

## 🆘 Troubleshooting

Having issues? Check:
1. **[TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md)** - Common problems and solutions
2. **Test logs** - `python manage.py test tests.integration -v 2`
3. **Architecture violations** - `python3 .ai/enforcement/enforce.py check`
4. **Event contracts** - `python manage.py register_contracts`

---

## 📈 System Status

```
Kernel OS v2.0:          ✅ Complete
Module Enforcement:      ✅ Complete
Event Contracts:         ✅ Complete (19 contracts)
Integration Testing:     ✅ Complete
Performance Testing:     ✅ Complete
Documentation:          ✅ Complete
Production Ready:       ✅ YES
```

---

## 🚀 Getting Started

**New to TSFSYSTEM?**
1. Read [QUICK_START.md](QUICK_START.md) (5 minutes)
2. Follow [INTEGRATION_TESTING_GUIDE.md](INTEGRATION_TESTING_GUIDE.md)
3. Review [KERNEL_OS_V2_COMPLETE.md](KERNEL_OS_V2_COMPLETE.md)

**Ready to deploy?**
1. Complete [SYSTEM_VALIDATION_CHECKLIST.md](SYSTEM_VALIDATION_CHECKLIST.md)
2. Follow [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
3. Monitor and celebrate! 🎉
