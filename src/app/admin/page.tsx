import Link from 'next/link';
import { ShoppingCart, Package, TrendingUp, Users, ArrowRight, Plus, DollarSign, Activity } from 'lucide-react';
import clsx from 'clsx';

export default function AdminDashboard() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">

            {/* Welcome Section with Gradient Text */}
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                    Dashboard
                </h1>
                <p className="text-gray-500 text-lg">
                    Overview of your supermarket performance.
                </p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {[
                    { label: 'Total Sales', value: '$12,450', icon: DollarSign, color: 'text-emerald-600', gradient: 'from-emerald-400/20 to-emerald-600/20' },
                    { label: 'Active Orders', value: '14', icon: ShoppingCart, color: 'text-blue-600', gradient: 'from-blue-400/20 to-blue-600/20' },
                    { label: 'Total Products', value: '1,234', icon: Package, color: 'text-violet-600', gradient: 'from-violet-400/20 to-violet-600/20' },
                    { label: 'Total Customers', value: '890', icon: Users, color: 'text-amber-600', gradient: 'from-amber-400/20 to-amber-600/20' },
                ].map((stat, i) => (
                    <div key={i} className="card-premium p-6 flex flex-col justify-between group cursor-default min-h-[160px]">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                <h3 className="text-3xl font-bold text-gray-900 mt-2 tracking-tight">{stat.value}</h3>
                            </div>
                            <div className={clsx("p-3 rounded-xl bg-gradient-to-br transition-transform group-hover:scale-110 duration-300", stat.gradient, stat.color)}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-emerald-600 font-medium">
                            <TrendingUp size={14} className="mr-1" />
                            <span>+12.5% from last month</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 2xl:grid-cols-3 gap-8">

                {/* Left Column: Quick Actions (2/3 width) */}
                <div className="2xl:col-span-2 space-y-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Activity size={20} className="text-emerald-500" />
                        Quick Actions
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* POS Action Card - Featured */}
                        <Link href="/admin/sales" className="col-span-1 sm:col-span-2 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 p-8 shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all duration-300">
                            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50 group-hover:opacity-75 transition-opacity"></div>

                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl w-fit mb-4">
                                        <ShoppingCart className="w-8 h-8 text-white" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Open POS Terminal</h3>
                                    <p className="text-emerald-100 max-w-sm text-lg">Start a new sales session and manage checkout.</p>
                                </div>
                                <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                                    <ArrowRight className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </Link>

                        {/* Secondary Actions */}
                        <Link href="/admin/products/new" className="card-premium p-6 hover:border-blue-300/50 group block min-h-[140px]">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                                    <Plus size={24} />
                                </div>
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 mb-1">Add Product</h3>
                            <p className="text-sm text-gray-500">Create new items in inventory</p>
                        </Link>

                        <Link href="/admin/products" className="card-premium p-6 hover:border-violet-300/50 group block min-h-[140px]">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-violet-50 text-violet-600 rounded-xl group-hover:bg-violet-600 group-hover:text-white transition-colors duration-300">
                                    <Package size={24} />
                                </div>
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 mb-1">Inventory</h3>
                            <p className="text-sm text-gray-500">Manage stock levels & prices</p>
                        </Link>
                    </div>
                </div>

                {/* Right Column: Recent Activity (1/3 width) */}
                <div className="space-y-6 flex flex-col">
                    <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
                    <div className="card-premium p-0 overflow-hidden flex-1 h-full min-h-[400px]">
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800">Latest Sales</h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {[1, 2, 3, 4, 5].map((_, i) => (
                                <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs ring-2 ring-white shadow-sm">
                                            #{1024 + i}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 text-sm">Walk-in Customer</p>
                                            <p className="text-xs text-gray-400">2 mins ago</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gray-900 text-sm">$24.50</p>
                                        <div className="flex items-center gap-1 justify-end">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Paid</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-gray-50 text-center bg-gray-50/30">
                            <button className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold transition-colors">
                                View Full Transaction History
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
