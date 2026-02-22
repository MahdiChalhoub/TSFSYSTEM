'use client';

import { MapPin } from 'lucide-react';
import clsx from 'clsx';

export function CompactClientHeader({ client, currency = '$', uniqueItems, totalPieces }: {
    client: any,
    currency?: string,
    uniqueItems: number,
    totalPieces: number
}) {
    return (
        <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 divide-x divide-gray-200">
                <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Client</span>
                        <span className="font-black text-gray-900 text-sm uppercase tracking-tight truncate max-w-[140px]">{client.name}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Phone</span>
                        <span className="font-bold text-gray-500 text-[10px] tabular-nums whitespace-nowrap">{client.phone}</span>
                    </div>
                </div>

                <div className="pl-6 flex flex-col">
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Delivery Address</span>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                        <MapPin size={10} className="text-gray-300 shrink-0" />
                        <span className="truncate max-w-[180px]">{client.address}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6 ml-auto">
                <div className="flex gap-1.5 ">
                    <div className="flex flex-col items-center px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                        <span className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter">Lines</span>
                        <span className="text-[11px] font-black tabular-nums text-indigo-600 leading-tight">{uniqueItems}</span>
                    </div>
                    <div className="flex flex-col items-center px-2 py-0.5 bg-gray-100/50 border border-gray-200 rounded-lg">
                        <span className="text-[7px] font-black text-gray-400 uppercase tracking-tighter">Units</span>
                        <span className="text-[11px] font-black tabular-nums text-gray-700 leading-tight">{totalPieces}</span>
                    </div>
                </div>

                <div className="flex gap-6 divide-x divide-gray-200">
                    <div className="flex flex-col text-right">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Balance</span>
                        <span className={clsx("font-black text-lg tracking-tighter tabular-nums leading-tight", client.balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                            {currency}{client.balance.toLocaleString()}
                        </span>
                    </div>
                    <div className="pl-6 flex flex-col text-right">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Loyalty</span>
                        <span className="font-black text-amber-500 text-lg tracking-tighter tabular-nums leading-tight">{client.loyalty}<span className="text-[10px] ml-0.5">pts</span></span>
                    </div>
                </div>
            </div>
        </div>
    );
}
