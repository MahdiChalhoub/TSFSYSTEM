'use server';

/**
 * Theme Settings — Server Actions
 * ================================
 * Persist user theme preference in an httpOnly cookie so the server
 * can read it on the first render (zero-flicker, even without localStorage).
 *
 * Cookie: tsfsystem-app-theme
 *   - httpOnly: false  → client can read it for SSR pre-fill
 *   - sameSite: lax
 *   - path: /
 *   - maxAge: 1 year
 */

import { cookies } from 'next/headers';

export type AppThemeName =
    | 'midnight-pro'
    | 'ivory-market'
    | 'neon-rush'
    | 'savane-earth'
    | 'arctic-glass';

const VALID_THEMES: AppThemeName[] = [
    'midnight-pro',
    'ivory-market',
    'neon-rush',
    'savane-earth',
    'arctic-glass',
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
    cookieStore.set(THEME_COOKIE, theme, {
        httpOnly: false,       // client-readable so ThemeScript can SSR-prime
        secure: false,         // set to true behind HTTPS in production via env check
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,   // 1 year
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
        const { erpFetch } = await import('@/lib/erp-api');
        const data = await erpFetch('organizations/me/theme/');
        const theme = data?.default_theme as AppThemeName | null;
        return theme && VALID_THEMES.includes(theme) ? theme : null;
    } catch {
        // Not logged in yet, org context missing, or network error — silently return null
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
        const { erpFetch } = await import('@/lib/erp-api');
        await erpFetch('organizations/me/theme/', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ default_theme: theme }),
        });
        return { ok: true };
    } catch (e: unknown) {
        return {
            ok: false,
            error: e instanceof Error ? e.message : 'Failed to update org theme',
        };
    }
}
