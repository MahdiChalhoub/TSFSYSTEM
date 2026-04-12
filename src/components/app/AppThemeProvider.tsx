'use client';

/**
 * AppThemeProvider — THE SINGLE UNIFIED THEME ENGINE
 * ===================================================
 * Controls everything: colors, layout, components, typography, navigation.
 * 
 * Architecture:
 * 1. ThemeScript (in root layout <head>) sets .theme-{slug} class SYNCHRONOUSLY
 *    from localStorage BEFORE first paint → zero flicker
 * 2. CSS file (app-theme-engine.css) has fallback defaults for built-in themes
 * 3. This provider loads FULL theme config from Django DB on mount
 * 4. Runtime CSS vars override CSS defaults → full flexibility
 * 5. On theme change: DOM → localStorage → cookie → backend (all non-blocking)
 *
 * Replaces:
 * - ThemeContext.tsx (ARCHIVED)
 * - UnifiedThemeEngine.tsx (ARCHIVED)
 */

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import type {
    ThemePreset,
    ColorMode,
    ColorScheme,
    LayoutConfig,
    ComponentConfig,
    NavigationConfig,
    CreateThemeInput,
    ThemeCategory,
} from '@/types/theme';
import { CSS_VARIABLES } from '@/types/theme';

// ── Constants ─────────────────────────────────────────────────────
const LOCAL_STORAGE_KEY = 'tsfsystem-app-theme';
const LOCAL_STORAGE_FULL = 'tsfsystem-theme-full'; // Full preset cache
const DEFAULT_SLUG = 'midnight-pro';

// ── Default configs (used before backend loads) ──────────────────
const DEFAULT_COLORS: ColorScheme = {
    primary: '#10B981',
    primaryDark: '#059669',
    bg: '#020617',
    surface: '#0F172A',
    surfaceHover: 'rgba(255, 255, 255, 0.07)',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    border: 'rgba(255, 255, 255, 0.08)',
};

const DEFAULT_LAYOUT: LayoutConfig = {
    density: 'medium',
    whitespace: 'balanced',
    structure: 'single-column',
    spacing: { container: '1.5rem', section: '1.75rem', card: '1.25rem', element: '0.875rem' },
};

const DEFAULT_COMPONENTS: ComponentConfig = {
    cards: { borderRadius: '0.75rem', shadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--app-border)', padding: '1.25rem', style: 'subtle' },
    buttons: { borderRadius: '0.5rem', height: '2.5rem', padding: '0 1.25rem', fontSize: '0.875rem', fontWeight: '500' },
    inputs: { borderRadius: '0.5rem', height: '2.5rem', padding: '0 0.875rem', fontSize: '0.875rem', border: '1px solid var(--app-border)' },
    typography: { headingFont: "'Outfit', sans-serif", bodyFont: "'Outfit', sans-serif", h1Size: '2rem', h2Size: '1.5rem', h3Size: '1.25rem', bodySize: '0.875rem', smallSize: '0.75rem', fontWeight: 'medium', lineHeight: 'normal', letterSpacing: 'normal' },
    tables: { rowHeight: '3rem', headerStyle: 'bold', borderStyle: 'rows', striped: false, hoverEffect: true, density: 'comfortable' },
    modals: { maxWidth: '600px', borderRadius: '0.75rem', padding: '1.5rem', backdrop: 'blur', animation: 'scale', shadow: '0 20px 25px -5px rgba(0,0,0,0.1)' },
    forms: { labelPosition: 'top', labelStyle: 'bold', fieldSpacing: '1rem', groupSpacing: '1.5rem', validationStyle: 'inline' },
    tabs: { style: 'underline', size: 'md', spacing: '1.5rem', activeIndicator: 'underline' },
    badges: { size: 'sm', style: 'soft', borderRadius: '0.375rem', fontWeight: '600', textTransform: 'uppercase' },
    alerts: { style: 'soft', borderRadius: '0.5rem', padding: '1rem', iconSize: '1.25rem', showIcon: true },
};

const DEFAULT_NAVIGATION: NavigationConfig = {
    position: 'side',
    style: 'minimal',
    width: '240px',
    collapsible: true,
};

