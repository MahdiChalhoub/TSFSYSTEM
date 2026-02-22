import { Truck } from "lucide-react";
import { TransfersClient } from "./TransfersClient";

export const dynamic = 'force-dynamic';

export default async function TransfersPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-200">
                        <Truck size={16} />
                    </div>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Logistics Operations</span>
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tighter">
                    Stock <span className="text-blue-600">Transfers</span>
                </h1>
                <p className="mt-2 text-gray-500 font-medium max-w-xl">
                    Manage real-time stock movements between terminals.
                    Operational Drafts here reserve inventory in the source terminal immediately.
                </p>
            </header>

            <TransfersClient />
        </div>
    );
}
