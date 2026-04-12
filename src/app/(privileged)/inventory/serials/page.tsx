import React from 'react';
import { Barcode, ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { SerialTracker } from '@/components/modules/inventory/SerialTracker';

export const metadata = {
    title: 'Serial & IMEI Tracking | Dajingo ERP',
    description: 'Track individual product units and their lifecycle history.',
};

export default function SerialsPage() {
    return (
        <div className="flex flex-col min-h-screen bg-[#fafafa]">
            {/* Header Section */}
            <div className="bg-app-surface border-b border-app-border flex-none px-8 py-8">
                <div className="max-w-[1600px] mx-auto">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-app-muted-foreground mb-4">
                        <Link href="/" className="hover:text-app-foreground transition-colors flex items-center gap-1">
                            <Home size={10} /> HOME
                        </Link>
                        <ChevronRight size={10} />
                        <Link href="/inventory" className="hover:text-app-foreground transition-colors">
                            INVENTORY
                        </Link>
                        <ChevronRight size={10} />
                        <span className="text-app-foreground">SERIAL TRACKING</span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-slate-900/20">
                                    <Barcode size={28} />
                                </div>
                                <div>
                                    <h1 className="text-4xl font-black text-app-foreground uppercase tracking-tighter leading-none">
                                        Serial Tracking
                                    </h1>
                                    <p className="text-sm text-app-muted-foreground font-medium tracking-tight mt-1">
                                        Unit-level visibility of high-value inventory and IMEI devices.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 px-8 py-10 overflow-y-auto">
                <div className="max-w-[1600px] mx-auto">
                    <SerialTracker />
                </div>
            </div>
        </div>
    );
}
