'use client';

import { useSupermarcheTheme } from './ThemeProvider';
export type { ThemeName, SupermarcheThemeTokens } from './themes';

// Re-export the hook for convenience
export { useSupermarcheTheme } from './ThemeProvider';

/**
 * useSupermarcheThemeTokens — returns just the token map string for a specific CSS var.
 * Useful for reading theme values in JS (e.g., for chart colors).
 */
export function useThemeToken(varName: string): string {
    const { themeData } = useSupermarcheTheme();
    return themeData.tokens[varName] ?? '';
}

/**
 * useIsDarkTheme — returns true if the active theme has a dark background.
 */
export function useIsDarkTheme(): boolean {
    const { theme } = useSupermarcheTheme();
    return theme === 'midnight-pro' || theme === 'neon-rush';
}