// ── Apply ALL CSS variables to DOM ──────────────────────────────
function applyFullThemeToDOM(
    colors: ColorScheme,
    layout: LayoutConfig,
    components: ComponentConfig,
    navigation: NavigationConfig,
    slug: string,
    colorMode: ColorMode,
) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const r = root.style;

    // ── Colors ──
    r.setProperty('--app-primary', colors.primary);
    r.setProperty('--app-primary-dark', colors.primaryDark);
    r.setProperty('--app-primary-light', colors.primary + '1f');
    r.setProperty('--app-primary-glow', colors.primary + '59');
    r.setProperty('--app-bg', colors.bg);
    r.setProperty('--app-surface', colors.surface);
    r.setProperty('--app-surface-2', colors.surfaceHover);
    r.setProperty('--app-surface-hover', colors.surfaceHover);
    r.setProperty('--app-text', colors.text);
    r.setProperty('--app-text-muted', colors.textMuted);
    r.setProperty('--app-text-faint', colors.textMuted);
    r.setProperty('--app-border', colors.border);
    r.setProperty('--app-border-strong', colors.border);
    // Sidebar
    r.setProperty('--app-sidebar-bg', colors.bg);
    r.setProperty('--app-sidebar-surface', `color-mix(in srgb, ${colors.primary} 5%, ${colors.surface})`);
    r.setProperty('--app-sidebar-text', colors.text);
    r.setProperty('--app-sidebar-muted', colors.textMuted);
    r.setProperty('--app-sidebar-active', `color-mix(in srgb, ${colors.primary} 8%, transparent)`);
    r.setProperty('--app-sidebar-border', colors.border);
    // Status
    r.setProperty('--app-success', colors.success || '#10B981');
    r.setProperty('--app-warning', colors.warning || '#F59E0B');
    r.setProperty('--app-error', colors.error || '#EF4444');
    r.setProperty('--app-info', '#3B82F6');

    // ── Layout ──
    r.setProperty('--layout-container-padding', layout.spacing?.container || '1.5rem');
    r.setProperty('--layout-section-spacing', layout.spacing?.section || '1.75rem');
    r.setProperty('--layout-card-padding', layout.spacing?.card || '1.25rem');
    r.setProperty('--layout-element-gap', layout.spacing?.element || '0.875rem');
    r.setProperty('--layout-density', layout.density || 'medium');
    document.documentElement.setAttribute('data-density', layout.density || 'medium');

    // ── Components ──
    r.setProperty('--card-radius', components.cards?.borderRadius || '0.75rem');
    r.setProperty('--card-shadow', components.cards?.shadow || '0 1px 3px rgba(0,0,0,0.1)');
    r.setProperty('--card-border', components.cards?.border || '1px solid var(--app-border)');
    r.setProperty('--card-padding', components.cards?.padding || '1.25rem');

    // Sync legacy base vars for components using them
    r.setProperty('--app-radius', components.cards?.borderRadius || '1rem');
    r.setProperty('--app-shadow-sm', components.cards?.shadow || '0 1px 4px rgba(0,0,0,0.06)');

    r.setProperty('--button-radius', components.buttons?.borderRadius || '0.5rem');
    r.setProperty('--button-height', components.buttons?.height || '2.5rem');
    r.setProperty('--button-padding', components.buttons?.padding || '0 1.25rem');
    r.setProperty('--button-font-size', components.buttons?.fontSize || '0.875rem');
    r.setProperty('--button-font-weight', components.buttons?.fontWeight || '600');

    r.setProperty('--input-radius', components.inputs?.borderRadius || '0.5rem');
    r.setProperty('--input-height', components.inputs?.height || '2.5rem');
    r.setProperty('--input-padding', components.inputs?.padding || '0 0.875rem');
    r.setProperty('--input-font-size', components.inputs?.fontSize || '0.875rem');
    r.setProperty('--input-border', components.inputs?.border || '1px solid var(--app-border)');

    // Typography
    r.setProperty('--font-heading', components.typography?.headingFont || "'Outfit', sans-serif");
    r.setProperty('--font-body', components.typography?.bodyFont || "'Outfit', sans-serif");
    r.setProperty('--font-size-h1', components.typography?.h1Size || '2rem');
    r.setProperty('--font-size-h2', components.typography?.h2Size || '1.5rem');
    r.setProperty('--font-size-h3', components.typography?.h3Size || '1.25rem');
    r.setProperty('--font-size-body', components.typography?.bodySize || '0.875rem');
    r.setProperty('--font-size-small', components.typography?.smallSize || '0.75rem');
    r.setProperty('--font-weight-normal', components.typography?.fontWeight || '400');
    r.setProperty('--font-line-height', components.typography?.lineHeight || '1.5');

    // Sync legacy base font vars
    r.setProperty('--app-font', components.typography?.bodyFont || 'Inter, sans-serif');
    r.setProperty('--app-font-display', components.typography?.headingFont || 'Outfit, sans-serif');
    // Tables
    r.setProperty('--table-row-height', components.tables?.rowHeight || '3rem');
    r.setProperty('--table-density', components.tables?.density || 'comfortable');
    // Modals
    r.setProperty('--modal-max-width', components.modals?.maxWidth || '600px');
    r.setProperty('--modal-radius', components.modals?.borderRadius || '0.75rem');
    r.setProperty('--modal-padding', components.modals?.padding || '1.5rem');
    r.setProperty('--modal-shadow', components.modals?.shadow || '0 20px 25px -5px rgba(0,0,0,0.1)');
    // Forms
    r.setProperty('--form-field-spacing', components.forms?.fieldSpacing || '1rem');
    r.setProperty('--form-group-spacing', components.forms?.groupSpacing || '1.5rem');
    // Navigation
    r.setProperty('--nav-width', navigation.width || '240px');

    // ── Theme class + dark mode ──
    const allClasses = Array.from(root.classList).filter(c => c.startsWith('theme-'));
    allClasses.forEach(c => root.classList.remove(c));
    root.classList.add(`theme-${slug}`);

    const effectiveMode = colorMode === 'auto' ? getSystemColorMode() : colorMode;
    if (effectiveMode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    // Data attributes
    root.setAttribute('data-theme', slug);
    root.setAttribute('data-color-mode', effectiveMode);
    root.setAttribute('data-layout-density', layout.density || 'medium');
}

