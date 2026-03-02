import { Truck } from "lucide-react";
import { TransfersClient } from "./TransfersClient";

export const dynamic = 'force-dynamic';

export default async function TransfersPage() {
    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h1 className="page-header-title  tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 text-white">
                            <Truck size={28} />
                        </div>
                        Stock <span className="text-emerald-600">Transfers</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Global Logistics & Terminal Movement</p>
                </div>
            </header>

            <TransfersClient />
        </div>
    );
}
