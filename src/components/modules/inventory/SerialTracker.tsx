'use client';

import React, { useState, useEffect } from 'react';
import { SerialNumber } from "@/types/erp";
import {
    Search, Barcode, History, Package,
    Warehouse, Calendar, User, ArrowRight,
    Loader2, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getSerialsAction, getSerialHistoryAction } from '@/app/actions/inventory';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function SerialTracker() {
    const [query, setQuery] = useState("");
    const [serials, setSerials] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedSerial, setSelectedSerial] = useState<SerialNumber | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const data = await getSerialsAction(query);
            setSerials(data.results || data);
            if (data.results?.length === 0 || data.length === 0) {
                toast.info("No serial numbers found matching your query.");
            }
        } catch (error) {
            toast.error("Search failed");
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async (serial: any) => {
        setSelectedSerial(serial);
        setHistoryLoading(true);
        try {
            const data = await getSerialHistoryAction(serial.id);
            setHistory(data);
        } catch (error) {
            toast.error("Failed to load history");
        } finally {
            setHistoryLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Search Header */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                            placeholder="Search Serial Number, IMEI, or SKU..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="h-14 pl-12 rounded-2xl bg-gray-50/50 border-gray-100 text-sm font-medium focus:ring-slate-900/5 focus:border-slate-900"
                        />
                    </div>
                    <Button
                        onClick={handleSearch}
                        disabled={loading}
                        className="h-14 px-8 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 transition-all hover:bg-black"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "Verify Serial"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Results List */}
                <div className="lg:col-span-2 space-y-4">
                    {serials.map((s) => (
                        <div
                            key={s.id}
                            onClick={() => fetchHistory(s)}
                            className={`p-6 rounded-[2rem] border transition-all cursor-pointer group ${selectedSerial?.id === s.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-gray-100 hover:border-slate-200'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-lg ${selectedSerial?.id === s.id ? 'bg-white/10' : 'bg-slate-50 text-slate-600'}`}>
                                            <Barcode size={16} />
                                        </div>
                                        <h3 className="font-black text-lg tracking-tight uppercase">{s.serial_number}</h3>
                                    </div>
                                    <p className={`text-xs font-bold leading-tight ${selectedSerial?.id === s.id ? 'text-slate-400' : 'text-gray-500'}`}>
                                        {s.product_name}
                                    </p>
                                </div>
                                <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${s.status === 'AVAILABLE' ? 'bg-emerald-500 text-white' :
                                    s.status === 'SOLD' ? 'bg-blue-500 text-white' :
                                        'bg-amber-500 text-white'
                                    }`}>
                                    {s.status}
                                </div>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-4 text-[10px] uppercase font-black tracking-widest opacity-60">
                                <div className="flex items-center gap-1.5">
                                    <Warehouse size={14} /> {s.warehouse_name || 'Global'}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={14} /> Created: {format(new Date(s.created_at), 'dd MMM yyyy')}
                                </div>
                            </div>
                        </div>
                    ))}

                    {!loading && serials.length === 0 && (
                        <div className="p-20 bg-gray-50/50 rounded-[3rem] border border-dashed border-gray-200 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-gray-300 mb-4">
                                <Barcode size={32} />
                            </div>
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">No Serial Data</h3>
                            <p className="text-xs text-gray-400 mt-2 font-medium">Use the search bar to locate specific units.</p>
                        </div>
                    )}
                </div>

                {/* History Sidebar */}
                <div className="space-y-6">
                    {selectedSerial ? (
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm sticky top-24">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                    <History size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-tighter">Unit Timeline</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">History Log</p>
                                </div>
                            </div>

                            <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-50">
                                {historyLoading ? (
                                    <div className="flex justify-center p-12">
                                        <Loader2 className="animate-spin text-slate-300" size={32} />
                                    </div>
                                ) : history.map((log, idx) => (
                                    <div key={log.id} className="relative pl-10">
                                        <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${idx === 0 ? 'bg-indigo-600' : 'bg-slate-200'
                                            }`}>
                                            {idx === 0 && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <p className="text-[11px] font-black text-gray-900 uppercase tracking-tight">{log.action}</p>
                                                <span className="text-[9px] font-bold text-gray-400">
                                                    {format(new Date(log.created_at), 'dd/MM HH:mm')}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-500 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                                                <span>Ref: {log.reference || 'N/A'}</span>
                                                <span className="text-[8px] opacity-50">{log.warehouse_name || ''}</span>
                                            </p>
                                            <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-bold uppercase tracking-wider pl-1">
                                                <User size={10} /> {log.user_name || 'System Auto'}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {history.length === 0 && !historyLoading && (
                                    <div className="text-center p-8 opacity-40">
                                        <AlertCircle size={24} className="mx-auto mb-2" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest">No logs recorded</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50/50 p-12 rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center text-center">
                            <ArrowRight size={24} className="text-gray-300 mb-4 animate-bounce-x" />
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Select a serial to view lifecycle</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Add a custom animation
const style = document.createElement('style');
style.textContent = `
    @keyframes bounce-x {
        0%, 100% { transform: translateX(0); }
        50% { transform: translateX(10px); }
    }
    .animate-bounce-x {
        animation: bounce-x 1s infinite;
    }
`;
if (typeof document !== 'undefined') document.head.appendChild(style);