function getSystemColorMode(): 'dark' | 'light' {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ── Context ───────────────────────────────────────────────────────
interface AppThemeContextValue {
    // Current state
    currentTheme: ThemePreset | null;
    colorMode: ColorMode;
    isDark: boolean;
    isLoading: boolean;
    error: string | null;

    // Theme lists
    systemThemes: ThemePreset[];
    customThemes: ThemePreset[];
    allThemes: ThemePreset[];

    // Active computed configs
    activeColors: ColorScheme;
    activeLayout: LayoutConfig;
    activeComponents: ComponentConfig;
    activeNavigation: NavigationConfig;

    // Actions
    setTheme: (slug: string) => void;
    toggleColorMode: () => void;
    setColorMode: (mode: ColorMode) => void;
    refreshThemes: () => Promise<void>;

    // Live Patching
    patchActiveTheme: (updates: Partial<ThemePreset['presetData']>) => Promise<void>;

    // CRUD (for settings pages)
    createTheme: (input: CreateThemeInput) => Promise<ThemePreset>;
    updateTheme: (id: number, updates: Partial<ThemePreset>) => Promise<ThemePreset>;
    deleteTheme: (id: number) => Promise<void>;
    exportTheme: (slug: string) => Promise<string>;
    importTheme: (json: string) => Promise<ThemePreset>;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────
export function AppThemeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    // ── Initialize from localStorage cache (before any useEffect) ──
    const getInitial = () => {
        if (typeof window === 'undefined') return { theme: null, colorMode: 'dark' as ColorMode, slug: DEFAULT_SLUG };

        try {
            const cached = localStorage.getItem(LOCAL_STORAGE_FULL);
            if (cached) {
                const parsed = JSON.parse(cached);
                return {
                    theme: parsed.currentTheme || null,
                    colorMode: (parsed.colorMode || 'dark') as ColorMode,
                    slug: parsed.currentTheme?.slug || localStorage.getItem(LOCAL_STORAGE_KEY) || DEFAULT_SLUG,
                };
            }
        } catch { /* noop */ }

        return { theme: null, colorMode: 'dark' as ColorMode, slug: localStorage.getItem(LOCAL_STORAGE_KEY) || DEFAULT_SLUG };
    };

    const initial = getInitial();

    // ⚡ FOUC Prevention: apply cached theme IMMEDIATELY (before useEffect fires)
    if (initial.theme && typeof window !== 'undefined') {
        const effectiveMode = initial.colorMode === 'auto' ? getSystemColorMode() : initial.colorMode;
        const colors = initial.theme.presetData?.colors?.[effectiveMode] || DEFAULT_COLORS;
        const layout = initial.theme.presetData?.layout || DEFAULT_LAYOUT;
        const components = initial.theme.presetData?.components || DEFAULT_COMPONENTS;
        const navigation = initial.theme.presetData?.navigation || DEFAULT_NAVIGATION;
        applyFullThemeToDOM(colors, layout, components, navigation, initial.slug, initial.colorMode);
    }

    // State
    const [currentTheme, setCurrentTheme] = useState<ThemePreset | null>(initial.theme);
    const [colorMode, setColorModeState] = useState<ColorMode>(initial.colorMode);
    const [systemThemes, setSystemThemes] = useState<ThemePreset[]>([]);
    const [customThemes, setCustomThemes] = useState<ThemePreset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const allThemes = useMemo(() => [...systemThemes, ...customThemes], [systemThemes, customThemes]);

    // ── Compute active configs ──
    const activeColors = useMemo<ColorScheme>(() => {
        if (!currentTheme) return DEFAULT_COLORS;
        const effectiveMode = colorMode === 'auto' ? getSystemColorMode() : colorMode;
        return currentTheme.presetData?.colors?.[effectiveMode] || DEFAULT_COLORS;
    }, [currentTheme, colorMode]);

    const activeLayout = useMemo<LayoutConfig>(() => currentTheme?.presetData?.layout || DEFAULT_LAYOUT, [currentTheme]);
    const activeComponents = useMemo<ComponentConfig>(() => currentTheme?.presetData?.components || DEFAULT_COMPONENTS, [currentTheme]);
    const activeNavigation = useMemo<NavigationConfig>(() => currentTheme?.presetData?.navigation || DEFAULT_NAVIGATION, [currentTheme]);
    const isDark = useMemo(() => {
        const mode = colorMode === 'auto' ? getSystemColorMode() : colorMode;
        return mode === 'dark';
    }, [colorMode]);

    // ── Load themes from backend on mount ──
    useEffect(() => { loadFromBackend(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Apply CSS vars when theme/mode changes ──
    useEffect(() => {
        if (!currentTheme) return;
        applyFullThemeToDOM(activeColors, activeLayout, activeComponents, activeNavigation, currentTheme.slug, colorMode);
    }, [currentTheme, colorMode, activeColors, activeLayout, activeComponents, activeNavigation]);

    // ── Persist to localStorage ──
    useEffect(() => {
        if (!currentTheme || typeof window === 'undefined') return;
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, currentTheme.slug);
            localStorage.setItem(LOCAL_STORAGE_FULL, JSON.stringify({ currentTheme, colorMode }));
        } catch { /* noop */ }
    }, [currentTheme, colorMode]);

    // ── Backend loading ──
    async function loadFromBackend() {
        try {
            setIsLoading(true);
            setError(null);

            // Client-side fetch via proxy
            const response = await fetch('/api/proxy/ui-themes', {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });

            if (response.ok) {
                const data = await response.json();
                const system = (data.system || []).map(transformThemeFromAPI);
                const custom = (data.custom || []).map(transformThemeFromAPI);
                setSystemThemes(system);
                setCustomThemes(custom);

                // Only override localStorage if no cached theme
                if (!initial.theme) {
                    const slug = data.current?.theme_slug || DEFAULT_SLUG;
                    const all = [...system, ...custom];
                    const found = all.find(t => t.slug === slug) || system[0];
                    if (found) setCurrentTheme(found);

                    const mode = data.current?.color_mode || 'dark';
                    setColorModeState(mode as ColorMode);
                }
            } else {
                console.warn('[ThemeEngine] Backend fetch failed:', response.status);
            }
        } catch (err) {
            console.warn('[ThemeEngine] Backend unavailable, using cached theme');
            setError(err instanceof Error ? err.message : 'Failed to load themes');
        } finally {
            setIsLoading(false);
        }
    }

    // ── Actions ──
    const setTheme = useCallback((slug: string) => {
        const theme = allThemes.find(t => t.slug === slug);
        if (!theme) return;

        setCurrentTheme(theme);

        // Persist to cookie (server-readable)
        import('@/app/actions/settings/theme')
            .then(({ setOrgTheme }) => setOrgTheme(slug as any))
            .catch(() => { /* non-fatal */ });

        // Activate on backend
        fetch(`/api/proxy/ui-themes/${theme.id}/activate`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
        }).catch(() => { /* non-fatal */ });
    }, [allThemes]);

    const toggleColorMode = useCallback(() => {
        const newMode: ColorMode = colorMode === 'dark' ? 'light' : 'dark';
        setColorModeState(newMode);

        // Persist
        fetch('/api/proxy/ui-themes/toggle-mode', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: newMode }),
        }).catch(() => { /* non-fatal */ });
    }, [colorMode]);

    const setColorMode = useCallback((mode: ColorMode) => {
        setColorModeState(mode);
    }, []);

    const refreshThemes = useCallback(async () => {
        await loadFromBackend();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── CRUD for settings  ──
    const createThemeFn = useCallback(async (input: CreateThemeInput): Promise<ThemePreset> => {
        const res = await fetch('/api/proxy/ui-themes/create', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error('Failed to create theme');
        const data = await res.json();
        const theme = transformThemeFromAPI(data);
        await loadFromBackend();
        return theme;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const updateThemeFn = useCallback(async (id: number, updates: Partial<ThemePreset>): Promise<ThemePreset> => {
        const res = await fetch(`/api/proxy/ui-themes/${id}/update`, {
            method: 'PATCH', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        if (!res.ok) {
            const err = await res.text();
            console.error('[ThemeEngine] Update failed:', err);
            throw new Error('Failed to update theme');
        }
        const data = await res.json();
        const theme = transformThemeFromAPI(data);
        await loadFromBackend();
        return theme;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const patchActiveTheme = useCallback(async (updates: Partial<ThemePreset['presetData']>) => {
        if (!currentTheme) return;

        // Recursive merge helper
        const deepMerge = (target: any, source: any) => {
            const output = { ...target };
            if (source && typeof source === 'object' && !Array.isArray(source)) {
                Object.keys(source).forEach(key => {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        output[key] = deepMerge(target[key] || {}, source[key]);
                    } else {
                        output[key] = source[key];
                    }
                });
            }
            return output;
        };

        const mergedPreset = deepMerge(currentTheme.presetData, updates);

        const updatedTheme = { ...currentTheme, presetData: mergedPreset };
        setCurrentTheme(updatedTheme);

        // Persist to backend
        try {
            await updateThemeFn(currentTheme.id, { preset_data: mergedPreset } as any);
        } catch (err) {
            console.error('[ThemeEngine] Failed to persist patch:', err);
            await loadFromBackend();
        }
    }, [currentTheme, updateThemeFn]); // eslint-disable-line react-hooks/exhaustive-deps

    const deleteThemeFn = useCallback(async (id: number): Promise<void> => {
        const res = await fetch(`/api/proxy/ui-themes/${id}/delete`, {
            method: 'DELETE', credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to delete theme');
        await loadFromBackend();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const exportThemeFn = useCallback(async (slug: string): Promise<string> => {
        const theme = allThemes.find(t => t.slug === slug);
        if (!theme) throw new Error('Theme not found');
        const res = await fetch(`/api/proxy/ui-themes/${theme.id}/export`, { credentials: 'include' });
        if (!res.ok) throw new Error('Export failed');
        const data = await res.json();
        return JSON.stringify(data, null, 2);
    }, [allThemes]);

    const importThemeFn = useCallback(async (json: string): Promise<ThemePreset> => {
        const themeData = JSON.parse(json);
        const res = await fetch('/api/proxy/ui-themes/import', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(themeData),
        });
        if (!res.ok) throw new Error('Import failed');
        const data = await res.json();
        const theme = transformThemeFromAPI(data);
        await loadFromBackend();
        return theme;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Context value ──
    const value = useMemo<AppThemeContextValue>(() => ({
        currentTheme,
        colorMode,
        isDark,
        isLoading,
        error,
        systemThemes,
        customThemes,
        allThemes,
        activeColors,
        activeLayout,
        activeComponents,
        activeNavigation,
        setTheme,
        toggleColorMode,
        setColorMode,
        refreshThemes,
        patchActiveTheme,
        createTheme: createThemeFn,
        updateTheme: updateThemeFn,
        deleteTheme: deleteThemeFn,
        exportTheme: exportThemeFn,
        importTheme: importThemeFn,
    }), [
        currentTheme, colorMode, isDark, isLoading, error,
        systemThemes, customThemes, allThemes,
        activeColors, activeLayout, activeComponents, activeNavigation,
        setTheme, toggleColorMode, setColorMode, refreshThemes,
        createThemeFn, updateThemeFn, deleteThemeFn, exportThemeFn, importThemeFn,
    ]);

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
// Sets theme class BEFORE first paint. Zero flicker.
export function ThemeScript() {
    const script = `
(function(){
 try {
 var k = '${LOCAL_STORAGE_KEY}';
 var kFull = '${LOCAL_STORAGE_FULL}';
 var stored = localStorage.getItem(k);
 if (!stored) {
   var match = document.cookie.match(new RegExp('(^| )' + k + '=([^;]+)'));
   if (match) stored = match[2];
 }
 var theme = stored || '${DEFAULT_SLUG}';
 var root = document.documentElement;
 // Remove old theme classes
 var classes = Array.from(root.classList).filter(function(c){ return c.indexOf('theme-') === 0; });
 classes.forEach(function(c){ root.classList.remove(c); });
 root.classList.add('theme-' + theme);
 // Apply dark mode from cached preset if available
 var colorMode = 'dark';
 try {
   var full = JSON.parse(localStorage.getItem(kFull) || '{}');
   if (full.colorMode) colorMode = full.colorMode;
   // Apply cached colors immediately for zero-flicker
   var colors = full.currentTheme && full.currentTheme.presetData && full.currentTheme.presetData.colors;
   if (colors) {
     var c = colors[colorMode] || colors.dark;
     if (c) {
       var s = root.style;
       s.setProperty('--app-bg', c.bg || '');
       s.setProperty('--app-surface', c.surface || '');
       s.setProperty('--app-text', c.text || '');
       s.setProperty('--app-primary', c.primary || '');
       s.setProperty('--app-border', c.border || '');
       s.setProperty('--app-text-muted', c.textMuted || '');
     }
   }
 } catch(e){}
 if (colorMode === 'dark') root.classList.add('dark');
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

// ── Helpers ───────────────────────────────────────────────────────
function darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return '#' + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

function enrichColors(colors: any): ColorScheme {
    return {
        primary: colors.primary || '#10B981',
        primaryDark: colors.primaryDark || darkenColor(colors.primary || '#10B981', 10),
        bg: colors.bg || '#020617',
        surface: colors.surface || '#0F172A',
        surfaceHover: colors.surfaceHover || 'rgba(255, 255, 255, 0.07)',
        text: colors.text || '#F1F5F9',
        textMuted: colors.textMuted || colors.muted || '#94A3B8',
        border: colors.border || 'rgba(255, 255, 255, 0.08)',
    };
}

function transformThemeFromAPI(apiTheme: any): ThemePreset {
    return {
        id: apiTheme.id,
        slug: apiTheme.slug,
        name: apiTheme.name,
        description: apiTheme.description,
        category: apiTheme.category,
        isSystem: apiTheme.is_system,
        isActive: apiTheme.is_active ?? true,
        isDefault: apiTheme.is_default ?? false,
        tags: apiTheme.tags || [],
        presetData: {
            colors: {
                dark: enrichColors(apiTheme.preset_data?.colors?.dark || {}),
                light: enrichColors(apiTheme.preset_data?.colors?.light || {}),
            },
            layout: apiTheme.preset_data?.layout || DEFAULT_LAYOUT,
            components: apiTheme.preset_data?.components || DEFAULT_COMPONENTS,
            navigation: apiTheme.preset_data?.navigation || DEFAULT_NAVIGATION,
        },
        usageCount: apiTheme.usage_count,
        lastUsedAt: apiTheme.last_used_at,
        createdAt: apiTheme.created_at,
        updatedAt: apiTheme.updated_at,
    };
}

// ── Re-exports for backward compat ────────────────────────────────
export type AppThemeName = string; // Now dynamic, not hardcoded enum
