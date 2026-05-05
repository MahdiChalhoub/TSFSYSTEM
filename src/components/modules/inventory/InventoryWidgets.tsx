import React from 'react';
import { Package, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

export const InventoryStatsWidget = ({ data }: { data: Record<string, any> }) => {
    // Determine grid columns - this widget takes 1/4 width usually
    // We assume data passed contains 'totalProducts'
    const value = data?.totalProducts || 0;

    return (
        <div className="card-premium p-6 flex flex-col justify-between group cursor-default min-h-[160px] relative overflow-hidden bg-white rounded-2xl border border-app-border shadow-sm">
            <div className="flex justify-between items-start z-10">
                <div>
                    <p className="text-sm font-medium text-app-muted-foreground mb-2">Total Products</p>
                    <h3 className="text-3xl font-bold text-app-foreground tracking-tight">{value.toLocaleString()}</h3>
                </div>
                <div className={clsx("p-3 rounded-2xl bg-gradient-to-br transition-transform group-hover:scale-110 duration-300", "text-violet-600", "from-violet-400/20 to-violet-600/20")}>
                    <Package size={24} />
                </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-app-success font-medium z-10">
                <TrendingUp size={16} className="mr-1.5" />
                <span>Active SKU count</span>
            </div>
            <div className={clsx("absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 blur-2xl", "bg-violet-600")}></div>
        </div>
    );
};