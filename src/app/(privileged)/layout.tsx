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

import { headers, cookies } from 'next/headers';

// Do NOT set force-dynamic here — it overrides all next:{ revalidate } hints in
// child fetches, turning every data call into a no-store request.
// The layout is already dynamic because it calls cookies() and headers().
// Individual fetches (sites, orgs, settings) use revalidate:30 in erpFetch.
// Only getUser() uses cache:'no-store' (auth must always be fresh).



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
    try {
        [sites, organizations, financialSettings] = await Promise.all([
            getSites().catch(() => []),
            getOrganizations().catch(() => []),
            getGlobalFinancialSettings().catch(() => null)
        ]);
    } catch {
        // Graceful degradation — layout renders with empty data
        console.error('[Layout] Failed to fetch layout data, rendering with defaults');
    }



    const cookieStore = await cookies();
    const scopeAccess = cookieStore.get('scope_access')?.value as 'official' | 'internal' | undefined;
    const navLayout = cookieStore.get('tsf_nav_layout')?.value as 'sidebar' | 'topnav' | undefined;
    const tabLayout = cookieStore.get('tsf_tab_layout')?.value as 'horizontal' | 'vertical' | undefined;

    return (
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
    );
}
