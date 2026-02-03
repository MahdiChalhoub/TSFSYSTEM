import React from 'react';
import { ShoppingCart, TrendingUp, DollarSign } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export const SalesStatsWidget = ({ data }: { data: any }) => {
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
