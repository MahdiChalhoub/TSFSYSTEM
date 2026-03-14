# TSF Global Technical Standards

## 🗄️ Database Normalization & Business Meaning
1. **Reuse over Creation**: Before creating any new database field or column, you MUST check if the same business value already exists.
2. **Authoritative Sources**: If a field already represents that value, it MUST be reused or referenced via foreign key. No duplicate business meanings are allowed.
3. **Mandatory Declaration**: Every new field must declare:
   - **Business meaning**
   - **Authoritative table**
   - **Authoritative column**
4. **Referential Integrity**: Store only foreign keys for values belonging to other tables.

## 🛡️ Security Protocol (TSF Zero-Trust)
1. **Authentication**: All endpoints MUST require authentication unless explicitly marked public.
2. **Server-Side Validation**: Never trust client input. All authenticated requests MUST verify user identity, organization membership, and permissions server-side.
3. **Data Protection**:
   - Mandatory hashing for passwords.
   - Mandatory encryption for tokens.
   - Secrets must remain in environment variables.
4. **Injection & Scripting Defense**:
   - Use ORM only; no raw SQL.
   - Sanitize all user content (XSS Protection).
   - CSRF protection enabled.
5. **Infrastructure Resilience**:
   - Rate limiting on sensitive endpoints.
   - Zero-Leak API responses (No stack traces, internal errors, or DB structure leaks).
6. **File Security**:
   - Strict type validation and size limits for uploads.
7. **Log Hygiene**: Logs must NOT contain passwords, tokens, or personal secrets.
8. **GitHub Safety**: Production secrets must NEVER be committed.

## 🚀 Architectural Compliance
Any feature that weakens security or violates normalization is INVALID.
