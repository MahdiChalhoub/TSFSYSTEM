import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import '../globals.css';
import { AdminProvider } from '@/context/AdminContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { Sidebar } from '@/components/admin/Sidebar';
import { TopHeader } from '@/components/admin/TopHeader';
import { AdminShell } from '@/components/admin/AdminShell';
import { DevProvider } from '@/context/DevContext';
import DebugOverlay from '@/components/dev/DebugOverlay';
import { CommandPalette } from '@/components/admin/CommandPalette';
import { DesignSystemProvider } from '@/contexts/DesignSystemContext';


import { getSites } from '@/app/actions/sites';
import { getOrganizations } from '@/app/(privileged)/(saas)/organizations/actions';
import { getUser } from '@/app/actions/auth';
import { getGlobalFinancialSettings } from '@/app/actions/settings';
import { getSaaSModules, getDynamicSidebar } from '@/app/actions/saas/modules';
import { getThemes } from '@/app/actions/theme';

import { headers, cookies } from 'next/headers';

// Do NOT set force-dynamic here — it overrides all next:{ revalidate } hints in
// child fetches, turning every data call into a no-store request.
// The layout is already dynamic because it calls cookies() and headers().
// Individual fetches (sites, orgs, settings) use revalidate:30 in erpFetch.
// Only getUser() uses cache:'no-store' (auth must always be fresh).

// ── Server-side theme CSS injection helper ──────────────────────────────────
// Generates a :root { ... } CSS block from the theme colors so the correct
// colors are baked into the HTML on the very first byte — no JS, no flash.
function buildThemeCSS(
    colors: {
        primary?: string; primaryDark?: string; bg?: string; surface?: string;
        surfaceHover?: string; text?: string; textMuted?: string; border?: string;
        success?: string; warning?: string; error?: string;
    },
    layout: { spacing?: { container?: string; section?: string; card?: string; element?: string }; density?: string } | null,
    components: { cards?: { borderRadius?: string }; buttons?: { borderRadius?: string } } | null,
): string {
    const p = colors.primary || '#10B981';
    const pd = colors.primaryDark || '#059669';
    const bg = colors.bg || '#020617';
    const surface = colors.surface || '#0F172A';
    const surfaceHover = colors.surfaceHover || 'rgba(255,255,255,0.07)';
    const text = colors.text || '#F1F5F9';
    const muted = colors.textMuted || '#94A3B8';
    const border = colors.border || 'rgba(255,255,255,0.08)';

    return `:root{` +
        `--app-primary:${p};` +
        `--app-primary-dark:${pd};` +
        `--app-primary-light:${p}1f;` +
        `--app-primary-glow:${p}59;` +
        `--app-bg:${bg};` +
        `--app-surface:${surface};` +
        `--app-surface-2:${surfaceHover};` +
        `--app-surface-hover:${surfaceHover};` +
        `--app-text:${text};` +
        `--app-text-muted:${muted};` +
        `--app-text-faint:${muted};` +
        `--app-border:${border};` +
        `--app-border-strong:${border};` +
        `--app-sidebar-bg:${bg};` +
        `--app-sidebar-surface:color-mix(in srgb,${p} 5%,${surface});` +
        `--app-sidebar-text:${text};` +
        `--app-sidebar-muted:${muted};` +
        `--app-sidebar-active:color-mix(in srgb,${p} 8%,transparent);` +
        `--app-sidebar-border:${border};` +
        `--app-success:${colors.success || '#10B981'};` +
        `--app-warning:${colors.warning || '#F59E0B'};` +
        `--app-error:${colors.error || '#EF4444'};` +
        `--app-info:#3B82F6;` +
        `--layout-container-padding:${layout?.spacing?.container || '1.5rem'};` +
        `--layout-section-spacing:${layout?.spacing?.section || '1.75rem'};` +
        `--layout-card-padding:${layout?.spacing?.card || '1.25rem'};` +
        `--layout-element-gap:${layout?.spacing?.element || '0.875rem'};` +
        `--card-radius:${components?.cards?.borderRadius || '0.75rem'};` +
        `--button-radius:${components?.buttons?.borderRadius || '0.5rem'};` +
        `}`;
}



