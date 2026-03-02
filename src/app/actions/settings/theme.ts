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
 * Read the persisted theme from server cookie.
 * Used in the root layout to avoid flash of default theme.
 */
export async function getPersistedTheme(): Promise<AppThemeName | null> {
    const cookieStore = await cookies();
    const val = cookieStore.get(THEME_COOKIE)?.value as AppThemeName | undefined;
    return val && VALID_THEMES.includes(val) ? val : null;
}
