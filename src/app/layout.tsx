import type { Metadata } from "next";
import { Outfit, Roboto, Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import "./globals.css";
import { ThemeScript, AppThemeProvider } from '@/components/app/AppThemeProvider';
import { PerfOverlay } from '@/components/dev/PerfOverlay';
import { cookies, headers } from 'next/headers';
import { getThemes } from '@/app/actions/theme';

// Explicit weight list. Without this, next/font ships a single
// optimised file that may render font-black (900) as the closest
// available weight (often 700), making `text-xl font-black` titles
// look thinner than expected. Spelling out every weight we use
// guarantees Tailwind's font-{normal..black} classes match real
// glyphs instead of synthetic-bold fallbacks.
const outfit = Outfit({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800', '900'],
    variable: '--font-outfit',
});
const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-roboto' });
const inter  = Inter({ subsets: ['latin'], variable: '--font-inter' });

import { PLATFORM_CONFIG } from "@/lib/branding";

export const metadata: Metadata = {
    title: `${PLATFORM_CONFIG.name} | Global System`,
    description: "Multi-Tenant Enterprise OS",
    appleWebApp: {
        capable: true,
        title: PLATFORM_CONFIG.name,
        statusBarStyle: 'black-translucent',
    },
    icons: {
        icon: [
            { url: '/favicon.ico' },
            { url: '/favicon.svg', type: 'image/svg+xml' },
        ],
        apple: [
            { url: '/icons/icon-192.png', sizes: '192x192' },
            { url: '/icons/icon-512.png', sizes: '512x512' },
        ],
    },
    formatDetection: {
        telephone: false,
    },
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    viewportFit: 'cover' as const,
    themeColor: '#6366f1',
};

// ── Builds a :root{} CSS block from theme colors — injected in <head> so
// colors are present on the very first byte, before any JavaScript runs.
//
// MUST mirror everything `applyFullThemeToDOM()` in AppThemeProvider writes,
// otherwise SSR's first paint and AppThemeProvider's mount will differ
// visibly (flash of wrong styles). The contract: any var that AppTheme-
// Provider sets MUST also appear here.
//
// Typography intentionally uses CANONICAL values (not theme overrides)
// because AppThemeProvider locks typography to the canonical scale.
function buildRootThemeCSS(colors: any, layout: any, components: any): string {
    const p  = colors.primary      || '#10B981';
    const pd = colors.primaryDark  || '#059669';
    const bg = colors.bg           || '#020617';
    const sf = colors.surface      || '#0F172A';
    const sh = colors.surfaceHover || 'rgba(255,255,255,0.07)';
    const tx = colors.text         || '#F1F5F9';
    const mt = colors.textMuted    || '#94A3B8';
    const bd = colors.border       || 'rgba(255,255,255,0.08)';
    const c  = components || {};
    const cards   = c.cards   || {};
    const btns    = c.buttons || {};
    const inputs  = c.inputs  || {};
    const tables  = c.tables  || {};
    const modals  = c.modals  || {};
    const forms   = c.forms   || {};
    return `:root{` +
        // Colors
        `--app-primary:${p};--app-primary-dark:${pd};--app-primary-light:${p}1f;--app-primary-glow:${p}59;` +
        `--app-bg:${bg};--app-surface:${sf};--app-surface-2:${sh};--app-surface-hover:${sh};` +
        `--app-foreground:${tx};--app-muted-foreground:${mt};` +
        `--app-border:${bd};--app-border-strong:${bd};` +
        // Sidebar
        `--app-sidebar-bg:${bg};--app-sidebar-surface:color-mix(in srgb,${p} 5%,${sf});` +
        `--app-sidebar-text:${tx};--app-sidebar-muted:${mt};` +
        `--app-sidebar-active:color-mix(in srgb,${p} 8%,transparent);--app-sidebar-border:${bd};` +
        // Status
        `--app-success:${colors.success||'#10B981'};--app-warning:${colors.warning||'#F59E0B'};` +
        `--app-error:${colors.error||'#EF4444'};--app-info:#3B82F6;` +
        // Layout / spacing
        `--layout-container-padding:${layout?.spacing?.container||'1.5rem'};` +
        `--layout-section-spacing:${layout?.spacing?.section||'1.75rem'};` +
        `--layout-card-padding:${layout?.spacing?.card||'1.25rem'};` +
        `--layout-element-gap:${layout?.spacing?.element||'0.875rem'};` +
        `--layout-density:${layout?.density||'medium'};` +
        // Cards
        `--card-radius:${cards.borderRadius||'0.75rem'};` +
        `--card-shadow:${cards.shadow||'0 1px 3px rgba(0,0,0,0.1)'};` +
        `--card-border:${cards.border||'1px solid var(--app-border)'};` +
        `--card-padding:${cards.padding||'1.25rem'};` +
        `--app-radius:${cards.borderRadius||'1rem'};` +
        `--app-shadow-sm:${cards.shadow||'0 1px 4px rgba(0,0,0,0.06)'};` +
        // Buttons
        `--button-radius:${btns.borderRadius||'0.5rem'};` +
        `--button-height:${btns.height||'2.5rem'};` +
        `--button-padding:${btns.padding||'0 1.25rem'};` +
        `--button-font-size:${btns.fontSize||'0.875rem'};` +
        `--button-font-weight:${btns.fontWeight||'600'};` +
        // Inputs
        `--input-radius:${inputs.borderRadius||'0.5rem'};` +
        `--input-height:${inputs.height||'2.5rem'};` +
        `--input-padding:${inputs.padding||'0 0.875rem'};` +
        `--input-font-size:${inputs.fontSize||'0.875rem'};` +
        `--input-border:${inputs.border||'1px solid var(--app-border)'};` +
        // Tables
        `--table-row-height:${tables.rowHeight||'3rem'};` +
        `--table-density:${tables.density||'comfortable'};` +
        // Modals
        `--modal-max-width:${modals.maxWidth||'600px'};` +
        `--modal-radius:${modals.borderRadius||'0.75rem'};` +
        `--modal-padding:${modals.padding||'1.5rem'};` +
        `--modal-shadow:${modals.shadow||'0 20px 25px -5px rgba(0,0,0,0.1)'};` +
        // Forms
        `--form-field-spacing:${forms.fieldSpacing||'1rem'};` +
        `--form-group-spacing:${forms.groupSpacing||'1.5rem'};` +
        // ── Typography — CANONICAL (locked, theme-independent) ──
        // Mirror exactly what AppThemeProvider's CANONICAL_FONT block writes.
        // A future change must update both files together.
        `--font-heading:'Outfit',ui-sans-serif,system-ui,sans-serif;` +
        `--font-body:'Outfit',ui-sans-serif,system-ui,sans-serif;` +
        `--app-font:'Outfit',ui-sans-serif,system-ui,sans-serif;` +
        `--app-font-display:'Outfit',ui-sans-serif,system-ui,sans-serif;` +
        `--font-size-h1:1.125rem;--font-size-h2:1rem;--font-size-h3:0.9375rem;` +
        `--font-size-body:0.9375rem;--font-size-small:0.8125rem;` +
        `--font-weight-normal:400;--font-line-height:1.5;` +
        `}` +
        // ── Heading rules INLINED in the SSR stylesheet ──
        // Without these, the browser paints <h1> at its default 2em
        // (32px) until app-theme-engine.css arrives, causing a
        // "big-text → empty → final" reflow flash on hard reload.
        //
        // !important here is intentional + safe: Tailwind v4's preflight
        // sets `h1 { font-size: inherit }` in its base layer which would
        // otherwise win on cascade order (preflight loads via the
        // tailwind <link> right after this <style> block). With
        // !important, the canonical scale wins from the very first
        // paint regardless of stylesheet load order.
        `h1,h2,h3,h4,h5,h6{font-family:'Outfit',ui-sans-serif,system-ui,sans-serif!important;font-weight:700!important;color:${tx}!important;margin:0;}` +
        `h1{font-size:1.125rem!important;letter-spacing:-0.02em;line-height:1.2;}` +
        `h2{font-size:1rem!important;letter-spacing:-0.015em;line-height:1.25;}` +
        `h3{font-size:0.9375rem!important;letter-spacing:-0.01em;line-height:1.3;}` +
        `h4,h5,h6{font-size:0.9375rem!important;line-height:1.4;}` +
        // .app-page-subtitle inlined too — same first-paint reasoning.
        `.app-page-subtitle{font-size:0.6875rem!important;color:${mt};margin-top:0.125rem;font-weight:700!important;text-transform:uppercase;letter-spacing:0.1em;line-height:1.4;}` +
        `@media(min-width:768px){.app-page-subtitle{font-size:0.75rem!important;}}` +
        // Body baseline — match the canonical body size on first paint
        // so the brief gap between SSR HTML arriving and the Tailwind
        // bundle finishing download doesn't show oversized text either.
        `body{font-family:'Outfit',ui-sans-serif,system-ui,sans-serif;font-size:0.9375rem;background:${bg};color:${tx};margin:0;}`;
}

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // ── Resolve tenant slug from request host ──
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(':')[0].toLowerCase();
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

            // Priority: user's persisted cookie slug > backend current > fallback
            // The tsfsystem-app-theme cookie is set by setOrgTheme() on every theme activation.
            // It's domain-wide, so it's available even on unauthenticated pages (login).
            const persistedSlug = cookieStore.get('tsfsystem-app-theme')?.value;
            const slug = persistedSlug || themesData.current?.theme_slug || 'ant-design';

            const all = [...(themesData.system || []), ...(themesData.custom || [])];
            const theme = all.find((t: any) => t.slug === slug)
                || all.find((t: any) => t.slug === themesData.current?.theme_slug)
                || all[0];
            if (theme?.presetData?.colors) {
                const colors = theme.presetData.colors[colorMode] || theme.presetData.colors.dark || {};
                ssrThemeCSS = buildRootThemeCSS(colors, theme.presetData.layout, theme.presetData.components);
                // Compact JSON for ThemeScript to read on first paint when localStorage is empty.
                // Replace </script> to prevent tag injection when embedded in <script> tag.
                ssrThemeJSON = JSON.stringify({
                    slug: theme.slug,
                    colorMode,
                    presetData: theme.presetData,
                }).replace(/<\/script>/gi, '<\\/script>');
            }
        }
    } catch {
        // Non-fatal — ThemeScript falls back to localStorage, AppThemeProvider fetches client-side
    }

    return (
        <html lang="en" className="scroll-smooth" suppressHydrationWarning data-scroll-behavior="smooth">
            <head>
                {/* SSR theme: correct colors on byte 1, before any JS runs.
                    ALWAYS render both tags (even if empty) so the DOM tree shape
                    is identical on server and client — prevents hydration mismatch.
                    `suppressHydrationWarning` guards against browser extensions
                    (Polymer-legacy "unresolved" polyfills, theme overriders) that
                    rewrite the first <style> tag before React mounts. */}
                {/* CANONICAL CSS — must paint on byte 1 even if the theme
                    fetch failed. Typography is locked & theme-independent
                    so it goes here BEFORE any theme override has a chance
                    to load. The theme block below adds colors/spacing on
                    top — but if it's empty, headings still render correctly. */}
                <style id="ssr-canonical" suppressHydrationWarning dangerouslySetInnerHTML={{
                    __html:
                        `:root{` +
                        `--font-heading:'Outfit',ui-sans-serif,system-ui,sans-serif;` +
                        `--font-body:'Outfit',ui-sans-serif,system-ui,sans-serif;` +
                        `--app-font:'Outfit',ui-sans-serif,system-ui,sans-serif;` +
                        `--app-font-display:'Outfit',ui-sans-serif,system-ui,sans-serif;` +
                        `--font-size-h1:1.125rem;--font-size-h2:1rem;--font-size-h3:0.9375rem;` +
                        `--font-size-h4:0.9375rem;` +
                        `--font-size-body:0.9375rem;--font-size-small:0.8125rem;` +
                        `--font-weight-normal:400;--font-line-height:1.5;` +
                        `}` +
                        `h1,h2,h3,h4,h5,h6{font-family:'Outfit',ui-sans-serif,system-ui,sans-serif!important;font-weight:700!important;margin:0;}` +
                        `h1{font-size:1.125rem!important;letter-spacing:-0.02em;line-height:1.2;}` +
                        `h2{font-size:1rem!important;letter-spacing:-0.015em;line-height:1.25;}` +
                        `h3{font-size:0.9375rem!important;letter-spacing:-0.01em;line-height:1.3;}` +
                        `h4,h5,h6{font-size:0.9375rem!important;line-height:1.4;}` +
                        `.app-page-subtitle{font-size:0.6875rem!important;font-weight:700!important;text-transform:uppercase;letter-spacing:0.1em;line-height:1.4;margin-top:0.125rem;}` +
                        `@media(min-width:768px){.app-page-subtitle{font-size:0.75rem!important;}}` +
                        `body{font-family:'Outfit',ui-sans-serif,system-ui,sans-serif;font-size:0.9375rem;margin:0;}`
                }} />
                {/* Per-tenant theme colors (loaded from DB; may be empty
                    if the fetch fails — canonical CSS above keeps the
                    page readable in that case). */}
                <style id="ssr-theme" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: ssrThemeCSS }} />
                <script id="__tsf_ssr_theme__" type="application/json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: ssrThemeJSON || '{}' }} />
                <ThemeScript />
                <link rel="manifest" href="/manifest.json" />
            </head>
            <body className={`${outfit.variable} ${roboto.variable} ${inter.variable} ${outfit.className}`}>
                <AppThemeProvider>
                    {children}
                </AppThemeProvider>
                <Toaster position="top-center" richColors />
                <PerfOverlay />
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
