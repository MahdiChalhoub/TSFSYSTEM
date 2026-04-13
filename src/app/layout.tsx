import type { Metadata } from "next";
import { Outfit, Roboto, Inter } from 'next/font/google';
import "./globals.css";
import { ThemeScript, AppThemeProvider } from '@/components/app/AppThemeProvider';
import { cookies, headers } from 'next/headers';
import { getThemes } from '@/app/actions/theme';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-roboto' });
const inter  = Inter({ subsets: ['latin'], variable: '--font-inter' });

import { PLATFORM_CONFIG } from "@/lib/branding";

export const metadata: Metadata = {
    title: `${PLATFORM_CONFIG.name} | Global System`,
    description: "Multi-Tenant Enterprise OS",
};

// ── Builds a :root{} CSS block from theme colors — injected in <head> so
// colors are present on the very first byte, before any JavaScript runs.
function buildRootThemeCSS(colors: Record<string, string>, layout: any, components: any): string {
    const p  = colors.primary      || '#10B981';
    const pd = colors.primaryDark  || '#059669';
    const bg = colors.bg           || '#020617';
    const sf = colors.surface      || '#0F172A';
    const sh = colors.surfaceHover || 'rgba(255,255,255,0.07)';
    const tx = colors.text         || '#F1F5F9';
    const mt = colors.textMuted    || '#94A3B8';
    const bd = colors.border       || 'rgba(255,255,255,0.08)';
    return `:root{` +
        `--app-primary:${p};--app-primary-dark:${pd};--app-primary-light:${p}1f;--app-primary-glow:${p}59;` +
        `--app-bg:${bg};--app-surface:${sf};--app-surface-2:${sh};--app-surface-hover:${sh};` +
        `--app-text:${tx};--app-text-muted:${mt};--app-text-faint:${mt};` +
        `--app-border:${bd};--app-border-strong:${bd};` +
        `--app-sidebar-bg:${bg};--app-sidebar-surface:color-mix(in srgb,${p} 5%,${sf});` +
        `--app-sidebar-text:${tx};--app-sidebar-muted:${mt};` +
        `--app-sidebar-active:color-mix(in srgb,${p} 8%,transparent);--app-sidebar-border:${bd};` +
        `--app-success:${colors.success||'#10B981'};--app-warning:${colors.warning||'#F59E0B'};` +
        `--app-error:${colors.error||'#EF4444'};--app-info:#3B82F6;` +
        `--layout-container-padding:${layout?.spacing?.container||'1.5rem'};` +
        `--layout-section-spacing:${layout?.spacing?.section||'1.75rem'};` +
        `--layout-card-padding:${layout?.spacing?.card||'1.25rem'};` +
        `--layout-element-gap:${layout?.spacing?.element||'0.875rem'};` +
        `--card-radius:${components?.cards?.borderRadius||'0.75rem'};` +
        `--button-radius:${components?.buttons?.borderRadius||'0.5rem'};` +
        `}`;
}

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // ── Resolve tenant slug from request host ──
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(':')[0].toLowerCase();
    const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || PLATFORM_CONFIG.domain).toLowerCase();
    const parts = host.split('.');
    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host);
    let tenantSlug: string | undefined;
    if (!isIp && !host.includes('localhost')) {
        if (parts.length > 2) tenantSlug = parts[0];
    } else if (host.includes('localhost') && parts.length > 1) {
        tenantSlug = parts[0];
    }
    if (!tenantSlug || tenantSlug === 'www') tenantSlug = 'saas';

    // ── Fetch theme from backend (works both authed and unauthed) ──
    let ssrThemeCSS = '';
    let ssrThemeJSON = '';
    try {
        const themesData = await getThemes(tenantSlug);
        if (themesData) {
            const cookieStore = await cookies();
            const colorMode = (cookieStore.get('tsf_color_mode')?.value === 'light') ? 'light' : 'dark';
            const slug = themesData.current?.theme_slug || 'ant-design';
            const all = [...(themesData.system || []), ...(themesData.custom || [])];
            const theme = all.find((t: any) => t.slug === slug) || all[0];
            if (theme?.presetData?.colors) {
                const colors = theme.presetData.colors[colorMode] || theme.presetData.colors.dark || {};
                ssrThemeCSS = buildRootThemeCSS(colors, theme.presetData.layout, theme.presetData.components);
                // Compact JSON for ThemeScript to read on first paint when localStorage is empty
                ssrThemeJSON = JSON.stringify({
                    slug: theme.slug,
                    colorMode,
                    presetData: theme.presetData,
                });
            }
        }
    } catch {
        // Non-fatal — ThemeScript falls back to localStorage, AppThemeProvider fetches client-side
    }

    return (
        <html lang="en" className="scroll-smooth" suppressHydrationWarning data-scroll-behavior="smooth">
            <head>
                {/* SSR theme: correct colors on byte 1, before any JS runs */}
                {ssrThemeCSS && <style id="ssr-theme" dangerouslySetInnerHTML={{ __html: ssrThemeCSS }} />}
                {/* Serialized theme data for ThemeScript to hydrate from on first visit */}
                {ssrThemeJSON && <script id="__tsf_ssr_theme__" type="application/json" dangerouslySetInnerHTML={{ __html: ssrThemeJSON }} />}
                <ThemeScript />
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" content="#6366f1" />
            </head>
            <body className={`${outfit.variable} ${roboto.variable} ${inter.variable} ${outfit.className}`}>
                <AppThemeProvider>
                    {children}
                </AppThemeProvider>
                <script dangerouslySetInnerHTML={{
                    __html: `
                    if ('serviceWorker' in navigator) {
                        window.addEventListener('load', function() {
                            navigator.serviceWorker.register('/sw.js').then(function(reg) {
                                console.log('[SW] Registered:', reg.scope);
                            }).catch(function(err) {
                                console.warn('[SW] Registration failed:', err);
                            });
                        });
                    }
                `}} />
            </body>
        </html>
    );
}
