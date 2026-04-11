import { useParams, usePathname } from 'next/navigation'
import { useMemo } from 'react'

/**
 * `useStorefrontPath` — Generates correct storefront paths based on the current environment.
 *
 * On tenant subdomains (production), the middleware rewrites:
 *   /register  →  /tenant/tsf-global/register
 *
 * But the user only sees `/register` in the browser.
 *
 * Internally, Next.js route files still live under `/tenant/[slug]/...`,
 * and `useParams()` still provides the slug. This hook decides the correct
 * prefix for `<Link>` hrefs:
 *
 * - If the user accessed via a subdomain (clean URL), links use root paths:
 *   `path('/register')` → `/register`
 *
 * - If the user accessed via `/tenant/slug/...` directly (dev, or direct URL),
 *   links use the prefixed paths:
 *   `path('/register')` → `/tenant/tsf-global/register`
 */
export function useStorefrontPath() {
    const { slug } = useParams<{ slug: string }>()
    const pathname = usePathname()

    // Detect whether the current page was accessed via the /tenant/[slug] path
    // or via a subdomain rewrite (clean URL).
    // If pathname starts with /tenant/, links should use the full prefix.
    // If not (subdomain rewrite), links should use root-relative paths.
    const isDirectTenantPath = pathname.startsWith('/tenant/')

    const basePath = useMemo(() => {
        return isDirectTenantPath ? `/tenant/${slug}` : ''
    }, [isDirectTenantPath, slug])

    /**
     * Generate a storefront path.
     * @param route - The route relative to the storefront root, e.g. '/register', '/account/orders'
     * @returns The full href to use in <Link> or router.push()
     */
    const path = (route: string = '') => {
        if (route === '/' || route === '') return basePath || '/'
        return `${basePath}${route}`
    }

    return { path, slug, basePath }
}
