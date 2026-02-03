import Link from 'next/link';
import { Activity, Clock, ShoppingCart, Package, Plus, ChevronRight } from 'lucide-react';
import { getAdminDashboardStats } from '@/app/actions/finance/dashboard';
import { getActiveWidgets, getActiveRecentActivity } from '@/lib/module-registry';
// import { getOrgModules } from '@/app/actions/saas/modules';
import { SafeModuleBoundary } from '@/components/SafeModuleBoundary';

export default async function AdminDashboard() {
    // 1. Fetch Real Data
    const statsData = await getAdminDashboardStats();

    // 2. Determine Installed Modules (Dynamic)
    // In a real implementation, we would get the current org context from headers/cookie
    // For now, we assume we are in 'admin' context which implies a specific organization
    // Let's stub this or fetch if possible. 
    // Ideally: const org = await getTenantContext(); const modules = await getOrgModules(org.id);

    // [TEMPORARY] For this refactor, we simulate fetching installed modules
    // In production, this comes from the database via `OrganizationModule`
    const installedModuleCodes = ['inventory', 'sales', 'finance', 'crm']; // TODO: Fetch dynamically

    // 3. Resolve Widgets
    const DynamicWidgets = getActiveWidgets(installedModuleCodes);
    const RecentActivityWidget = getActiveRecentActivity(installedModuleCodes);

    return (
        <div className="space-y-12 animate-in fade-in duration-500 pb-10 px-8">

            {/* Welcome Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                    Dashboard
                </h1>
                <p className="text-gray-500 text-base">
                    Overview of your supermarket performance.
                </p>
            </div>

            {/* Dynamic Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {DynamicWidgets.length > 0 ? (
                    DynamicWidgets.map((Widget, i) => (
                        <SafeModuleBoundary key={i} moduleName="Metrics Widget">
                            <Widget data={statsData} />
                        </SafeModuleBoundary>
                    ))
                ) : (
                    <div className="col-span-full p-6 text-center text-gray-400 italic">
                        No active widgets. Install modules to see insights here.
                    </div>
                )}
            </div>

            {/* Charts & Activity Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Evolution Chart Placeholders */}

                {/* Activity Feed (Now Modular) */}
                <div className="lg:col-span-1 h-full min-h-[500px]">
                    {RecentActivityWidget ? (
                        <SafeModuleBoundary moduleName="Recent Activity">
                            <RecentActivityWidget data={statsData} />
                        </SafeModuleBoundary>
                    ) : (
                        <div className="h-full rounded-2xl border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-sm">
                            Activity Feed requires 'Sales' module.
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Quick Actions (2/3 width) - Could also be modularized */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Activity size={20} className="text-emerald-600" />
                        Quick Actions
                    </h2>

                    {/* TODO: Modularize these actions too using registry.landingComponents or similar */}
                    {installedModuleCodes.includes('sales') && (
                        <Link href="/admin/sales" className="block w-full group">
                            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-600 p-8 text-white shadow-xl transition-all hover:shadow-2xl hover:scale-[1.01]">
                                <div className="relative z-10 flex items-center justify-between">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                                                <ShoppingCart size={24} className="text-white" />
                                            </div>
                                            <h3 className="text-2xl font-bold">Open POS Terminal</h3>
                                        </div>
                                        <p className="text-emerald-50 max-w-xl text-lg opacity-90 font-medium">
                                            Start a new sales session, manage checkout, and process transactions efficiently.
                                        </p>
                                    </div>
                                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-md transition-transform group-hover:translate-x-1">
                                        <ChevronRight size={24} />
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-white/10 to-transparent"></div>
                                <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
                            </div>
                        </Link>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {installedModuleCodes.includes('inventory') && (
                            <>
                                <Link href="/admin/products/new" className="card-premium p-6 hover:border-emerald-500/30 transition-all group flex items-start justify-between min-h-[140px] bg-white rounded-2xl border border-gray-100 shadow-sm">
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg group-hover:text-emerald-700 transition-colors">Add Product</h3>
                                        <p className="text-sm text-gray-500 mt-1">Create new items in inventory</p>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform duration-300">
                                        <Plus size={24} />
                                    </div>
                                </Link>

                                <Link href="/admin/products" className="card-premium p-6 hover:border-emerald-500/30 transition-all group flex items-start justify-between min-h-[140px] bg-white rounded-2xl border border-gray-100 shadow-sm">
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg group-hover:text-emerald-700 transition-colors">Inventory</h3>
                                        <p className="text-sm text-gray-500 mt-1">Manage stock levels & prices</p>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-violet-50 text-violet-600 group-hover:scale-110 transition-transform duration-300">
                                        <Package size={24} />
                                    </div>
                                </Link>
                            </>
                        )}
                    </div>
                </div>

            </div>

        </div>
    );
}
