'use server';

/**
 * Theme Settings — Server Actions
 * ================================
 * Persist user theme preference in an httpOnly cookie so the server
 * can read it on the first render (zero-flicker, even without localStorage).
 *
 * Cookie: tsfsystem-app-theme
 * - httpOnly: false → client can read it for SSR pre-fill
 * - sameSite: lax
 * - path: /
 * - maxAge: 1 year
 */

import { cookies } from 'next/headers';

export type AppThemeName =
    | 'midnight-pro'
    | 'ivory-market'
    | 'neon-rush'
    | 'savane-earth'
    | 'arctic-glass'
    | 'lumina-sky'
    | 'warm-enterprise';

const VALID_THEMES: AppThemeName[] = [
    'midnight-pro',
    'ivory-market',
    'neon-rush',
    'savane-earth',
    'arctic-glass',
    'lumina-sky',
    'warm-enterprise',
];

const THEME_COOKIE = 'tsfsystem-app-theme';

/**
 * Persist the selected theme in a server-readable cookie.
 * Called in the background from AppThemeProvider.setTheme().
 */
export async function setOrgTheme(theme: AppThemeName): Promise<{ ok: boolean }> {
    if (!VALID_THEMES.includes(theme)) {
        return { ok: false };
    }

    const cookieStore = await cookies();
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost';

    // Use a wildcard domain if we are on a proper TLD (not localhost and not an IP)
    const isLocalhost = rootDomain.includes('localhost') || /^(\d{1,3}\.){3}\d{1,3}$/.test(rootDomain);
    const cookieDomain = isLocalhost ? undefined : `.${rootDomain}`;

    cookieStore.set(THEME_COOKIE, theme, {
        httpOnly: false, // client-readable so ThemeScript can SSR-prime
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        domain: cookieDomain,
        maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return { ok: true };
}

/**
 * Read the persisted theme from server cookie (user-level).
 * Used in the root layout to avoid flash of default theme.
 */
export async function getPersistedTheme(): Promise<AppThemeName | null> {
    const cookieStore = await cookies();
    const val = cookieStore.get(THEME_COOKIE)?.value as AppThemeName | undefined;
    return val && VALID_THEMES.includes(val) ? val : null;
}

/**
 * Fetch the org-level default theme from the backend.
 * Returns null if no org default has been set yet.
 * Used in layout.tsx as a fallback when the user has no personal cookie.
 *
 * Priority chain: user cookie → org default (this) → system default (midnight-pro)
 */
export async function getOrgDefaultTheme(): Promise<AppThemeName | null> {
    try {
        const { getTenantContext } = await import('@/lib/erp-api');
        const context = await getTenantContext();
        // NOTE: We do NOT bail out if context is null (SaaS root domain).
        // Django's TenantMiddleware will resolve the org from the user's auth token.
        // This allows the SaaS admin org to persist and load its own default theme.

        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        // Without a token we have no way to authenticate the request — bail early.
        if (!token) return null;

        const DJANGO_URL = process.env.DJANGO_URL || 'http://backend:8000';
        const targetUrl = `${DJANGO_URL}/api/organizations/me-theme/`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`,
        };
        // Forward tenant context when available (tenant subdomains)
        if (context) {
            headers['X-Tenant-Id'] = context.id;
            headers['X-Tenant-Slug'] = context.slug;
        }

        const res = await fetch(targetUrl, { headers, cache: 'no-store' });
        if (!res.ok) return null;

        const data = await res.json();
        const theme = data?.default_theme as AppThemeName | null;
        return theme && VALID_THEMES.includes(theme) ? theme : null;
    } catch {
        return null;
    }
}

/**
 * Set (or clear) the org-level default theme.
 * Called from /settings/appearance by org admins.
 * Pass null to remove the org default (falls back to system default midnight-pro).
 */
export async function setOrgDefaultTheme(
    theme: AppThemeName | null
): Promise<{ ok: boolean; error?: string }> {
    if (theme !== null && !VALID_THEMES.includes(theme)) {
        return { ok: false, error: 'Invalid theme name' };
    }
    try {
        const { getTenantContext } = await import('@/lib/erp-api');
        const context = await getTenantContext();
        // NOTE: context may be null on the SaaS root domain — this is fine.
        // Django resolves the org from the auth token in that case.

        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        const DJANGO_URL = process.env.DJANGO_URL || 'http://backend:8000';
        const targetUrl = `${DJANGO_URL}/api/organizations/me-theme/`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (token) headers['Authorization'] = `Token ${token}`;
        // Forward tenant context when available (tenant subdomains)
        if (context) {
            headers['X-Tenant-Id'] = context.id;
            headers['X-Tenant-Slug'] = context.slug;
        }

        const response = await fetch(targetUrl, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ default_theme: theme }),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Theme Action] Target URL failed: ${targetUrl} - HTTP ${response.status} - ${errorText.substring(0, 100)}`);
            return { ok: false, error: `Failed to update org theme (HTTP ${response.status})` };
        }

        return { ok: true };
    } catch (e: unknown) {
        console.error('[Theme Action] Exception:', e);
        return {
            ok: false,
            error: e instanceof Error ? e.message : 'Failed to update org theme',
        };
    }
}
