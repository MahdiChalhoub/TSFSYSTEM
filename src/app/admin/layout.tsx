import Link from 'next/link';
import '../globals.css';
import { AdminProvider } from '@/context/AdminContext';
import { Sidebar } from '@/components/admin/Sidebar';
import { TopHeader } from '@/components/admin/TopHeader';
import { TabNavigator } from '@/components/admin/TabNavigator';
import { DevProvider } from '@/context/DevContext';
import DebugOverlay from '@/components/dev/DebugOverlay';

import { Outfit } from 'next/font/google';
import { getSites } from '@/app/actions/sites';

const outfit = Outfit({ subsets: ['latin'] });

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const sites = await getSites();

    return (
        <AdminProvider>
            <DevProvider>
                <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
                    {/* Left Panel: Sidebar Tree */}
                    <Sidebar />

                    {/* Right Panel: Content */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* 1. Global Header (Search, Profile) */}
                        <TopHeader sites={sites} />

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
