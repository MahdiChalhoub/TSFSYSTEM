# Dynamic Subdomain Routing

## Goal
Support wildcard subdomains (`*.tsf.ci`) so any organization (tenant) can be accessed via `{slug}.tsf.ci`.

## Architecture

### Data Flow
```
Browser → Cloudflare (*.tsf.ci DNS + SSL) → Nginx (server_name *.tsf.ci) → Next.js Middleware → /tenant/[slug]/page.tsx
```

### How Subdomain Resolution Works

1. **Cloudflare**: Wildcard `*.tsf.ci` DNS record points all subdomains to the server.
2. **Nginx** (`scripts/nginx_tsf_ci.conf`): `server_name tsf.ci *.tsf.ci` accepts all matching hosts.
3. **Next.js Middleware** (`src/middleware.ts`):
   - Extracts hostname from `Host` header.
   - Strips the root domain (`NEXT_PUBLIC_ROOT_DOMAIN=tsf.ci`) to get the slug.
   - Rewrites the request to `/tenant/{slug}/...`.
4. **Tenant Page** (`src/app/tenant/[slug]/page.tsx`):
   - Calls `getOrganizationBySlug(slug)` to fetch the org.
   - Returns `notFound()` if the org doesn't exist.
   - Renders the tenant storefront if it does.

### Key Files

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Subdomain detection & rewrite to `/tenant/[slug]` |
| `src/app/tenant/[slug]/page.tsx` | Tenant landing page |
| `src/app/tenant/[slug]/actions.ts` | Server actions for fetching org/products by slug |
| `next.config.ts` | `allowedOrigins` must include `*.tsf.ci` for server actions |
| `docker-compose.yml` | Sets `NEXT_PUBLIC_ROOT_DOMAIN=tsf.ci` |
| `scripts/nginx_tsf_ci.conf` | Production nginx with `server_name tsf.ci *.tsf.ci` |

### Variables User Interacts With

- **URL**: `{slug}.tsf.ci` — the subdomain slug maps to an organization
- **`NEXT_PUBLIC_ROOT_DOMAIN`**: Environment variable that tells the middleware which part of the hostname is the "root" to strip

### SSL Requirements

- The SSL certificate **must** cover `*.tsf.ci` (wildcard).
- If using Cloudflare Proxy with "Full (Strict)" SSL, the origin cert must also cover `*.tsf.ci`.
- Alternative: Use Cloudflare SSL mode "Full" (not Strict) to skip origin cert domain validation.

## Where Data Is READ
- Organization data is fetched via `getOrganizationBySlug()` from the Django backend API.

## Where Data Is SAVED
- No data is saved by this routing; it is read-only tenant resolution.

## Step-by-Step Workflow
1. User navigates to `demo.tsf.ci`.
2. Cloudflare resolves `*.tsf.ci` → server IP.
3. Nginx accepts the connection and proxies to Next.js on port 3000.
4. Next.js middleware reads `Host: demo.tsf.ci`, strips `.tsf.ci`, gets slug `demo`.
5. Middleware rewrites the request to `/tenant/demo`.
6. `page.tsx` calls `getOrganizationBySlug("demo")`.
7. If org exists → render storefront. If not → 404.
