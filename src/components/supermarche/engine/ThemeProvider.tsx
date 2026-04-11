'use client';

import React, {
 createContext,
 useContext,
 useEffect,
 useState,
 useCallback,
 useMemo,
} from 'react';
import { THEME_MAP, THEMES, DEFAULT_THEME, type ThemeName, type SupermarcheThemeTokens } from './themes';

// ── Types ──────────────────────────────────────────────────
interface ThemeContextValue {
 theme: ThemeName;
 themeData: SupermarcheThemeTokens;
 allThemes: SupermarcheThemeTokens[];
 setTheme: (name: ThemeName) => void;
 isChanging: boolean;
}

// ── Context ────────────────────────────────────────────────
const ThemeContext = createContext<ThemeContextValue | null>(null);

const LS_KEY = 'supermarche-theme';

// ── Helpers ────────────────────────────────────────────────
function applyTokens(tokens: Record<string, string>, root: HTMLElement): void {
 Object.entries(tokens).forEach(([prop, value]) => {
 root.style.setProperty(prop, value);
 });
}

function removeTokens(tokens: Record<string, string>, root: HTMLElement): void {
 Object.keys(tokens).forEach((prop) => {
 root.style.removeProperty(prop);
 });
}

function getSavedTheme(): ThemeName {
 if (typeof window === 'undefined') return DEFAULT_THEME;
 try {
 const saved = localStorage.getItem(LS_KEY) as ThemeName | null;
 return saved && THEME_MAP[saved] ? saved : DEFAULT_THEME;
 } catch {
 return DEFAULT_THEME;
 }
}

// ── Provider ───────────────────────────────────────────────
interface ThemeProviderProps {
 children: React.ReactNode;
 /** Optional org-level theme override (from server) */
 defaultTheme?: ThemeName;
}

export function SupermarcheThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
 const [theme, setThemeState] = useState<ThemeName>(defaultTheme ?? DEFAULT_THEME);
 const [isChanging, setIsChanging] = useState(false);

 // Hydrate from localStorage on mount
 useEffect(() => {
 const saved = getSavedTheme();
 const initial = defaultTheme ?? saved;
 setThemeState(initial);
 }, [defaultTheme]);

 // Inject CSS variables whenever theme changes
 useEffect(() => {
 const root = document.documentElement;
 const data = THEME_MAP[theme];
 if (!data) return;

 // Remove all old sm- vars from all themes
 THEMES.forEach((t) => removeTokens(t.tokens, root));

 // Apply new theme tokens
 applyTokens(data.tokens, root);

 // Mark root with theme name for any CSS targeting
 root.setAttribute('data-sm-theme', theme);
 }, [theme]);

 const setTheme = useCallback((name: ThemeName) => {
 if (!THEME_MAP[name]) return;

 // Add transition class for smooth swap
 document.documentElement.classList.add('sm-theme-transitioning');
 setIsChanging(true);

 setThemeState(name);

 // Persist to localStorage
 try {
 localStorage.setItem(LS_KEY, name);
 } catch { /* silently fail on private browsing */ }

 // Remove transition class after animation
 setTimeout(() => {
 document.documentElement.classList.remove('sm-theme-transitioning');
 setIsChanging(false);
 }, 400);
 }, []);

 const themeData = THEME_MAP[theme] ?? THEME_MAP[DEFAULT_THEME];

 const value = useMemo<ThemeContextValue>(() => ({
 theme,
 themeData,
 allThemes: THEMES,
 setTheme,
 isChanging,
 }), [theme, themeData, setTheme, isChanging]);

 return (
 <ThemeContext.Provider value={value}>
 {children}
 </ThemeContext.Provider>
 );
}

// ── Consumer hook ──────────────────────────────────────────
export function useSupermarcheTheme(): ThemeContextValue {
 const ctx = useContext(ThemeContext);
 if (!ctx) {
 throw new Error('useSupermarcheTheme must be used inside <SupermarcheThemeProvider>');
 }
 return ctx;
}
