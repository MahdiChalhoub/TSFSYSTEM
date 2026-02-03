import Link from 'next/link';
import { Activity, ShoppingCart, Package, Plus, ChevronRight, Zap } from 'lucide-react';
import { getAdminDashboardStats } from '@/app/actions/finance/dashboard';
import { getActiveWidgets, getActiveRecentActivity } from '@/lib/module-registry';
// import { getOrgModules } from '@/app/actions/saas/modules';
import { SafeModuleBoundary } from '@/components/SafeModuleBoundary';
import { DashboardHeader } from '@/components/admin/DashboardHeader';

export default async function AdminDashboard() {
    // 1. Fetch Real Data
    const statsData = await getAdminDashboardStats();

    // 2. Determine Installed Modules (Dynamic)
    // [TEMPORARY] For this refactor, we simulate fetching installed modules
    // In production, this comes from the database via `OrganizationModule`
    // 'sales' removed to demonstrate modularity as per user request
    const installedModuleCodes = ['inventory', 'finance', 'crm']; // TODO: Fetch dynamically

    // 3. Resolve Widgets
    const DynamicWidgets = getActiveWidgets(installedModuleCodes);
    const RecentActivityWidget = getActiveRecentActivity(installedModuleCodes);

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            <div className="max-w-[1600px] mx-auto px-6 py-8 animate-in fade-in duration-700">

                <DashboardHeader />

                {/* Main Grid Layout */}
                <div className="space-y-12">

                    {/* SECTION 1: KEY METRICS */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                                <Zap size={20} className="text-amber-500" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Key Metrics</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                            {DynamicWidgets.length > 0 ? (
                                DynamicWidgets.map((Widget, i) => (
                                    <SafeModuleBoundary key={i} moduleName="Metrics Widget">
                                        <Widget data={statsData} />
                                    </SafeModuleBoundary>
                                ))
                            ) : (
                                <div className="col-span-full p-12 text-center rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50">
                                    <p className="text-gray-400 font-medium">No active widgets installed.</p>
                                    <p className="text-sm text-gray-400 mt-1">Visit the Module Store to add capabilities.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SECTION 2: OPERATIONAL & ACTIVITY */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* Left Column: Quick Actions (2/3 width) */}
                        <div className="xl:col-span-2 space-y-8">

                            {/* Actions Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                                        <Activity size={20} className="text-blue-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Quick Actions</h2>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* POS Hero Action */}
                                {installedModuleCodes.includes('sales') && (
                                    <Link href="/admin/sales" className="block w-full group lg:col-span-2">
                                        <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 text-white shadow-xl transition-all hover:shadow-2xl hover:scale-[1.01] border border-slate-800">
                                            <div className="relative z-10 flex items-center justify-between">
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="p-2.5 bg-emerald-500/20 rounded-xl backdrop-blur-md border border-emerald-500/20">
                                                            <ShoppingCart size={24} className="text-emerald-400" />
                                                        </div>
                                                        <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                                            High Priority
                                                        </div>
                                                    </div>
                                                    <h3 className="text-3xl font-black tracking-tight">Open POS Terminal</h3>
                                                    <p className="text-slate-400 max-w-xl text-lg font-medium leading-relaxed">
                                                        Launch the high-fidelity Point of Sale interface for instant transaction processing.
                                                    </p>
                                                </div>
                                                <div className="bg-white/10 p-4 rounded-full backdrop-blur-md transition-transform group-hover:translate-x-2 border border-white/10">
                                                    <ChevronRight size={28} />
                                                </div>
                                            </div>
                                            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-b from-emerald-500/20 to-transparent rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                                        </div>
                                    </Link>
                                )}

                                {/* Secondary Actions */}
                                {installedModuleCodes.includes('inventory') && (
                                    <>
                                        <Link href="/admin/products/new" className="card-premium p-6 group flex flex-col justify-between min-h-[180px] bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 relative overflow-hidden">
                                            <div className="relative z-10">
                                                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                                    <Plus size={24} />
                                                </div>
                                                <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">Add Product</h3>
                                                <p className="text-sm text-gray-500 mt-2 font-medium">Create new items & define SKU properties</p>
                                            </div>
                                            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                                        </Link>

                                        <Link href="/admin/products" className="card-premium p-6 group flex flex-col justify-between min-h-[180px] bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 relative overflow-hidden">
                                            <div className="relative z-10">
                                                <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                                    <Package size={24} />
                                                </div>
                                                <h3 className="font-bold text-gray-900 text-lg group-hover:text-violet-600 transition-colors">Manage Inventory</h3>
                                                <p className="text-sm text-gray-500 mt-2 font-medium">Track stock levels, pricing & warehouses</p>
                                            </div>
                                            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-violet-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Activity Feed (1/3 width) */}
                        <div className="h-full">
                            {RecentActivityWidget ? (
                                <SafeModuleBoundary moduleName="Recent Activity">
                                    <RecentActivityWidget data={statsData} />
                                </SafeModuleBoundary>
                            ) : (
                                <div className="h-full min-h-[400px] rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                    <Activity size={32} className="mb-3 opacity-20" />
                                    <p className="text-sm font-medium">Activity Feed Unavailable</p>
                                    <p className="text-xs mt-1">Install 'Sales' module to view timeline.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