export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const headerList = await headers();
    const host = headerList.get('host') || '';
    const hostname = host.split(':')[0].toLowerCase();
    const parts = hostname.split('.');

    let subdomain = "";
    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?$/.test(hostname);

    if (isIp) {
        subdomain = ""; // IP is always root/saas context
    } else if (hostname.includes("localhost")) {
        if (parts.length > 1) subdomain = parts[0];
    } else {
        if (parts.length > 2) subdomain = parts[0];
    }

    const isSaas = !subdomain || subdomain === 'www';
    const currentSlug = subdomain || 'saas'; // Default to saas if at root

    // Parallel data fetching
    // 1. Authenticate FIRST (Sequential check to prevent 401 floods)
    let user;
    try {
        user = await getUser();
    } catch (e) {
        // Backend is likely restarting or down.
        // We catch this to prevent immediate redirect to login.
        return (
            <div className="flex flex-col items-center justify-center h-screen p-8 text-center" style={{ background: 'var(--app-bg)' }}>
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6 animate-pulse" style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}>
                    <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--app-primary)', borderTopColor: 'transparent' }} />
                </div>
                <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>Reconnecting...</h2>
                <p className="mt-2 font-medium max-w-sm mx-auto" style={{ color: 'var(--app-text-muted)' }}>
                    The platform backend is applying updates. Your session is safe.
                    Checking link status...
                </p>
                <div className="mt-8 flex gap-2 justify-center">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--app-primary)', animationDelay: '0s' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--app-primary)', animationDelay: '0.2s' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--app-primary)', animationDelay: '0.4s' }} />
                </div>
                <meta httpEquiv="refresh" content="10" />
            </div>
        );
    }

    if (!user) {
        if (isSaas) {
            redirect('/saas/login?error=session_expired');
        }
        redirect('/login?error=session_expired');
    }

    // 2. Fetch data in parallel ONLY if authenticated
    // Wrapped in try/catch to prevent layout crash on 429 (rate limit) or transient errors
    let sites: any[] = [];
    let organizations: any[] = [];
    let financialSettings: any = null;
    let installedModuleCodes: string[] = [];
    let dynamicSidebarItems: any[] = [];
    let themesData: any = null;
    try {
        const [sitesRes, orgsRes, finRes, modulesRes, dynamicRes, themesRes] = await Promise.all([
            getSites().catch(() => []),
            getOrganizations().catch(() => []),
            getGlobalFinancialSettings().catch(() => null),
            getSaaSModules().catch(() => []),
            getDynamicSidebar().catch(() => []),
            getThemes().catch(() => null),
        ]);
        sites = sitesRes;
        organizations = orgsRes;
        financialSettings = finRes;
        installedModuleCodes = Array.isArray(modulesRes)
            ? modulesRes.map((m: Record<string, any>) => m.code as string)
            : [];
        dynamicSidebarItems = Array.isArray(dynamicRes) ? dynamicRes : [];
        themesData = themesRes;
    } catch {
        // Graceful degradation — layout renders with empty data
        console.error('[Layout] Failed to fetch layout data, rendering with defaults');
    }

    // Build server-side theme CSS — baked into HTML so colors appear before JS loads
    let ssrThemeCSS = '';
    try {
        if (themesData) {
            const currentSlugForTheme = themesData.current?.theme_slug || 'midnight-pro';
            const colorMode: 'dark' | 'light' = (themesData.current?.color_mode === 'light') ? 'light' : 'dark';
            const allThemes = [...(themesData.system || []), ...(themesData.custom || [])];
            const activeTheme = allThemes.find((t: any) => t.slug === currentSlugForTheme) || allThemes[0];
            if (activeTheme?.presetData?.colors) {
                const colors = activeTheme.presetData.colors[colorMode] || activeTheme.presetData.colors.dark;
                ssrThemeCSS = buildThemeCSS(
                    colors,
                    activeTheme.presetData.layout || null,
                    activeTheme.presetData.components || null,
                );
            }
        }
    } catch {
        // Non-fatal — client-side theme provider will handle it
    }



    const cookieStore = await cookies();
    const scopeAccess = cookieStore.get('scope_access')?.value as 'official' | 'internal' | undefined;
    const navLayout = cookieStore.get('tsf_nav_layout')?.value as 'sidebar' | 'topnav' | undefined;
    const tabLayout = cookieStore.get('tsf_tab_layout')?.value as 'horizontal' | 'vertical' | undefined;

    return (
        <>
        {ssrThemeCSS && <style dangerouslySetInnerHTML={{ __html: ssrThemeCSS }} />}
        <DesignSystemProvider>
        <AdminProvider
            contextKey={currentSlug}
            initialScopeAccess={scopeAccess || 'internal'}
            initialNavLayout={navLayout || 'sidebar'}
            initialTabLayout={tabLayout || 'horizontal'}
        >
        <FavoritesProvider>
            <DevProvider>
                <div className="flex h-screen overflow-hidden font-sans" style={{ background: 'var(--app-bg)', color: 'var(--app-text)' }}>
                    {/* Left Panel: Sidebar Tree */}
                    <Sidebar
                        isSaas={isSaas}
                        isSuperuser={user?.is_superuser || false}
                        dualViewEnabled={(user?.is_superuser) || (financialSettings?.dualView || false)}
                        initialModuleCodes={installedModuleCodes}
                        initialDynamicItems={dynamicSidebarItems}
                    />

                    {/* Right Panel: Content */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* 1. Global Header */}
                        <TopHeader sites={sites} organizations={organizations} currentSlug={currentSlug} user={user} />

                        {/* 2. Tab bar (horizontal strip or vertical rail) + main content */}
                        <AdminShell>{children}</AdminShell>
                    </div>
                    <DebugOverlay />
                    <CommandPalette />
                </div>
            </DevProvider>
        </FavoritesProvider>
        </AdminProvider>
        </DesignSystemProvider>
        </>
    );
}
