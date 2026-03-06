# Security Audit

You are acting as **The Auditor** + **Gatekeeper** (see `.agents/specialists/auditor.md` and `.agents/specialists/gatekeeper.md`).

## Complete Security Audit

Run comprehensive security checks.

## The 14 Security Rules Audit

### 1. Authentication
```bash
# Check for unauthenticated endpoints
grep -r "permission_classes = \\[\\]" erp_backend/apps/
grep -r "authentication_classes = \\[\\]" erp_backend/apps/
```
- [ ] All privileged endpoints require authentication
- [ ] No bypasses in production code

### 2. Tenant Isolation
```bash
# Check for queries without tenant filter
grep -r "objects\\.all()" erp_backend/apps/ | grep -v "test_"
grep -r "objects\\.get(" erp_backend/apps/ | grep -v "tenant="
```
- [ ] All queries filter by `request.tenant`
- [ ] No tenant spillage risks

### 3. RBAC Permissions
```bash
# Check for missing permission checks
grep -r "def post(" erp_backend/apps/ -A 5 | grep -v "has_perm"
grep -r "def delete(" erp_backend/apps/ -A 5 | grep -v "has_perm"
```
- [ ] State-changing operations check permissions
- [ ] Permission checks before database modifications

### 4. SQL Injection
```bash
# Check for raw SQL with user input
grep -r "objects\\.raw(" erp_backend/apps/
grep -r "cursor\\.execute(" erp_backend/apps/ | grep -v "%s"
```
- [ ] No raw SQL with unsanitized input
- [ ] Parameterized queries if raw SQL used

### 5. XSS Prevention
```bash
# Check for dangerous HTML rendering
grep -r "dangerouslySetInnerHTML" src/
grep -r "__html" src/
```
- [ ] No unsanitized HTML rendering
- [ ] User input escaped

### 6. CSRF Protection
```bash
# Check CSRF settings
grep "CSRF" erp_backend/erp/settings.py
```
- [ ] CSRF middleware enabled
- [ ] Tokens on all forms

### 7. Secrets Management
```bash
# Check for committed secrets
git log --all --full-history -- "**/.env"
grep -r "SECRET_KEY = " erp_backend/ | grep -v "environ"
grep -r "password = " erp_backend/ | grep -v "models\\." | grep -v "forms\\."
```
- [ ] No secrets in git history
- [ ] Environment variables used
- [ ] No hardcoded passwords

### 8. Audit Logging
```bash
# Check for models without audit logging
grep -r "class.*models\\.Model" erp_backend/apps/ | grep -v "AuditLogMixin"
```
- [ ] Critical models use `AuditLogMixin`
- [ ] State changes logged

### 9. Rate Limiting
```bash
# Check for rate limiting decorators
grep -r "@ratelimit" erp_backend/apps/
```
- [ ] Sensitive endpoints have rate limiting
- [ ] Login attempts limited

### 10. Input Validation
```bash
# Check for serializers without validation
grep -r "class.*Serializer" erp_backend/apps/ -A 10 | grep -v "validate"
```
- [ ] All endpoints validate input
- [ ] Serializers have validators

### 11. Password Security
```python
# Check password settings in erp_backend/erp/settings.py
# Should see:
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    ...
]
AUTH_PASSWORD_VALIDATORS = [...]
```
- [ ] Strong password hashing
- [ ] Password validators enabled

### 12. JWT Security
```bash
# Check JWT settings
grep -r "JWT" erp_backend/erp/settings.py
```
- [ ] Short access token lifetime (15 min)
- [ ] Refresh token rotation enabled
- [ ] Secure token storage

### 13. File Upload Security
```bash
# Check file upload handling
grep -r "request\\.FILES" erp_backend/apps/
```
- [ ] File type validation
- [ ] Size limits enforced
- [ ] Files stored securely

### 14. HTTPS Only
```bash
# Check security settings
grep "SECURE_" erp_backend/erp/settings.py
```
- [ ] SECURE_SSL_REDIRECT = True (production)
- [ ] SECURE_HSTS_SECONDS set
- [ ] SESSION_COOKIE_SECURE = True

## Vulnerability Patterns

### Check for Common Vulnerabilities

#### IDOR (Insecure Direct Object Reference)
```python
# ❌ Vulnerable
def get_invoice(request, invoice_id):
    invoice = Invoice.objects.get(id=invoice_id)  # No tenant check!
    return Response(serialize(invoice))
```

#### Mass Assignment
```python
# ❌ Vulnerable
user.update(**request.data)  # User could set is_staff=True!
```

#### Command Injection
```python
# ❌ Vulnerable
os.system(f\"ls {user_input}\")  # User could inject commands
```

## Automated Scans

### Django Security Check
```bash
cd erp_backend
python manage.py check --deploy
```

### Dependency Vulnerabilities
```bash
cd erp_backend
pip-audit

cd ..
npm audit
```

### Secret Scanning
```bash
# Use git-secrets or similar
git secrets --scan
```

## Findings Report Format

```markdown
# Security Audit Report - [Date]

## Critical Issues (🔴 Immediate Fix Required)
1. **Tenant Isolation Breach** (src/api/finance/invoices.ts:45)
   - Risk: Cross-tenant data leak
   - Fix: Add tenant filter to query

## High Priority (🟠 Fix Before Next Deploy)
1. **Missing RBAC Check** (apps/finance/views/invoice_views.py:67)
   - Risk: Unauthorized invoice deletion
   - Fix: Add `user.has_perm('finance.delete_invoice')` check

## Medium Priority (🟡 Fix Soon)
1. **Weak Password Policy**
   - Current: 6 characters minimum
   - Recommendation: 8 characters + complexity

## Low Priority (🟢 Monitor)
1. **Outdated Dependencies**
   - 3 npm packages have known vulnerabilities (non-critical)
   - Update in next maintenance window

## Summary
- Critical: 1
- High: 1
- Medium: 1
- Low: 1

**Action**: Fix critical and high priority before deployment.
```

## Post-Audit

- [ ] Create issues for all findings
- [ ] Assign priorities
- [ ] Schedule fixes
- [ ] Re-audit after fixes

## Remember

> \"Security is not optional.\"
> \"If you find it, fix it. Don't just document it.\"
> \"Assume breach: defense in depth.\"

---

**Run this audit regularly. At minimum: before every production deployment.**
