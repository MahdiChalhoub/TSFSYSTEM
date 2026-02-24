import React from 'react';
import { ShoppingCart, TrendingUp, DollarSign, Clock, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';

export const SalesStatsWidget = ({ data }: { data: Record<string, any> }) => {
    const value = data?.totalSales || 0;
    return (
        <div className="card-premium p-6 flex flex-col justify-between group cursor-default min-h-[160px] relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start z-10">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Total Sales</p>
                    <h3 className="text-3xl font-bold text-gray-900 tracking-tight">${value.toLocaleString()}</h3>
                </div>
                <div className={clsx("p-3 rounded-2xl bg-gradient-to-br transition-transform group-hover:scale-110 duration-300", "text-emerald-600", "from-emerald-400/20 to-emerald-600/20")}>
                    <DollarSign size={24} />
                </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-emerald-600 font-medium z-10">
                <TrendingUp size={16} className="mr-1.5" />
                <span>Real-time tracking</span>
            </div>
            <div className={clsx("absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 blur-2xl", "bg-emerald-600")}></div>
        </div>
    );
};

export const SalesActiveOrdersWidget = ({ data }: { data: Record<string, any> }) => {
    const value = data?.activeOrders || 0;
    return (
        <div className="card-premium p-6 flex flex-col justify-between group cursor-default min-h-[160px] relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start z-10">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Active Orders</p>
                    <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{value.toLocaleString()}</h3>
                </div>
                <div className={clsx("p-3 rounded-2xl bg-gradient-to-br transition-transform group-hover:scale-110 duration-300", "text-blue-600", "from-blue-400/20 to-blue-600/20")}>
                    <ShoppingCart size={24} />
                </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-blue-600 font-medium z-10">
                <TrendingUp size={16} className="mr-1.5" />
                <span>Processing now</span>
            </div>
            <div className={clsx("absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 blur-2xl", "bg-blue-600")}></div>
        </div>
    );
};

export const SalesRecentActivity = ({ data }: { data: Record<string, any> }) => {
    // Expects activeOrders or latestSales
    const validSales = Array.isArray(data?.latestSales) ? data.latestSales : [];

    return (
        <div className="card-premium p-0 overflow-hidden h-full min-h-[400px] flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Clock size={16} className="text-blue-500" />
                    <span className="font-bold text-gray-700 text-sm">Recent Sales</span>
                </div>
            </div>

            <div className="overflow-y-auto p-2 space-y-1">
                {validSales.map((sale: Record<string, any>, i: number) => (
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

                {validSales.length === 0 && (
                    <div className="text-center py-10 text-gray-400 text-sm">
                        No recent sales recorded.
                    </div>
                )}
            </div>
        </div>
    );
}

export const POSQuickAction = () => {
    return (
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
    );
}