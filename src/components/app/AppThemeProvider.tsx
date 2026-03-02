'use client';

/**
 * AppThemeProvider — synchronous theme injection + runtime switching
 *
 * Load order (zero flicker):
 * 1. ThemeScript (in root layout <head>) sets class on <html> synchronously
 * from localStorage BEFORE first paint
 * 2. AppThemeProvider hydrates, reads same localStorage value
 * 3. On setTheme: update localStorage → update <html> class immediately
 * 4. Phase 5: fire setOrgTheme() server action IN BACKGROUND (no blocking)
 */

import React, {
 createContext,
 useCallback,
 useContext,
 useEffect,
 useMemo,
 useState,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────
export type AppThemeName =
 | 'midnight-pro'
 | 'ivory-market'
 | 'neon-rush'
 | 'savane-earth'
 | 'arctic-glass';

export interface AppThemeInfo {
 name: AppThemeName;
 label: string;
 mode: 'dark' | 'light';
 primary: string;
 bg: string;
 surface: string;
 previewGradient: string;
 description: string;
}

export const APP_THEMES: AppThemeInfo[] = [
 {
 name: 'midnight-pro',
 label: 'Midnight Pro',
 mode: 'dark',
 primary: '#10B981',
 bg: '#020617',
 surface: '#0F172A',
 previewGradient: 'linear-gradient(135deg, #020617 0%, #0F172A 50%, #10B981 100%)',
 description: 'Dark luxury glassmorphism',
 },
 {
 name: 'ivory-market',
 label: 'Ivory Market',
 mode: 'light',
 primary: '#6366F1',
 bg: '#F8FAFC',
 surface: '#FFFFFF',
 previewGradient: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 50%, #6366F1 100%)',
 description: 'Clean & minimal, Apple-like',
 },
 {
 name: 'neon-rush',
 label: 'Neon Rush',
 mode: 'dark',
 primary: '#8B5CF6',
 bg: '#09090B',
 surface: '#111113',
 previewGradient: 'linear-gradient(135deg, #09090B 0%, #111113 50%, #8B5CF6 100%)',
 description: 'Cyberpunk energy',
 },
 {
 name: 'savane-earth',
 label: 'Savane Earth',
 mode: 'light',
 primary: '#D97706',
 bg: '#FEF3C7',
 surface: '#FFFBEB',
 previewGradient: 'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 50%, #D97706 100%)',
 description: 'Warm West African market',
 },
 {
 name: 'arctic-glass',
 label: 'Arctic Glass',
 mode: 'light',
 primary: '#0EA5E9',
 bg: '#EFF6FF',
 surface: 'rgba(255,255,255,0.75)',
 previewGradient: 'linear-gradient(135deg, #EFF6FF 0%, rgba(255,255,255,0.9) 50%, #0EA5E9 100%)',
 description: 'Cold premium glass',
 },
];

export const APP_THEME_MAP: Record<AppThemeName, AppThemeInfo> = Object.fromEntries(
 APP_THEMES.map((t) => [t.name, t])
) as Record<AppThemeName, AppThemeInfo>;

const ALL_THEME_CLASSES = APP_THEMES.map((t) => `theme-${t.name}`);
const LOCAL_STORAGE_KEY = 'tsfsystem-app-theme';
export const DEFAULT_THEME: AppThemeName = 'midnight-pro';

// ── Pure helper: apply class to <html> immediately ───────────────
function applyThemeToDOM(name: AppThemeName): void {
 if (typeof document === 'undefined') return;
 const root = document.documentElement;
 // Remove all theme classes in one shot
 root.classList.remove(...ALL_THEME_CLASSES);
 root.classList.add(`theme-${name}`);
 // Sync shadcn/ui dark mode class
 const info = APP_THEME_MAP[name];
 if (info.mode === 'dark') root.classList.add('dark');
 else root.classList.remove('dark');
}

// ── Context ───────────────────────────────────────────────────────
interface AppThemeContextValue {
 theme: AppThemeName;
 themeInfo: AppThemeInfo;
 isDark: boolean;
 setTheme: (name: AppThemeName) => void;
 themes: AppThemeInfo[];
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────
export function AppThemeProvider({
 children,
 serverTheme, // from org settings (Phase 5: pass via server component)
}: {
 children: React.ReactNode;
 serverTheme?: AppThemeName;
}) {
 // Read synchronously — by the time JS hydrates, ThemeScript already painted
 const [theme, setThemeState] = useState<AppThemeName>(() => {
 if (typeof window === 'undefined') return serverTheme ?? DEFAULT_THEME;
 const stored = localStorage.getItem(LOCAL_STORAGE_KEY) as AppThemeName | null;
 // Validate stored value to prevent unexpected CSS class
 const valid = stored && APP_THEME_MAP[stored] ? stored : null;
 return valid ?? serverTheme ?? DEFAULT_THEME;
 });

 // On mount: if server theme differs from localStorage, localStorage wins (faster UX)
 // but log for Phase 5 to sync back
 useEffect(() => {
 applyThemeToDOM(theme);
 }, []); // eslint-disable-line react-hooks/exhaustive-deps

 const setTheme = useCallback((name: AppThemeName) => {
 if (name === theme) return;
 // 1. Apply to DOM immediately (no delay)
 applyThemeToDOM(name);
 // 2. Update React state
 setThemeState(name);
 // 3. Persist to localStorage (instant client-side)
 localStorage.setItem(LOCAL_STORAGE_KEY, name);
 // 4. Persist to server cookie in background (zero-blocking)
 import('@/app/actions/settings/theme')
 .then(({ setOrgTheme }) => setOrgTheme(name))
 .catch(() => { /* non-fatal: localStorage already persisted */ });
 }, [theme]);

 const themeInfo = APP_THEME_MAP[theme];
 const isDark = themeInfo.mode === 'dark';

 const value = useMemo<AppThemeContextValue>(
 () => ({ theme, themeInfo, isDark, setTheme, themes: APP_THEMES }),
 [theme, themeInfo, isDark, setTheme]
 );

 return (
 <AppThemeContext.Provider value={value}>
 {children}
 </AppThemeContext.Provider>
 );
}

// ── Hook ──────────────────────────────────────────────────────────
export function useAppTheme(): AppThemeContextValue {
 const ctx = useContext(AppThemeContext);
 if (!ctx) throw new Error('useAppTheme must be used within <AppThemeProvider>');
 return ctx;
}

// ── ThemeScript — inject synchronously into <head> ────────────────
// Usage: <ThemeScript /> inside root layout <head> BEFORE any CSS
// This sets the theme class on <html> synchronously before first paint
// eliminating any possible flash of wrong theme.
export function ThemeScript() {
 const script = `
(function(){
 try {
 var k = '${LOCAL_STORAGE_KEY}';
 var valid = ['midnight-pro','ivory-market','neon-rush','savane-earth','arctic-glass'];
 var stored = localStorage.getItem(k);
 var theme = (stored && valid.indexOf(stored) !== -1) ? stored : '${DEFAULT_THEME}';
 var root = document.documentElement;
 valid.forEach(function(t){ root.classList.remove('theme-' + t); });
 root.classList.add('theme-' + theme);
 // Dark mode sync
 var dark = ['midnight-pro','neon-rush'];
 if (dark.indexOf(theme) !== -1) root.classList.add('dark');
 else root.classList.remove('dark');
 } catch(e) {}
})();
`.trim();

 return (
 <script
 // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional synchronous theme injection
 dangerouslySetInnerHTML={{ __html: script }}
 />
 );
}
