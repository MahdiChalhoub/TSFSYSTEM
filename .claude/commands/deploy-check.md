# Pre-Deployment Checklist

You are acting as **OpsCommander** (see `.agents/specialists/ops-commander.md`).

## Full Deployment Verification

Run all checks before deploying to production.

## Checklist

### 1. Git Status
```bash
git status
```
- [ ] No uncommitted changes
- [ ] On correct branch (main/master for production)
- [ ] All changes committed with proper messages

### 2. TypeScript Check
```bash
npm run typecheck
```
- [ ] Zero TypeScript errors in `src/`

### 3. Build Check
```bash
npm run build
```
- [ ] Production build succeeds
- [ ] No build errors or warnings

### 4. Business Logic Tests
```bash
npm run test
```
- [ ] All 34 tests pass
- [ ] No failing test suites

### 5. Backend Check
```bash
cd erp_backend
python manage.py check --deploy
```
- [ ] No Django warnings or errors

### 6. Security Scan
```bash
npm run security:scan  # If available
```
- [ ] No critical vulnerabilities
- [ ] No secrets in code
- [ ] No .env files in git

### 7. Code Quality
```bash
# Check for console.log
grep -r "console\\.log" src/ --exclude-dir=node_modules | wc -l

# Check for debugger
grep -r "debugger" src/ --exclude-dir=node_modules | wc -l

# Check for @ts-ignore
grep -r "@ts-ignore" src/ --exclude-dir=node_modules | wc -l
```
- [ ] No console.log statements (or documented exceptions)
- [ ] No debugger statements
- [ ] No @ts-ignore (or with explanation)

### 8. Database Migrations
```bash
cd erp_backend
python manage.py makemigrations --dry-run
```
- [ ] No pending migrations (or all reviewed)
- [ ] Migrations tested in staging

### 9. Environment Check
```bash
# Verify production env vars
cat .env.production  # Do NOT commit this file
```
- [ ] All required env vars set
- [ ] Database URL correct
- [ ] API keys present
- [ ] SECRET_KEY is strong and unique

### 10. Dependencies
```bash
npm audit
pip-audit  # In erp_backend/
```
- [ ] No critical vulnerabilities
- [ ] Dependencies up to date

## If All Pass

### Production Deployment
```bash
# Standard deployment
bash deploy_production.sh

# Or hotfix
bash deploy_hotfix.sh
```

### Post-Deployment
1. Verify health endpoint: https://tsf.ci/api/health/
2. Check logs for errors
3. Test critical flows:
   - Login
   - Create invoice
   - Process payment
   - POS checkout
4. Monitor for 15 minutes

## If Any Fail

**DO NOT DEPLOY**

Fix all issues first, then re-run this checklist.

## Rollback Plan

If deployment fails:
```bash
# Rollback frontend
git revert HEAD
npm run build
# Deploy previous version

# Rollback backend
cd erp_backend
git revert HEAD
python manage.py migrate [previous_migration]
# Restart services
```

## Remember

> "If you're not confident, don't deploy."
> "Better to delay than to deploy broken code."
> "Always have a rollback plan."

---

**Never skip the checklist. Ever.**
