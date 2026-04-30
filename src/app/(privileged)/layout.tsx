import { redirect } from 'next/navigation';
import '../globals.css';
import { AdminProvider } from '@/context/AdminContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { LayoutShellGateway } from '@/components/admin/LayoutShellGateway';
import { DevProvider } from '@/context/DevContext';
import DebugOverlay from '@/components/dev/DebugOverlay';
import { PageTimingProbe } from '@/components/dev/PageTimingProbe';
import { CommandPalette } from '@/components/admin/CommandPalette';
import { DesignSystemProvider } from '@/contexts/DesignSystemContext'
import { TourProvider } from '@/lib/tours/context';


import { getSites } from '@/app/actions/sites';
import { getOrganizations } from '@/app/(privileged)/(saas)/organizations/actions';
import { getUser } from '@/app/actions/auth';
import { getGlobalFinancialSettings } from '@/app/actions/settings';
import { getSaaSModules, getDynamicSidebar } from '@/app/actions/saas/modules';

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

    const currentSlug = subdomain || 'saas'; // Default to saas if at root
    // isSaas means "this is the platform/saas-admin context". That's true
    // when there's no subdomain, when it's www, *or* when the subdomain is
    // literally 'saas' (the dedicated saas-admin host). Previously this
    // excluded saas.*.domain, which caused unauthenticated users there to
    // bounce to /login (tenant login) → loop back to the saas admin.
    const isSaas = !subdomain || subdomain === 'www' || currentSlug === 'saas';

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
        redirect('/login?error=session_expired');
    }

    // 2. Fetch data in parallel ONLY if authenticated
    // Each call wrapped with its own timeout + fallback so a single slow
    // upstream can't stall the layout past nginx's proxy_read_timeout (→ 504).
    // Per-call budget of 8s is generous enough for healthy backends, tight
    // enough that 5 parallel calls can't exceed the ~60s nginx default.
    const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T, label: string): Promise<T> => {
        return new Promise<T>((resolve) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                console.warn(`[Layout] ${label} timed out after ${ms}ms — using fallback`);
                resolve(fallback);
            }, ms);
            p.then((v) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(v);
            }).catch((e) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                console.warn(`[Layout] ${label} failed:`, e?.message || e);
                resolve(fallback);
            });
        });
    };

    const LAYOUT_FETCH_TIMEOUT_MS = 8000;
    const [sitesRes, orgsRes, finRes, modulesRes, dynamicRes] = await Promise.all([
        withTimeout(getSites(), LAYOUT_FETCH_TIMEOUT_MS, [] as any[], 'getSites'),
        withTimeout(getOrganizations(), LAYOUT_FETCH_TIMEOUT_MS, [] as any[], 'getOrganizations'),
        withTimeout(getGlobalFinancialSettings(), LAYOUT_FETCH_TIMEOUT_MS, null, 'getGlobalFinancialSettings'),
        withTimeout(getSaaSModules(), LAYOUT_FETCH_TIMEOUT_MS, [] as any[], 'getSaaSModules'),
        withTimeout(getDynamicSidebar(), LAYOUT_FETCH_TIMEOUT_MS, [] as any[], 'getDynamicSidebar'),
    ]);

    const sites: any[] = sitesRes || [];
    const organizations: any[] = orgsRes || [];
    const financialSettings: any = finRes;
    const installedModuleCodes: string[] = Array.isArray(modulesRes)
        ? modulesRes.map((m: Record<string, any>) => m.code as string)
        : [];
    const dynamicSidebarItems: any[] = Array.isArray(dynamicRes) ? dynamicRes : [];



    const cookieStore = await cookies();
    const scopeAccess = cookieStore.get('scope_access')?.value as 'official' | 'internal' | undefined;
    const navLayout = cookieStore.get('tsf_nav_layout')?.value as 'sidebar' | 'topnav' | undefined;
    const tabLayout = cookieStore.get('tsf_tab_layout')?.value as 'horizontal' | 'vertical' | undefined;

    // Coarse mobile hint from the User-Agent so the correct shell renders on
    // first paint. The client-side media-query in the gateway corrects this
    // after hydration if the guess was wrong (e.g., tablet, resized window).
    const uaMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(headerList.get('user-agent') || '');

    return (
        <DesignSystemProvider>
        <AdminProvider
            contextKey={currentSlug}
            initialScopeAccess={scopeAccess || 'internal'}
            initialNavLayout={navLayout || 'sidebar'}
            initialTabLayout={tabLayout || 'horizontal'}
        >
        <FavoritesProvider>
          <TourProvider>
            <DevProvider>
                <LayoutShellGateway
                    user={user}
                    isSaas={isSaas}
                    currentSlug={currentSlug}
                    sites={sites}
                    organizations={organizations}
                    installedModuleCodes={installedModuleCodes}
                    dynamicSidebarItems={dynamicSidebarItems}
                    financialSettings={financialSettings}
                    initialIsMobile={uaMobile}
                >
                    {children}
                </LayoutShellGateway>
                <DebugOverlay />
                <PageTimingProbe />
                <CommandPalette />
            </DevProvider>
          </TourProvider>
        </FavoritesProvider>
        </AdminProvider>
        </DesignSystemProvider>
    );
}
