# Security Policy

## Supported Versions
At TSF ERP, we take security seriously and prioritize keeping our systems safe. The following versions are currently being supported with security updates.

| Version | Supported          | Notes                                     |
| ------- | ------------------ | ----------------------------------------- |
| v3.1.x  | :white_check_mark: | Current Mainline (Storefront + ERP)       |
| v3.0.x  | :white_check_mark: | Long Term Support (ERP Only)              |
| v2.x.x  | :x:                | Deprecated. Upgrade to v3.x immediately.  |
| < 2.0   | :x:                | End of Life.                              |

## Reporting a Vulnerability

We deeply appreciate the efforts of security researchers and our community in keeping TSFSYSTEM secure. If you discover a vulnerability, please report it to us immediately.

### How to Report
1. **Do not open a public issue.** This is to protect our active userbase and tenants from exploitation before a patch is deployed.
2. Please email your findings to **security@tsf.ci**.
3. Include the following details:
   - Type of vulnerability (e.g., XSS, SQLi, IDOR, SSRF).
   - Step-by-step instructions to reproduce the vulnerability.
   - Any proof-of-concept (PoC) scripts or screenshots.
   - The impact of the vulnerability.

### What to Expect
- You will receive an acknowledgment of your report within **24 hours**.
- Our security team will triage and verify the vulnerability within **72 hours**.
- We will keep you updated on our progress toward a fix.
- Once the vulnerability is patched in production, we will notify you and, with your permission, acknowledge your contribution in our release notes or Hall of Fame.

## Security Practices
Our platform operates on a multi-tenant SaaS architecture. To ensure robust security, we implement:
- **Tenant Isolation**: Strict PostgreSQL row-level security and application-layer tenant resolution parameters to prevent cross-tenant data spillage.
- **RBAC**: A highly granular Role-Based Access Control matrix.
- **Authentication**: JWT-based session handling with automated rotation and invalidation.
- **Auditing**: Comprehensive `AuditLog` trailing on all models via the generic `AuditLogMixin`.

Please respect our systems during testing. Do not execute destructive actions, access data belonging to other organizations, or attempt Denial of Service (DoS) attacks.

## OWASP Top 10 Compliance (2021)

| # | Risk | Status | Mitigation |
|---|---|---|---|
| A01 | Broken Access Control | ✅ | RBAC + tenant middleware + organization FK on every model |
| A02 | Cryptographic Failures | ✅ | HTTPS enforced (Cloudflare), JWT rotation, `AES_SECRET_KEY` for field-level encryption |
| A03 | Injection | ✅ | Django ORM (parameterized queries), DRF serializer validation |
| A04 | Insecure Design | ✅ | ConnectorEngine architecture, ADRs, 13 fitness tests |
| A05 | Security Misconfiguration | ✅ | `DEBUG=False` in prod, `SECRET_KEY` from env, `ALLOWED_HOSTS` restricted |
| A06 | Vulnerable Components | ⚠️ | `npm audit` + `pip-audit` recommended in CI (not yet automated) |
| A07 | Authentication Failures | ✅ | Token-based auth, session timeout, rate limiting on login |
| A08 | Data Integrity Failures | ✅ | Signed cookies, CSRF protection, `internal_bypass` guard on system accounts |
| A09 | Logging & Monitoring | ✅ | Structured JSON logging, request logger middleware, AuditLog mixin |
| A10 | Server-Side Request Forgery | ✅ | No user-controlled URL fetching, Cloudflare WAF |

## Content Security Policy

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com;
```

*Thank you for helping keep TSF ERP safe.*
