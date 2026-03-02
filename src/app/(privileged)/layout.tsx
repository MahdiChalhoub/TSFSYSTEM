import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import '../globals.css';
import '@/styles/app-theme-engine.css';
import '@/styles/app-animations.css';
import { AppThemeProvider } from '@/components/app/AppThemeProvider';
import { AdminProvider } from '@/context/AdminContext';
import { Sidebar } from '@/components/admin/Sidebar';
import { TopHeader } from '@/components/admin/TopHeader';
import { TabNavigator } from '@/components/admin/TabNavigator';
import { DevProvider } from '@/context/DevContext';
import DebugOverlay from '@/components/dev/DebugOverlay';
import DevModeBanner from '@/components/dev/DevModeBanner';
import { CommandPalette } from '@/components/admin/CommandPalette';


import { getSites } from '@/app/actions/sites';
import { getOrganizations } from '@/app/(privileged)/(saas)/organizations/actions';
import { getUser } from '@/app/actions/auth';
import { getGlobalFinancialSettings } from '@/app/actions/settings';
import { checkSetupReadiness } from '@/app/actions/setup-wizard';

import { headers, cookies } from 'next/headers';

export const dynamic = 'force-dynamic';



export default async function AdminLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 const headerList = await headers();
 const host = headerList.get('host') || '';
 const hostname = host.split(':')[0].toLowerCase();
 const parts = hostname.split('.');

 const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?$/.test(hostname);
 const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost').toLowerCase();

 // 1. Determine if we are at SaaS Root or a Tenant Workspace
 // SaaS Root = root domain, www subdomain, saas subdomain, or direct IP access
 const isSaas =
 hostname === rootDomain ||
 hostname === `www.${rootDomain}` ||
 hostname === `saas.${rootDomain}` ||
 isIp ||
 hostname.includes('vercel.app'); // Treat Vercel previews as SaaS root by default

 // 2. Extract Subdomain (Slug)
 let currentSlug = "saas";
 if (!isSaas) {
 // If not SaaS, the first part of the hostname is the tenant slug
 currentSlug = parts[0];
 }

 // Parallel data fetching
 // 1. Authenticate FIRST (Sequential check to prevent 401 floods)
 let user;
 try {
 user = await getUser();
 } catch (e) {
 // Backend is likely restarting or down.
 // We catch this to prevent immediate redirect to login.
 return (
 <div className="flex flex-col items-center justify-center h-screen bg-app-bg p-8 text-center">
 <div className="w-16 h-16 rounded-3xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-6 animate-pulse">
 <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
 </div>
 <h2 className="text-2xl font-black text-app-text tracking-tight">Reconnecting...</h2>
 <p className="text-app-text-muted mt-2 font-medium max-w-sm mx-auto">
 The platform backend is applying updates. Your session is safe.
 Checking link status...
 </p>
 <div className="mt-8 flex gap-2 justify-center">
 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0s' }} />
 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
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
 const [sites, organizations, financialSettings] = await Promise.all([
 getSites(),
 getOrganizations(),
 getGlobalFinancialSettings(),
 ]);

 // ── HARD GATE: Setup Wizard for TENANT subdomains only ──
 // SaaS panel never gets gated. Only tenant orgs need fiscal regime + currency + fiscal year.
 if (!isSaas) {
 const pathname = headerList.get('x-pathname') || '';
 const isOnWizard = pathname.startsWith('/setup-wizard') || pathname.startsWith('/migration');
 if (!isOnWizard) {
 try {
 const setupReadiness = await checkSetupReadiness();
 if (!setupReadiness.ready) {
 redirect('/setup-wizard');
 }
 } catch {
 // If check fails, don't block — let user through
 }
 }
 }



 const cookieStore = await cookies();
 const scopeAccess = cookieStore.get('scope_access')?.value as 'official' | 'internal' | undefined;

 // ── Phase 5: 3-tier theme fallback chain ────────────────────────────
 // Priority: user cookie → org default (DB) → system default (midnight-pro)
 const { getPersistedTheme, getOrgDefaultTheme } = await import('@/app/actions/settings/theme');
 const userTheme = await getPersistedTheme();
 // Only hit the backend for org default if the user has no personal preference
 const orgTheme = userTheme ? null : await getOrgDefaultTheme();
 const serverTheme = userTheme ?? orgTheme ?? undefined;

 return (
 <AppThemeProvider serverTheme={serverTheme ?? undefined}>
 <AdminProvider contextKey={currentSlug} initialScopeAccess={scopeAccess || 'internal'}>
 <DevProvider>
 {process.env.DEV_MODULE && <DevModeBanner moduleName={process.env.DEV_MODULE} />}
 <div className="flex h-screen overflow-hidden" style={{ background: 'var(--app-bg)', color: 'var(--app-text)', fontFamily: 'var(--app-font)' }}>
 {/* Left Panel: Sidebar Tree */}
 <Sidebar
 isSaas={isSaas}
 isSuperuser={user?.is_superuser || false}
 dualViewEnabled={(user?.is_superuser) || (financialSettings?.dualView || false)}
 />

 {/* Right Panel: Content */}
 <div className="flex-1 flex flex-col min-w-0">
 {/* 1. Global Header (Search, Profile) */}
 <TopHeader sites={sites} organizations={organizations} currentSlug={currentSlug} user={user} />

 {/* 2. Tab Navigation Bar */}
 <TabNavigator />

 {/* 3. The Page Content */}
 <main className="flex-1 overflow-auto relative p-4 md:p-5">
 <Suspense fallback={null}>
 {children}
 </Suspense>
 </main>
 </div>
 <DebugOverlay />
 <CommandPalette />
 </div>
 </DevProvider>
 </AdminProvider>
 </AppThemeProvider>
 );
}
