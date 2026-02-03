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
import { getOrganizations } from '@/app/admin/saas/organizations/actions';
import { getUser } from '@/app/actions/auth';

import { headers } from 'next/headers';

const outfit = Outfit({ subsets: ['latin'] });

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const headerList = await headers();
    const host = headerList.get('host') || '';
    const currentSlug = host.split(':')[0].split('.')[0];

    // Parallel data fetching
    // 1. Authenticate FIRST (Sequential check to prevent 401 floods)
    const user = await getUser();

    if (!user) {
        redirect('/login?error=session_expired');
    }

    // 2. Fetch data in parallel ONLY if authenticated
    const [sites, organizations] = await Promise.all([
        getSites(),
        getOrganizations()
    ]);



    return (
        <AdminProvider>
            <DevProvider>
                <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
                    {/* Left Panel: Sidebar Tree */}
                    <Sidebar />

                    {/* Right Panel: Content */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* 1. Global Header (Search, Profile) */}
                        <TopHeader sites={sites} organizations={organizations} currentSlug={currentSlug} user={user} />

                        {/* 2. Tab Navigation Bar */}
                        <TabNavigator />

                        {/* 3. The Page Content */}
                        <main className="flex-1 overflow-auto p-8 relative">
                            <div className="max-w-[1600px] mx-auto">
                                {children}
                            </div>
                        </main>
                    </div>
                    <DebugOverlay />
                </div>
            </DevProvider>
        </AdminProvider>
    );
}
