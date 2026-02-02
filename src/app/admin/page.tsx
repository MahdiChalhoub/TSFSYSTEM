import Link from 'next/link';
import { ShoppingCart, Package, TrendingUp, Users, Plus, DollarSign, Activity, ChevronRight, Clock } from 'lucide-react';
import clsx from 'clsx';
import { getAdminDashboardStats } from '@/app/actions/finance/dashboard';

export default async function AdminDashboard() {
    const statsData = await getAdminDashboardStats();

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

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {[
                    { label: 'Total Sales', value: `$${statsData.totalSales.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', gradient: 'from-emerald-400/20 to-emerald-600/20' },
                    { label: 'Active Orders', value: statsData.activeOrders.toString(), icon: ShoppingCart, color: 'text-blue-600', gradient: 'from-blue-400/20 to-blue-600/20' },
                    { label: 'Total Products', value: statsData.totalProducts.toString(), icon: Package, color: 'text-violet-600', gradient: 'from-violet-400/20 to-violet-600/20' },
                    { label: 'Total Customers', value: statsData.totalCustomers.toString(), icon: Users, color: 'text-amber-600', gradient: 'from-amber-400/20 to-amber-600/20' },
                ].map((stat, i) => (
                    <div key={i} className="card-premium p-6 flex flex-col justify-between group cursor-default min-h-[160px] relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-start z-10">
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-2">{stat.label}</p>
                                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{stat.value}</h3>
                            </div>
                            <div className={clsx("p-3 rounded-2xl bg-gradient-to-br transition-transform group-hover:scale-110 duration-300", stat.gradient, stat.color)}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm text-emerald-600 font-medium z-10">
                            <TrendingUp size={16} className="mr-1.5" />
                            <span>Real-time tracking</span>
                        </div>
                        {/* Decorative Background Blob */}
                        <div className={clsx("absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 blur-2xl", stat.color.replace('text-', 'bg-'))}></div>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Quick Actions (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Activity size={20} className="text-emerald-600" />
                        Quick Actions
                    </h2>

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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    </div>
                </div>

                {/* Right Column: Recent Activity (1/3 width) */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Clock size={20} className="text-blue-500" />
                        Recent Activity
                    </h2>

                    <div className="card-premium p-0 overflow-hidden h-full min-h-[400px] flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <span className="font-bold text-gray-700 text-sm">Latest Sales</span>
                        </div>

                        <div className="overflow-y-auto p-2 space-y-1">
                            {statsData.latestSales.map((sale: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-3 hovering rounded-xl group cursor-pointer hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
                                            #{sale.id}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{sale.contact?.name || 'Walk-in Customer'}</p>
                                            <p className="text-xs text-gray-500">{new Date(sale.createdAt).toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-gray-900">${Number(sale.totalAmount).toFixed(2)}</p>
                                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-auto w-fit font-medium">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                            {sale.status}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {statsData.latestSales.length === 0 && (
                                <div className="text-center py-10 text-gray-400 text-sm">
                                    No recent sales recorded.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
