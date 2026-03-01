---
trigger: always_on
description: Comprehensive cybersecurity rules for all agents
---

# Security Rules (Mandatory — ALL Agents)

> These rules are NON-NEGOTIABLE. Any code that violates them is REJECTED.

---

## 1. Authentication & Authorization

1.1. All endpoints MUST require authentication unless explicitly marked public.
     - Only login, register, password-reset, and health-check may use `AllowAny`.
     
1.2. All authenticated requests MUST verify:
     - User identity (token valid, not expired)
     - Organization membership (user belongs to the org)
     - Permissions (user has the required permission slug)

1.3. Authorization checks MUST happen server-side. Never rely on frontend-only checks.

1.4. Session tokens MUST have expiry. No infinite-lived tokens.

1.5. Login attempts MUST be rate-limited (max 5 per minute per IP).

---

## 2. Tenant Isolation (CRITICAL for SaaS)

2.1. Every database record MUST belong to exactly ONE organization.

2.2. Every `get_queryset()` MUST filter by `organization=request.user.organization`.
     ```python
     # CORRECT
     def get_queryset(self):
         return super().get_queryset().filter(organization=self.request.user.organization)
     
     # WRONG — exposes ALL orgs' data
     def get_queryset(self):
         return super().get_queryset()
     ```

2.3. `organization_id` MUST come from the authenticated user, NEVER from the request body.
     ```python
     # CORRECT
     serializer.save(organization=request.user.organization)
     
     # WRONG — attacker can set any org
     serializer.save(organization_id=request.data['organization_id'])
     ```

2.4. Cross-organization joins are FORBIDDEN. Use ConnectorEngine or signals.

2.5. SaaS admin views that aggregate across orgs MUST check `is_superuser` or `is_saas_admin`.

---

## 3. Input Validation

3.1. NEVER trust client input. ALL input MUST be validated server-side.

3.2. Use Django serializers for validation. Never process raw `request.data` directly.

3.3. Validate:
     - Data types (string, number, boolean)
     - String length (max limits on all text fields)
     - Numeric ranges (no negative quantities, no 99999999 prices)
     - Email format
     - Phone format
     - Date ranges (no future dates for past events)

3.4. Reject unexpected fields — use explicit serializer `fields`, never `__all__`.

---

## 4. Injection Prevention

4.1. SQL Injection:
     - Use Django ORM exclusively. No raw SQL. 
     - If raw SQL is unavoidable, use parameterized queries ONLY:
       ```python
       # CORRECT
       cursor.execute("SELECT * FROM table WHERE id = %s", [user_id])
       
       # CRITICAL VULNERABILITY — NEVER DO THIS
       cursor.execute(f"SELECT * FROM table WHERE id = {user_id}")
       ```

4.2. Cross-Site Scripting (XSS):
     - React auto-escapes by default. Do NOT bypass with `dangerouslySetInnerHTML`.
     - If `dangerouslySetInnerHTML` is unavoidable, sanitize with DOMPurify first.
     - Never inject user-provided content into `<script>` tags.

4.3. Code Injection:
     - NEVER use `eval()` or `exec()` with user input.
     - NEVER use `pickle.loads()` on untrusted data.

4.4. Command Injection:
     - NEVER use `os.system()` or `subprocess.call()` with user input.
     - Use `subprocess.run()` with explicit argument lists.

---

## 5. Secrets Management

5.1. NEVER hardcode secrets (API keys, passwords, tokens) in source code.

5.2. ALL secrets MUST be in environment variables (`.env` file, never committed).

5.3. `.env` and `.env.local` MUST be in `.gitignore`.

5.4. Frontend code MUST only access `NEXT_PUBLIC_*` env variables. Backend secrets MUST NOT be exposed to the browser.

5.5. API keys for third-party services (Stripe, etc.) MUST use the server-side secret key, never the publishable key for sensitive operations.

---

## 6. Security Headers (Already Configured — Do Not Remove)

6.1. `X-Frame-Options: SAMEORIGIN` — Prevents clickjacking.
6.2. `X-Content-Type-Options: nosniff` — Prevents MIME type sniffing.
6.3. `Strict-Transport-Security` (HSTS) — Forces HTTPS.
6.4. `Content-Security-Policy` — Prevents XSS, controls resource loading.
6.5. `Referrer-Policy: strict-origin-when-cross-origin` — Limits referrer leakage.
6.6. `Permissions-Policy` — Disables camera, microphone, geolocation by default.
6.7. `X-Powered-By: false` — Hides technology stack from attackers.

**Rule: If you modify `next.config.ts` or `nginx.conf`, you MUST verify all 7 headers still exist.**

---

## 7. CSRF Protection

7.1. CSRF tokens MUST be used on all state-changing requests (POST, PUT, DELETE).
7.2. Django's CSRF middleware MUST remain enabled.
7.3. For API-only endpoints using token auth, CSRF can be exempted — but ONLY if token auth is enforced.

---

## 8. Rate Limiting & Brute Force Prevention

8.1. Authentication endpoints: Max 5 attempts per minute per IP.
8.2. Password reset: Max 3 attempts per hour per email.
8.3. API endpoints: Apply `TenantResolveRateThrottle` on sensitive operations.
8.4. File uploads: Max 10 per minute per user.

---

## 9. Data Protection

9.1. Passwords MUST be hashed (Django default: PBKDF2). Never store plaintext.
9.2. Tokens MUST be encrypted or securely hashed.
9.3. Sensitive data in transit MUST use HTTPS (enforced by HSTS).
9.4. Database connections MUST use SSL in production.
9.5. Backup data MUST be encrypted.

---

## 10. Logging & Monitoring

10.1. NEVER log passwords, tokens, API keys, or personal secrets.
10.2. DO log: Failed login attempts, permission denials, suspicious patterns.
10.3. API responses MUST NOT contain: stack traces, internal errors, database structure.
10.4. Use structured logging with request ID for traceability.

---

## 11. File Upload Security

11.1. Validate file type by content (magic bytes), not just extension.
11.2. Enforce size limits (e.g., max 10MB per file).
11.3. Store uploads outside the web root (use media storage, not static).
11.4. Rename uploaded files to prevent path traversal attacks.

---

## 12. Cookie Security

12.1. Session cookies MUST have:
     - `HttpOnly` flag (prevents JavaScript access)
     - `Secure` flag (HTTPS only)
     - `SameSite=Lax` or `Strict` (prevents CSRF)
12.2. Cookies MUST be scoped to the specific tenant subdomain.
12.3. SaaS admin cookies MUST NOT grant access to tenant subdomains.

---

## 13. API Security

13.1. Use HTTPS only. Redirect HTTP to HTTPS.
13.2. Implement proper CORS configuration:
     - Never use `Access-Control-Allow-Origin: *` in production.
     - Whitelist specific origins (e.g., `*.tsf.ci`).
13.3. Paginate all list endpoints (prevent data dumping).
13.4. Implement request size limits.

---

## 14. Dependency Security

14.1. Audit npm dependencies periodically: `npm audit`
14.2. Audit Python dependencies: `pip audit` or `safety check`
14.3. Pin dependency versions in production.
14.4. Never use deprecated packages with known CVEs.

---

## Automated Enforcement

Run before every deployment:
```bash
node scripts/security-scan.js
```

This scans for:
- Unauthenticated endpoints
- Raw SQL / f-string SQL injection
- eval/exec code injection
- dangerouslySetInnerHTML XSS
- Hardcoded secrets
- Missing security headers
- Unfiltered querysets (data leaks)
- Exposed passwords in logs
