import Link from 'next/link';
import { redirect } from 'next/navigation';
import '../globals.css';
import { AdminProvider } from '@/context/AdminContext';
import { Sidebar } from '@/components/admin/Sidebar';
import { TopHeader } from '@/components/admin/TopHeader';
import { TabNavigator } from '@/components/admin/TabNavigator';
import { DevProvider } from '@/context/DevContext';
import DebugOverlay from '@/components/dev/DebugOverlay';

import { Outfit } from 'next/font/google';
import { getSites } from '@/app/actions/sites';
import { getOrganizations } from '@/app/(privileged)/saas/organizations/actions';
import { getUser } from '@/app/actions/auth';
import { getGlobalFinancialSettings } from '@/app/actions/settings';

import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const outfit = Outfit({ subsets: ['latin'] });

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

    const isSaas = !subdomain || subdomain === 'saas' || subdomain === 'www';
    const currentSlug = subdomain || 'saas'; // Default to saas if at root

    // Parallel data fetching
    // 1. Authenticate FIRST (Sequential check to prevent 401 floods)
    const user = await getUser();

    if (!user) {
        // If we are in SaaS context, redirect to SaaS login
        if (isSaas) {
            redirect('/saas/login?error=session_expired');
        }
        redirect('/login?error=session_expired');
    }

    // 2. Fetch data in parallel ONLY if authenticated
    const [sites, organizations, financialSettings] = await Promise.all([
        getSites(),
        getOrganizations(),
        getGlobalFinancialSettings()
    ]);



    return (
        <AdminProvider>
            <DevProvider>
                <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
                    {/* Left Panel: Sidebar Tree */}
                    <Sidebar
                        isSaas={isSaas}
                        isSuperuser={user?.is_superuser || false}
                        dualViewEnabled={financialSettings?.dualView || false}
                    />

                    {/* Right Panel: Content */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* 1. Global Header (Search, Profile) */}
                        <TopHeader sites={sites} organizations={organizations} currentSlug={currentSlug} user={user} />

                        {/* 2. Tab Navigation Bar */}
                        <TabNavigator />

                        {/* 3. The Page Content */}
                        <main className="flex-1 overflow-auto relative">
                            {children}
                        </main>
                    </div>
                    <DebugOverlay />
                </div>
            </DevProvider>
        </AdminProvider>
    );
}
