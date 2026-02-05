'use client';

import React from 'react';
import { Sparkles, Calendar } from 'lucide-react';

export function DashboardHeader() {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="relative mb-12 p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden group">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold tracking-wider text-xs uppercase mb-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        System Operational
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
                        Command Center
                    </h1>
                    <p className="text-slate-400 text-lg max-w-xl">
                        Real-time overview of your enterprise performance and module status.
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-slate-300 text-sm font-medium">
                    <Calendar size={16} className="text-emerald-400" />
                    {today}
                </div>
            </div>

            {/* Ambient Background Effects */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>

        </div>
    );
}
