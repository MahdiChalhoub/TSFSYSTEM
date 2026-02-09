---
trigger: always_on
---

1. All endpoints MUST require authentication unless explicitly marked public.

2. All authenticated requests MUST verify:
   - User identity
   - Organization membership
   - Permissions

3. Never trust client input.
   All input MUST be validated server-side.

4. No sensitive data may be stored or transmitted in plain text:
   - Passwords must be hashed
   - Tokens must be encrypted
   - Secrets must be in environment variables

5. SQL Injection protection is mandatory:
   - Use ORM only
   - No raw SQL unless explicitly allowed

6. Cross-Site Scripting (XSS) protection:
   - Sanitize all user-generated content
   - Escape output by default

7. Cross-Site Request Forgery (CSRF) protection must be enabled.

8. Rate limiting must be applied to authentication and sensitive endpoints.

9. All API responses must avoid leaking:
   - Stack traces
   - Internal errors
   - Database structure

10. Authorization checks MUST happen on server,
    never in frontend only.

11. File uploads must be:
    - Type validated
    - Size limited
    - Virus scanned if possible

12. Logs must NOT contain:
    - Passwords
    - Tokens
    - Personal secrets

13. Production secrets must NEVER be committed to GitHub.

14. Any feature that weakens security is INVALID.
