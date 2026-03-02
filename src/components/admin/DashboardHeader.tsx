'use client';

import React from 'react';
import { Sparkles, Calendar } from 'lucide-react';

export function DashboardHeader() {
 const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

 return (
 <div className="relative mb-4 p-4 rounded-[1.5rem] bg-slate-900 border border-slate-800 shadow-xl overflow-hidden group">
 <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
 <div>
 <div className="flex items-center gap-2 text-emerald-400 font-bold tracking-wider text-[10px] uppercase mb-0.5">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
 System Operational
 </div>
 <h1 className="text-2xl md:text-3xl font-black text-app-text tracking-tight mb-1">
 Command Center
 </h1>
 <p className="text-app-text-faint text-sm max-w-xl">
 Real-time overview of your enterprise performance and module status.
 </p>
 </div>

 <div className="flex items-center gap-3 bg-app-text/5 backdrop-blur-md border border-app-text/10 px-4 py-2 rounded-full text-slate-300 text-sm font-medium">
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
