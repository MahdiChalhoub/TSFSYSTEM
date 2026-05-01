/**
 * Client-side helper for session-expired redirects.
 *
 * Why this exists: server actions called from the client run AFTER the
 * privileged layout has already rendered. If the token expires mid-session,
 * the layout's getUser() check is no longer in play — every subsequent
 * server-action call hits a 401 "Invalid token", and without this helper
 * the user only sees a toast (or nothing). They keep clicking, getting
 * 500s, and never realize they need to re-authenticate.
 *
 * This helper:
 *   1. Surfaces a toast as a heads-up.
 *   2. Hard-redirects through middleware's ?clear_auth=1 path so the stale
 *      auth_token / scope_access cookies are wiped before /login renders.
 *   3. Preserves the current URL as ?next so the user lands back where
 *      they were after re-authenticating.
 *
 * Use this from any client component that consumes a FetchResult-style
 * envelope (`{ data, error?, auth? }`):
 *
 *   if (result.auth) return handleSessionExpired()
 */

let redirecting = false

export function handleSessionExpired(opts?: { silent?: boolean; delayMs?: number }): void {
    if (typeof window === 'undefined') return
    if (redirecting) return // prevent double-redirect from concurrent failures
    redirecting = true

    const delayMs = opts?.delayMs ?? 600

    if (!opts?.silent) {
        // Lazy-import to keep sonner out of the initial bundle.
        import('sonner').then(({ toast }) => {
            toast.error('Session expired — redirecting to login...', { duration: 4000 })
        }).catch(() => { /* sonner unavailable; navigation still happens */ })
    }

    const next = encodeURIComponent(window.location.pathname + window.location.search)
    window.setTimeout(() => {
        window.location.href = `/login?clear_auth=1&next=${next}`
    }, delayMs)
}

/** True if a session-expired redirect is already in flight. */
export function isRedirecting(): boolean {
    return redirecting
}
