# Contributing to TSFSYSTEM

Thank you for contributing! This guide covers setup, standards, and the PR process.

## Quick Start

```bash
# 1. Clone and install
git clone git@github.com:MahdiChalhoub/TSFSYSTEM.git
cd TSFSYSTEM
npm install        # Frontend + git hooks (husky)

# 2. Backend
cd erp_backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 manage.py migrate

# 3. Run
npm run dev          # Frontend (Turbopack)
python3 manage.py runserver  # Backend
```

## Code Standards

### Frontend (TypeScript/React)
- **TypeScript strict mode** enforced (`"strict": true`)
- **ESLint** — Next.js core-web-vitals + TypeScript rules
- **Prettier** — auto-formats on commit via husky
- **No raw `fetch()`** in privileged pages — use `erpFetch`
- **No raw `fetch()`** in supplier-portal — use `portalFetch`
- **Server actions** use `'use server'` and standardized error handling

### Backend (Django/Python)
- **No cross-module imports** — use `ConnectorEngine` for inter-module communication
- **No hardcoded COA codes** — use `PostingResolver.resolve()`
- **No direct `rules[...]` access** — use `PostingResolver.resolve()`
- **Tenant isolation** — every query must be scoped to `organization`

### Architecture Rules
See [ARCHITECTURE.md](docs/ARCHITECTURE.md) and the [ADR directory](docs/adr/) for design decisions.

## Commit Convention

```
type: brief description

Types: feat, fix, refactor, docs, test, ci, arch, perf, chore
```

Examples:
- `feat: add VAT settlement workspace`
- `fix: resolve tenant isolation in CRM contacts`
- `arch: migrate POS to PostingResolver`

## Pull Request Process

1. **Branch** from `main`: `feature/your-feature` or `fix/your-fix`
2. **Ensure quality gates pass**:
   ```bash
   npm run format:check   # Prettier
   npm run lint            # ESLint
   npm run typecheck       # TypeScript
   npm run build           # Next.js build
   bash scripts/ci/check-architecture-fitness.sh  # 13 fitness checks
   ```
3. **Tests** (if applicable):
   ```bash
   npm run test:run        # Frontend (vitest)
   cd erp_backend && python3 manage.py test  # Backend
   ```
4. **Fill out the PR template** and request review

## Architecture Fitness

Every commit is validated against 13 automated checks:
- No cross-module imports
- No hardcoded COA codes
- Frontend API discipline (erpFetch/portalFetch)
- Posting discipline (finance module containment)
- ConnectorEngine usage
- No secrets in source
- Root file count limits
- Posting rules access baseline
- App isolation
- Portal fetch discipline

Run locally: `bash scripts/ci/check-architecture-fitness.sh`
